use anchor_lang::prelude::*;
pub use crate::states::*;
pub use crate::errors::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        space = 8 + Config::INIT_SPACE,
        payer = admin,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(date: u32)]
pub struct InitializeRound<'info> {
    #[account(
        init,
        space = 8 + Round::INIT_SPACE,
        payer = admin,
        seeds = [b"round".as_ref(), date.to_be_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init_config(ctx: Context<InitializeConfig>, server: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.server = server;
    config.bump = ctx.bumps.config;
    msg!("Config initialized with admin: {} and server: {}", config.admin, config.server);
    Ok(())
}

pub fn initialize_new_round(ctx: Context<InitializeRound>, date: u32, fen: String, solution_hash: [u8; 32], attempt_limit: u8) -> Result<()> {
    let round = &mut ctx.accounts.round;
    round.date = date;
    round.fen = fen;
    round.solution_hash = solution_hash;
    round.attempt_limit = attempt_limit;
    round.bump = ctx.bumps.round;
    msg!("Round initialized for date: {}", date);
    Ok(())
}   


