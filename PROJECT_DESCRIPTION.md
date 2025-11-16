# Project Description

**Deployed Frontend URL:** https://chess-trivia.0xjames.me/

**Solana Program ID:** DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4

## Project Overview

### Description
I built a decentralized application (dApp) that gives daily chess trivia/puzzles from lichess and the solvers get certificates and also certs are minted and can be seen in your wallets under collectibles The goal is to make chess fun and engaging.

### Key Features

- Feature 1: Engaging ui/ux that shows beautifully chess board representing the trivia/puzzle.
- Feature 2: Certificates are minted and can be seen in your wallets under collectibles.
- Feature 3: No manual minting of certificates and no manual upload of puzzles/trivia, I kept github workflows that fetch puzzles/trivia from lichess and update the solana program with the new trivia/puzzles daily also certs are minted periodically to users who solve the trivia/puzzles currently every 3 hours.
  
### How to Use the dApp

1. **Connect Wallet**
2. **Main Action 1:** Just click connect wallet button on navbar.
3. **Main Action 2:** Select your wallet (Phantom, etc.) and approve the connection. That's easy..!

## Program Architecture
Solana program that manages daily chess trivia rounds, user attempts, and certificate issuance. The program supports:

- Admin configuration (server/admin keys) and initialization of the `Config` account.
- Admin-led creation of daily `Round` accounts containing the puzzle FEN, solution hash, and attempt limits.
- User attempts that create/track per-user `UserAttempt` accounts and issue `Certificate` accounts if a user solves a round.
- A protected admin instruction to record on-chain the mint associated with a `Certificate` after an NFT is created off-chain.

Flow summary:
1. Admin runs an action (or an automated CI workflow) to initialize the program's `Config` (sets admin and server keys).
2. Admin initializes a daily `Round` account (with date, fen, and the SHA-256 of the solution).
3. Users submit attempts via `attempt_trivia` (frontend calls this). Each user’s attempt is tracked in a per-round per-user `UserAttempt` account and capped by the round's attempt limit.
4. When an attempt matches the round’s solution hash, a `Certificate` account is created and assigned to the user. The certificate initially records owner and timestamp, with an unset mint and metadata URI.
5. An off-chain worker mints an NFT (using Metaplex/UMI) for the certificate and then calls `register_certificate_mint` on-chain to store the mint pubkey on the associated `Certificate` account.


### PDA Usage
To ensure deterministic addresses and owned accounts, the program uses a small set of PDAs seeded with clear, stable values. These PDAs let the program find and initialize per-round, per-user, and program-level accounts safely.

**PDAs Used:**
- `Config` PDA — seeds: `[b"config"]`.
    - Purpose: Stores admin and server pubkeys and program config (one-time init by admin). Deterministic single config per program.
    - Created using `init` and `payer = admin` with `b"config"` seed.

- `Round` PDA — seeds: `[b"round", date.to_be_bytes()]`.
    - Purpose: Holds puzzle metadata for a specific date (date as u32), including `fen`, `solution_hash`, `attempt_limit` and a bump.
    - This approach maps rounds to calendar dates and allows stateless creation & lookup.

- `UserAttempt` PDA — seeds: `[b"attempt", round.key().as_ref(), user.key().as_ref()]`.
    - Purpose: Tracks per-user attempt counts and the last attempt timestamp for a particular round (to enforce limits).
    - `init_if_needed` is used so a first attempt will allocate the account as needed.

- `Certificate` PDA — seeds: `[b"certificate", user.key().as_ref(), round.date.to_be_bytes().as_ref()]`.
    - Purpose: Stores the certificate for a user solving a round; records owner, mint, metadata URI, timestamp and bump.
    - `init_if_needed` is used so that a certificate account is created only when needed.

These PDAs ensure that accounts are unique and discoverable by external services (frontend/off-chain worker) and that only the owning program can sign operations that mutate them.

**PDAs Used:**
- PDA 1: [Purpose and description]
- PDA 2: [Purpose and description]

### Program Instructions
The on-chain program defines the following instructions and handlers:

- `initialize` (InitializeConfig)
    - Accounts: `config` (init PDA `[b"config"]`), `admin` signer, system program.
    - Purpose: Create and set the `Config` account, storing `admin` and `server` keys and a bump.
    - Access control: Only a signer (admin) can call this; typical usage is performed once after deploy.

- `initialize_round` (InitializeRound)
    - Accounts: `round` (init PDA `[b"round", date]`), `admin` signer, system program.
    - Purpose: Create a `Round` for a specific date and store puzzle metadata: `fen`, `solution_hash` (sha256), and `attempt_limit`.
    - Access control: Admin must sign (server or admin signer); used by the scheduled CI job that builds daily puzzles.

