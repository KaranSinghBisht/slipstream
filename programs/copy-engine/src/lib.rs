use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};

pub mod errors;
pub mod oracle;
pub mod state;

use errors::EngineError;
use state::FollowerVault;

declare_id!("3yqVR6fFZVxwKy5CqY968ZdVKJWVtqr4jANi98NmVovz");

pub const VAULT_SEED: &[u8] = b"vault";
pub const BPS_DENOM: u64 = 10_000;

#[ephemeral]
#[program]
pub mod copy_engine {
    use super::*;

    /// Base layer: create the follower's vault with their risk constraints.
    pub fn init_vault(
        ctx: Context<InitVault>,
        allocation_usd_6: u64,
        max_leverage_x10: u16,
        trail_bps: u16,
        operator: Pubkey,
        feed: Pubkey,
    ) -> Result<()> {
        require!(allocation_usd_6 > 0, EngineError::InvalidAmount);
        require!(max_leverage_x10 >= 10, EngineError::InvalidAmount);
        require!(
            trail_bps > 0 && trail_bps < BPS_DENOM as u16,
            EngineError::InvalidAmount
        );

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.payer.key();
        vault.operator = operator;
        vault.feed = feed;
        vault.allocation_usd_6 = allocation_usd_6;
        vault.max_leverage_x10 = max_leverage_x10;
        vault.trail_bps = trail_bps;
        vault.equity_usd_6 = allocation_usd_6;
        vault.qty_1e6 = 0;
        vault.entry_price_1e6 = 0;
        vault.peak_price_1e6 = 0;
        vault.trail_stop_price_1e6 = 0;
        vault.last_price_1e6 = 0;
        vault.stop_fired = false;
        vault.tick_count = 0;
        vault.updated_at = Clock::get()?.unix_timestamp;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Base layer: hand the vault PDA to the delegation program. Pass a
    /// validator to pin the vault onto the same ER that hosts the price feeds.
    pub fn delegate_vault(ctx: Context<DelegateVault>, validator: Option<Pubkey>) -> Result<()> {
        let payer_key = ctx.accounts.payer.key();
        ctx.accounts.delegate_vault(
            &ctx.accounts.payer,
            &[VAULT_SEED, payer_key.as_ref()],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// ER (owner or operator): open a mirrored position at the leader's price.
    pub fn open_position(ctx: Context<MutateVault>, qty_1e6: i64, price_1e6: u64) -> Result<()> {
        require_authorized(&ctx.accounts.vault, &ctx.accounts.signer)?;
        require!(qty_1e6 != 0, EngineError::InvalidAmount);
        require!(price_1e6 > 0, EngineError::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        require!(vault.qty_1e6 == 0, EngineError::PositionAlreadyOpen);

        let notional_usd_6 = mul_1e6(qty_1e6.unsigned_abs(), price_1e6)?;
        let max_notional = (vault.equity_usd_6 as u128)
            .checked_mul(vault.max_leverage_x10 as u128)
            .and_then(|v| v.checked_div(10))
            .ok_or(EngineError::MathOverflow)?;
        require!(
            (notional_usd_6 as u128) <= max_notional,
            EngineError::LeverageExceeded
        );

        vault.qty_1e6 = qty_1e6;
        vault.entry_price_1e6 = price_1e6;
        vault.peak_price_1e6 = price_1e6;
        vault.trail_stop_price_1e6 = trail_stop_for(qty_1e6, price_1e6, vault.trail_bps)?;
        vault.last_price_1e6 = price_1e6;
        vault.stop_fired = false;
        vault.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// ER (owner or operator): deterministic tick for tests/demos.
    pub fn apply_tick(ctx: Context<MutateVault>, price_1e6: u64) -> Result<()> {
        require_authorized(&ctx.accounts.vault, &ctx.accounts.signer)?;
        require!(price_1e6 > 0, EngineError::InvalidAmount);
        run_tick(&mut ctx.accounts.vault, price_1e6)
    }

    /// ER (permissionless, crank-driven): read the oracle feed onchain and run
    /// the guard loop — ratchet the trailing stop, fire it if crossed.
    pub fn check_trailing_stop(ctx: Context<CheckTrailingStop>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(
            ctx.accounts.price_update.key(),
            vault.feed,
            EngineError::BadOracleAccount
        );
        let now = Clock::get()?.unix_timestamp;
        let price_1e6 = oracle::read_price_1e6(&ctx.accounts.price_update, now)?;
        run_tick(vault, price_1e6)
    }

    /// ER (owner or operator): schedule check_trailing_stop as a crank that the
    /// ER itself executes every `interval_ms` — no external trigger.
    pub fn schedule_stop_crank(
        ctx: Context<ScheduleCrank>,
        task_id: u64,
        interval_ms: u64,
        iterations: u64,
    ) -> Result<()> {
        require_authorized(&ctx.accounts.vault, &ctx.accounts.payer)?;
        require_keys_eq!(
            ctx.accounts.price_update.key(),
            ctx.accounts.vault.feed,
            EngineError::BadOracleAccount
        );

        let crank_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.price_update.key(), false),
            ],
            data: anchor_lang::InstructionData::data(
                &crate::instruction::CheckTrailingStop {},
            ),
        };

        let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: task_id as i64,
            execution_interval_millis: interval_ms as i64,
            iterations: iterations as i64,
            instructions: vec![crank_ix],
        }))
        .map_err(|_| EngineError::CrankSerializeFailed)?;

