use anchor_lang::prelude::*;

/// One follower's guarded paper-trading vault. Delegated into the Ephemeral
/// Rollup so ticks, stop ratchets, and fills run at ER latency for zero fees.
#[account]
#[derive(InitSpace)]
pub struct FollowerVault {
    pub owner: Pubkey,
    /// Backend key allowed to write mirrors/ticks; owner can undelegate anytime.
    pub operator: Pubkey,
    /// Oracle price account this vault's guard loop reads.
    pub feed: Pubkey,
    /// Total budget the follower allocated, USD with 6 decimals.
    pub allocation_usd_6: u64,
    /// Leverage ceiling x10 (25 = 2.5x).
    pub max_leverage_x10: u16,
    /// Trailing-stop distance in basis points.
    pub trail_bps: u16,
    /// Current equity (allocation +/- realized PnL), USD 6dp.
    pub equity_usd_6: u64,
    /// Open position size, base units 6dp; signed (+long / -short); 0 = flat.
    pub qty_1e6: i64,
    pub entry_price_1e6: u64,
    /// Best price seen since entry in the favorable direction.
    pub peak_price_1e6: u64,
    pub trail_stop_price_1e6: u64,
    pub last_price_1e6: u64,
    /// True when the last close was a trailing-stop trigger.
    pub stop_fired: bool,
    pub tick_count: u64,
    pub updated_at: i64,
    pub bump: u8,
}
