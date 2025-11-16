# Chess Trivia — Frontend

This is the web frontend for the Chess Trivia dApp. It shows the daily puzzle, lets users submit attempts, and displays certificates when a puzzle is solved. The app uses Vite + React + TypeScript, Anchor for interacting with the Solana program, and Solana wallet adapters for signing transactions.

## Quick start

Prerequisites:
- Node.js (v18+ recommended)
- A Solana wallet extension like Phantom

1) Install dependencies

```bash
cd frontend/chess-trivia
bun install
```

2) Prepare the Anchor IDL (required by the frontend)

The frontend loads the program ID and IDL from `./idl/chess_trivia.json`. If you built the Anchor program locally, copy the IDL from the Anchor project:

```bash
cp ../../anchor_project/chess-trivia/target/idl/chess_trivia.json ./idl/chess_trivia.json
# or from root
cp anchor_project/chess-trivia/target/idl/chess_trivia.json frontend/chess-trivia/idl/chess_trivia.json
```

If you don't have a built IDL, run `anchor build` in `anchor_project/chess-trivia` to generate it.

3) Run the app in development

```bash
bun run dev
```

4) Build for production

```bash
bun run build
```

## How it connects to Solana

- The app uses the Anchor IDL file (`idl/chess_trivia.json`) which contains the program address. The IDL must be present for the frontend to interact with the program.
- The app uses the wallet adapter and the RPC provider configured by the wallet (e.g., Phantom's network). Make sure your wallet is on the correct cluster Devnet when testing.

