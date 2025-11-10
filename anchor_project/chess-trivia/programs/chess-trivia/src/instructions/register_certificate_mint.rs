use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct RegisterCertificateMint<'info> {
    #[account(mut)]
    pub certificate: Account<'info, Certificate>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

pub fn register_cert_mint(ctx: Context<RegisterCertificateMint>, mint: Pubkey) -> Result<()> {
    let cert = &mut ctx.accounts.certificate;
    let config = &ctx.accounts.config;

    if config.admin != ctx.accounts.admin.key() {
        return err!(CustomErrors::Unauthorized);
    }

    if cert.owner == Pubkey::default() {
        return err!(CustomErrors::RoundNotActive);
    }

    if cert.mint != Pubkey::default() {
        return err!(CustomErrors::CertificateAlreadyHasMint);
    }

    cert.mint = mint;
    msg!("Registered mint {} for certificate owned by {}", mint, cert.owner);
    Ok(())
}
