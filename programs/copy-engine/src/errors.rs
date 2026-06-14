use anchor_lang::prelude::*;

#[error_code]
pub enum EngineError {
    #[msg("Amount or parameter out of range")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Vault already has an open position")]
    PositionAlreadyOpen,
    #[msg("Vault has no open position")]
    NoPosition,
    #[msg("Notional exceeds the vault's leverage ceiling")]
    LeverageExceeded,
    #[msg("Signer is neither vault owner nor operator")]
    Unauthorized,
    #[msg("Account is not a recognized oracle price account")]
    BadOracleAccount,
    #[msg("Oracle returned a non-positive price")]
    BadOraclePrice,
    #[msg("Oracle price is too old")]
    StaleOraclePrice,
    #[msg("Failed to serialize crank schedule")]
    CrankSerializeFailed,
}
