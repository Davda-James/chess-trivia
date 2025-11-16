# Anchor Project — Chess Trivia

This folder contains the Anchor program and related scripts for the Chess Trivia dApp. The program manages daily rounds (puzzles), user attempts, and certificate issuance. Off-chain automation scripts live in `scripts/` and help initialize rounds and mint certificates.

Program ID (devnet): DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4

## Quick setup

Prerequisites:
- Rust and Cargo
- Solana CLI 
- Anchor CLI 
- Node.js & yarn for TypeScript scripts (`ts-node` is used in scripts)

1) Install dependencies (for scripts and test harness):

```bash
cd anchor_project/chess-trivia
npm install
```

2) Build Anchor program:

```bash
anchor build
```

3) If you're using the frontend locally copy the IDL into the frontend folder (the UI expects it at `frontend/chess-trivia/idl/chess_trivia.json`):

```bash
cp target/idl/chess_trivia.json ../../frontend/chess-trivia/idl/chess_trivia.json
```

## Running tests

Use Anchor’s test command. This will run the program tests (local validator will be used by default):

```bash
anchor test
```

If the local validator fails or takes long to start, reset and run with `--skip-local-validator`:

```bash
solana-test-validator --reset
anchor test --skip-local-validator
```

## Scripts

- `scripts/initialize_config.ts` — Initialize the global `Config` PDA with admin and server keys. This should be run once after deploy by the admin. The script expects `ADMIN_KEYPAIR_B64` env var (base64-encoded JSON secret key array) and reads the IDL from `target/idl/chess_trivia.json`.
- `scripts/daily-trivia.ts` — Fetches the daily Lichess puzzle, computes canonical solution hash, and initializes a `Round` PDA on-chain via `initializeRound`. The script expects `ADMIN_KEYPAIR_B64` to be set.
- `scripts/mint_worker.ts` — Off-chain worker that mints NFTs for solved certificates and updates on-chain state (`register_certificate_mint`). The worker uploads metadata to Filebase S3 and uses UMI/Metaplex to mint NFTs. See environment requirements below.

## Environment variables

Check out .env.example to set all env variables.

- `ADMIN_KEYPAIR_B64` — base64-encoded JSON array of the admin keypair (`solana-keygen new -o key.json` then `base64 -w0 key.json`). Required for scripts that sign transactions (initialize, daily-trivia, mint worker).
- `RPC` — Solana RPC endpoint (default: `https://api.devnet.solana.com`).
- `MINT_WORKER_POLL_MS` — Poll interval for `mint_worker.ts`. 
- `FILEBASE_ACCESS_KEY`, `FILEBASE_ACCESS_KEY_SECRET`, `FILEBASE_BUCKET` — Credentials for Filebase S3 used by the mint worker to host metadata. `FILEBASE_S3_ENDPOINT` optional (default: `https://s3.filebase.com`).

Example: set `ADMIN_KEYPAIR_B64` and run initialize:

```bash
yarn ts-node ./scripts/initialize_config.ts
```

## Run scripts (examples)

- Initialize config:
```bash
yarn ts-node ./scripts/initialize_config.ts
```

- Initialize today's round (manual run of daily-trivia):
```bash
yarn ts-node ./scripts/daily-trivia.ts
```

- Run mint worker once:
```bash
yarn run mint:worker
```