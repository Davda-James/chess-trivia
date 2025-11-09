use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub server: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub date: u32,
    #[max_len(128)]
    pub fen: String,
    pub solution_hash: [u8; 32],
    pub attempt_limit: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserAttempt {
    pub attempts: u8,
    pub last_attempt_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Certificate {
    pub owner: Pubkey,
    pub mint: Pubkey,
    #[max_len(200)]
    pub metadata_uri: String,
    pub timestamp: i64,
    pub bump: u8,
}