        let schedule_ix = Instruction::new_with_bytes(
            MAGIC_PROGRAM_ID,
            &ix_data,
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.price_update.key(), false),
            ],
        );

        invoke(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.price_update.to_account_info(),
            ],
        )?;
        Ok(())
    }

    /// ER (owner or operator): close the open position at the given price.
    pub fn close_position(ctx: Context<MutateVault>, price_1e6: u64) -> Result<()> {
        require_authorized(&ctx.accounts.vault, &ctx.accounts.signer)?;
        require!(price_1e6 > 0, EngineError::InvalidAmount);
        let vault = &mut ctx.accounts.vault;
        require!(vault.qty_1e6 != 0, EngineError::NoPosition);
        close_into_equity(vault, price_1e6)?;
        vault.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// ER: persist current vault state to base layer, stay delegated.
    pub fn commit_vault(ctx: Context<CommitVault>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.vault.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// ER: commit final state and return ownership to this program.
    pub fn undelegate_vault(ctx: Context<CommitVault>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.vault.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

fn require_authorized(vault: &FollowerVault, signer: &Signer) -> Result<()> {
    let key = signer.key();
    require!(
        key == vault.owner || key == vault.operator,
        EngineError::Unauthorized
    );
    Ok(())
}

/// Shared guard-loop body: record the tick, ratchet the stop, fire on cross.
fn run_tick(vault: &mut FollowerVault, price_1e6: u64) -> Result<()> {
    vault.last_price_1e6 = price_1e6;
    vault.tick_count = vault
        .tick_count
        .checked_add(1)
        .ok_or(EngineError::MathOverflow)?;
    vault.updated_at = Clock::get()?.unix_timestamp;

    if vault.qty_1e6 == 0 {
        return Ok(());
    }

    let improved = if vault.qty_1e6 > 0 {
        price_1e6 > vault.peak_price_1e6
    } else {
        price_1e6 < vault.peak_price_1e6
    };
    if improved {
        vault.peak_price_1e6 = price_1e6;
        vault.trail_stop_price_1e6 = trail_stop_for(vault.qty_1e6, price_1e6, vault.trail_bps)?;
    }

    let stop_hit = if vault.qty_1e6 > 0 {
        price_1e6 <= vault.trail_stop_price_1e6
    } else {
        price_1e6 >= vault.trail_stop_price_1e6
    };
    if stop_hit {
        close_into_equity(vault, price_1e6)?;
        vault.stop_fired = true;
        msg!("TRAILING STOP FIRED at {} (1e6 USD)", price_1e6);
    }
    Ok(())
}

/// price * |qty| / 1e6, in 6dp USD.
fn mul_1e6(qty_abs: u64, price_1e6: u64) -> Result<u64> {
    (qty_abs as u128)
        .checked_mul(price_1e6 as u128)
        .and_then(|v| v.checked_div(1_000_000))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or_else(|| EngineError::MathOverflow.into())
}

/// Long: stop trails below price; short: stop trails above.
fn trail_stop_for(qty_1e6: i64, price_1e6: u64, trail_bps: u16) -> Result<u64> {
    let delta = (price_1e6 as u128)
        .checked_mul(trail_bps as u128)
        .and_then(|v| v.checked_div(BPS_DENOM as u128))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(EngineError::MathOverflow)?;
    if qty_1e6 > 0 {
        price_1e6
            .checked_sub(delta)
            .ok_or_else(|| EngineError::MathOverflow.into())
    } else {
        price_1e6
            .checked_add(delta)
            .ok_or_else(|| EngineError::MathOverflow.into())
    }
}

/// Realize PnL into equity and flatten the position.
fn close_into_equity(vault: &mut FollowerVault, price_1e6: u64) -> Result<()> {
    let pnl_usd_6 = (vault.qty_1e6 as i128)
        .checked_mul(price_1e6 as i128 - vault.entry_price_1e6 as i128)
        .and_then(|v| v.checked_div(1_000_000))
        .ok_or(EngineError::MathOverflow)?;
    let new_equity = (vault.equity_usd_6 as i128)
        .checked_add(pnl_usd_6)
        .ok_or(EngineError::MathOverflow)?;
    vault.equity_usd_6 = u64::try_from(new_equity.max(0)).map_err(|_| EngineError::MathOverflow)?;
    vault.qty_1e6 = 0;
    vault.entry_price_1e6 = 0;
    vault.peak_price_1e6 = 0;
    vault.trail_stop_price_1e6 = 0;
    Ok(())
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + FollowerVault::INIT_SPACE,
        seeds = [VAULT_SEED, payer.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, FollowerVault>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: delegated via the `del` constraint; seeds checked against VAULT_SEED + payer.
    #[account(mut, del, seeds = [VAULT_SEED, payer.key().as_ref()], bump)]
    pub vault: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct MutateVault<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED, vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, FollowerVault>,
}

#[derive(Accounts)]
pub struct CheckTrailingStop<'info> {
    #[account(mut, seeds = [VAULT_SEED, vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, FollowerVault>,
    /// CHECK: owner + key validated in the instruction against vault.feed.
    pub price_update: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ScheduleCrank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED, vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, FollowerVault>,
    /// CHECK: key validated against vault.feed; read-only feed account.
    pub price_update: AccountInfo<'info>,
    /// CHECK: the MagicBlock scheduler program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED, vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, FollowerVault>,
}