- `attempt_trivia` (SubmitAttempt)
    - Accounts: `round` (mut), `user_attempt` (init_if_needed PDA `[b"attempt", round, user]`), `certificate` (init_if_needed PDA `[b"certificate", user, round_date]`), `user` signer, system program.
    - Purpose: Allow a user to submit a candidate (preimage). The program computes the sha256 of the preimage and compares it to `Round.solution_hash`. If it matches, a `Certificate` is created and populated with `owner` and `timestamp`. Also, user attempt counters are incremented and checked against `attempt_limit`.
    - Errors: Returns `AttemptLimitExceeded` if user exceeded their attempts; returns `CertificateAlreadyExists` if the certificate already exists for that user and round.

- `register_certificate_mint` (RegisterCertificateMint)
    - Accounts: `certificate` (mut), `config` (mut, `[b"config"]`), `admin` signer.
    - Purpose: Register the mint pubkey produced by an off-chain minting process by setting `Certificate.mint` on-chain.
    - Access control: Only the configured `admin` (in the `Config` account) may call this.
    - Errors: Verifies that the certificate exists (`owner != Pubkey::default()`) and that the certificate does not already have a mint (`CertificateAlreadyHasMint`).

**Instructions Implemented:**
- Instruction 1: [Description of what it does]
- Instruction 2: [Description of what it does]
- ...

### Account Structure
The following `#[account]` structures are used to store on-chain program state:
```rust
#[account]
pub struct Config {
    pub admin: Pubkey,     
    pub server: Pubkey,    
    pub bump: u8,
}

#[account]
pub struct Round {
    pub date: u32,         
    pub fen: String,       
    pub solution_hash: [u8; 32], 
    pub attempt_limit: u8, 
    pub bump: u8,
}

#[account]
pub struct UserAttempt {
    pub attempts: u8,      
    pub last_attempt_ts: i64, 
    pub bump: u8,
}

#[account]
pub struct Certificate {
    pub owner: Pubkey,     
    pub mint: Pubkey,      
    pub metadata_uri: String, 
    pub timestamp: i64,    
    pub bump: u8,
}
```

- `Config` is a single PDA that controls admin permissions; used to validate register calls.
- `Round` is keyed by the date so external services can derive the address easily and fetch round details.
- `UserAttempt` and `Certificate` are per user and per round, allowing the program to track attempts and prevent duplicate certificates and enforce attempt limits.

```rust
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
```

## Testing

### Test Coverage
The test covers initialization, PDA derivation, round lifecycle, attempts, duplicate/limit checks, Lichess puzzle integration, and certificate mint registration.

Test utilities and helpers used in tests:
- `getConfigPda()` — derive Config PDA for tests.
- `getRoundPda(date)` — derive Round PDA for a given date.
- `getUserAttemptPda(roundPda, userPubkey)` — derive UserAttempt PDA.
- `getCertificatePda(userPubkey, date)` — derive Certificate PDA.
- `computeSolutionHash(solution)` — SHA-256 of provided solution preimage.
- `airdrop(pubkey, amount)` — helper to fund test keypairs.

**Test suites / Cases:**

Happy Path Tests:
- Initialization
    - "Initializes the config successfully" — asserts config `admin`, `server`, and `bump` are set correctly.

- Round Creation
    - "Admin initializes a round successfully" — asserts round fields (`date`, `fen`, `attempt_limit`, `solution_hash`) are stored correctly.

- Submit Attempts (correct solution)
    - "User submits correct solution and receives certificate" — asserts `userAttempt` increments and a `Certificate` is created with `owner` and `timestamp`.
    - "Second user can also solve the same puzzle" — asserts multiple users can solve and receive certificates.

- Hash Verification
    - Real puzzle success: the test initializes a round from `puzzle-data.json`, verifies the round is stored, and a synthetic user solves it (creating a certificate).

- Certificate mint registration
    - "Admin can register a mint for a certificate" — asserts the `certificate.mint` field is set by the admin.

Unhappy Path Tests:
- Initialization
    - "Fails to initialize config twice" — asserts duplicate `Config` initialization is rejected.

- Round Creation
    - "Fails to initialize same round twice" — asserts duplicate `Round` creation for the same date is rejected.

- Submit Attempts
    - "Wrong solution does not create certificate" — incorrect solutions do not create certificates; `userAttempt` is still recorded.
    - "Third attempt fails with AttemptLimitExceeded" — when `attempt_limit` is reached, the next attempt returns `AttemptLimitExceeded`.
    - "Second correct submission fails with CertificateAlreadyExists" — the second correct submission for same user/round returns `CertificateAlreadyExists`.

- Real Lichess Puzzle Integration (negative)
    - Wrong solution for the real puzzle fails to create a certificate and records the attempt.

- Certificate mint registration (negative)
    - "Non-admin cannot register a mint" — unauthorized callers cannot call `register_certificate_mint` and will get `Unauthorized`.


### Running Tests
These commands run the Anchor test suite; if the local validator takes longer to start, use the alternative.
```bash
anchor test
```

```bash
solana-test-validator --reset
anchor test --skip-local-validator
```

### Additional Notes for Evaluators
- Everything in folder is needed. Some things may break if some files are missing.