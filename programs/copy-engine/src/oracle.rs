use anchor_lang::prelude::*;

use crate::errors::EngineError;

/// MagicBlock's ER-resident price oracle program (writes Pyth Lazer updates).
pub const ORACLE_PROGRAM: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");

/// Max accepted age of a price before the engine refuses to act on it.
pub const MAX_PRICE_AGE_SECS: i64 = 120;

/// Raw decode of a Pyth `PriceUpdateV2`-layout account.
///
/// Layout: 8 discriminator | 32 write_authority | verification_level
/// (1 byte tag; Partial carries one extra byte) | PriceFeedMessage
/// (32 feed_id, i64 price, u64 conf, i32 exponent, i64 publish_time, ...).
/// Decoded manually because the receiver SDK pins a different anchor major.
pub fn read_price_1e6(account: &AccountInfo, now_unix: i64) -> Result<u64> {
    require_keys_eq!(*account.owner, ORACLE_PROGRAM, EngineError::BadOracleAccount);

    let data = account.try_borrow_data()?;
    require!(data.len() >= 133, EngineError::BadOracleAccount);

    let tag = data[40];
    let msg = match tag {
        1 => 41usize, // Full
        0 => 42usize, // Partial { num_signatures }
        _ => return Err(EngineError::BadOracleAccount.into()),
    };
    require!(data.len() >= msg + 60, EngineError::BadOracleAccount);

    let price = i64::from_le_bytes(
        data[msg + 32..msg + 40]
            .try_into()
            .map_err(|_| EngineError::BadOracleAccount)?,
    );
    let exponent = i32::from_le_bytes(
        data[msg + 48..msg + 52]
            .try_into()
            .map_err(|_| EngineError::BadOracleAccount)?,
    );
    let publish_time = i64::from_le_bytes(
        data[msg + 52..msg + 60]
            .try_into()
            .map_err(|_| EngineError::BadOracleAccount)?,
    );

    require!(price > 0, EngineError::BadOraclePrice);
    require!(
        now_unix.saturating_sub(publish_time) <= MAX_PRICE_AGE_SECS,
        EngineError::StaleOraclePrice
    );

    // The ER price pusher stores the exponent as a positive magnitude
    // (verified on devnet: 8 where Pyth semantics mean -8).
    let exponent = -exponent.abs();
    scale_to_1e6(price as u128, exponent)
}

/// Rescale price from 10^exponent to 6-decimal fixed point.
fn scale_to_1e6(price: u128, exponent: i32) -> Result<u64> {
    let shift = exponent + 6;
    let scaled = if shift >= 0 {
        price.checked_mul(10u128.pow(shift as u32))
    } else {
        price.checked_div(10u128.pow((-shift) as u32))
    }
    .ok_or(EngineError::MathOverflow)?;
    u64::try_from(scaled).map_err(|_| EngineError::MathOverflow.into())
}
