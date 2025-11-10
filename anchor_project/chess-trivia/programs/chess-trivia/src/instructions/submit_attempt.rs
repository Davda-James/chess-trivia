use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SubmitAttempt<'info> {
    #[account(mut, seeds = [b"round", round.date.to_be_bytes().as_ref()], bump = round.bump)]
    pub round: Account<'info, Round>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserAttempt::INIT_SPACE,
        seeds = [b"attempt", round.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_attempt: Account<'info, UserAttempt>,

    #[account(
        init_if_needed,
        payer = user,   
        space = 8 + Certificate::INIT_SPACE,
        seeds = [b"certificate", user.key().as_ref(), round.date.to_be_bytes().as_ref()],
        bump
    )]
    pub certificate: Account<'info, Certificate>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn submit_attempt(ctx: Context<SubmitAttempt>, attempt_preimage: String) -> Result<()> {
    let round = &ctx.accounts.round;
    let user_attempt = &mut ctx.accounts.user_attempt;
    let clock = Clock::get()?;

    // Check attempt limit
    if user_attempt.attempts >= round.attempt_limit {
        return err!(CustomErrors::AttemptLimitExceeded);
    }

    // Increment attempts and update timestamp
    user_attempt.attempts = user_attempt.attempts.saturating_add(1);
    user_attempt.last_attempt_ts = clock.unix_timestamp;
    user_attempt.bump = ctx.bumps.user_attempt;

    // Compute sha256 of provided preimage
    let h = hash(attempt_preimage.as_bytes()).to_bytes();
    if h == round.solution_hash {
        // success — create certificate
        let cert = &mut ctx.accounts.certificate;
        
        // Check if certificate already exists (owner will be default if newly initialized)
        if cert.owner != Pubkey::default() {
            return err!(CustomErrors::CertificateAlreadyExists);
        }
        
        cert.owner = ctx.accounts.user.key();
        cert.mint = Pubkey::default();
        cert.metadata_uri = String::from("");
        cert.timestamp = clock.unix_timestamp;
        cert.bump = ctx.bumps.certificate;
        msg!("User {} solved round {}", cert.owner, round.date);
    }

    Ok(())
}