#![allow(deprecated)]
use anchor_lang::prelude::*;
pub mod instructions;
pub mod states;
pub mod events;
pub mod errors;

use instructions::*;

declare_id!("DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4");

#[program]
pub mod chess_trivia {
    use super::*;

    pub fn initialize(ctx: Context<InitializeConfig>, server: Pubkey) -> Result<()> {
        init_config(ctx, server)
    }

    pub fn initialize_round(ctx: Context<InitializeRound>, date: u32, fen: String, solution_hash: [u8; 32], attempt_limit: u8) -> Result<()> {
        initialize_new_round(ctx, date, fen, solution_hash, attempt_limit)
    }

    pub fn attempt_trivia(ctx: Context<SubmitAttempt>, attempt_preimage: String) -> Result<()> {
        submit_attempt(ctx, attempt_preimage)
    }

    pub fn register_certificate_mint(ctx: Context<RegisterCertificateMint>, mint: Pubkey) -> Result<()> {
        register_cert_mint(ctx, mint)
    }
}
