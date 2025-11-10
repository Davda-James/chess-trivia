use anchor_lang::prelude::*;

#[error_code]
pub enum CustomErrors {
    #[msg("Unauthorized: caller is not the configured server authority")]
    Unauthorized,
    #[msg("Invalid PDA bump")]
    InvalidBump,
    #[msg("Round not active or not found")]
    RoundNotActive,
    #[msg("Attempt limit exceeded")]
    AttemptLimitExceeded,
    #[msg("Certificate already exists for this user and round")]
    CertificateAlreadyExists,
    #[msg("Certificate already has a mint registered")]
    CertificateAlreadyHasMint,
}
