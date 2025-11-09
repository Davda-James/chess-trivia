import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as crypto from 'crypto';
import axios from 'axios';
import { Chess } from 'chess.js';
import dotenv from 'dotenv';
dotenv.config();


async function main() {
  const RPC = "https://api.devnet.solana.com";
  const ADMIN_KEYPAIR_JSON = process.env.ADMIN_KEYPAIR_JSON || '';
  const programId = new PublicKey('DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4'); 

  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(ADMIN_KEYPAIR_JSON)));
  console.log('Loaded admin keypair:', kp.publicKey.toBase58());
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(RPC, 'confirmed'),
    new anchor.Wallet(kp),
    {}
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.ChessTrivia as anchor.Program;

  const res = await axios.get('https://lichess.org/api/puzzle/daily').catch(() => null);
  const json = res?.data ?? null;

  let date: number;
  let fen: string;
  let solution: string;

  if (json && json.puzzle) {
    const pgn: string = json.game?.pgn ?? '';
    const initialPly: number = json.puzzle?.initialPly ?? 0;

    const chess = new Chess();

    const moves = pgn.trim().split(/\s+/).filter(Boolean);

    const plyToPlay = Math.min(initialPly, moves.length);
    for (let i = 0; i < plyToPlay; i++) {

      try {
        chess.move(moves[i]);
      } catch (e) {
        (chess as any).move(moves[i], { sloppy: true });
      }
    }
    fen = chess.fen();

    const solArray: string[] = json.puzzle.solution ?? [];
    solution = solArray.join(' ').trim().toLowerCase();

    const now = new Date();
    date = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    if (json.date) {
      const parsed = parseInt(json.date);
      if (!Number.isNaN(parsed)) date = parsed;
    }
  } else if (json && (json.fen || json.solution_uci)) {
    date = parseInt(json.date) || (() => {
      const now = new Date();
      return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    })();
    fen = json.fen;
    solution = (json.solution_uci ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  } else {
    throw new Error('Unexpected puzzle API response shape');
  }

  // Compute sha256
  const hash = crypto.createHash('sha256').update(solution).digest();

  // Derive round PDA and check existence
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), Buffer.from(Uint8Array.of(
      (date >> 24) & 0xff,
      (date >> 16) & 0xff,
      (date >> 8) & 0xff,
      date & 0xff
    ))],
    program.programId
  );
  try {
    const acc = await provider.connection.getAccountInfo(roundPda);
    if (acc) {
      console.log('round account already exists for date', date, '-> skipping initialization');
      return;
    }
  } catch (e) {
    // If RPC fails, log and continue to avoid blocking automation.
    console.warn('Warning: failed to check round account existence via RPC, proceeding to initialize:', e);
  }

  // Call initializeRound
  const tx = await program.methods
    .initializeRound(date, fen, Array.from(hash), 3) // attempt_limit default 3
    .accounts({
      round: roundPda,
      admin: kp.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .rpc();
  console.log('tx', tx);
}
main();