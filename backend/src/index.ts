import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import prisma from './db';
import axios from 'axios';
import * as z from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { verifyAdmin } from './middlewares/index';
import cors from 'cors';
import ENV from './config/env';

const submitSolverLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 3, 
  keyGenerator: (req: any) => req.body.wallet_address || ipKeyGenerator(req),
  handler: (_, res: Response) => {
    res.status(429).json({ error: 'Too many submissions. Please wait before trying again.' });
  },
});

const addPuzzleLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  handler: (_, res: Response) => {
    res.status(429).json({ error: 'Too many requests from this IP.' });
  },
}); 

const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 50, 
  handler: (_, res: Response) => {
    res.status(429).json({ error: 'Too many requests from this IP.' });
  },
});

dotenv.config();

const PORT = ENV.PORT;
const SOLANA_RPC = ENV.SOLANA_RPC;
const ANCHOR_PROGRAM_ID = ENV.ANCHOR_PROGRAM_ID;
const connection = new Connection(SOLANA_RPC, 'confirmed');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));    
app.use(globalLimiter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok"});
});


app.get("/api/leaderboard", async (req: Request, res: Response) => {
  try {
    const leaderboard = await prisma.leaderboard.findMany({
      orderBy: {
        solved_at : 'asc'
      },
      select: {
        user: {
          select: {
            wallet_address: true,
          }
        }
      }
    });
    res.status(200).json({ leaderboard });
  } catch(error) {
    res.status(500).json({ error: "error fetching leaderboard" });
  }
})   


// should be only called by admin 
app.post("/api/add-puzzle", addPuzzleLimiter, verifyAdmin ,async(req: Request, res: Response) => {
  try {
    const schema = z.object({ 
      puzzle_id: z.string(),
      rating: z.number().optional(),
      pgn: z.string(),
      solution: z.array(z.string()),
    });
    const parsed_fields = schema.parse(req.body);
    if (!parsed_fields) {
      return res.status(400).json({ error: 'invalid request body' });
    }
    const { puzzle_id, rating, solution, pgn } = parsed_fields;

    const existing = await prisma.puzzle.findUnique({ where: { puzzle_id } });
    if (existing) {
      return res.status(409).json({ error: 'puzzle with this puzzle_id already exists' });
    }
    
    const puzzle = await prisma.puzzle.create({ data: { puzzle_id, rating, pgn, solution } });

    return res.status(200).json({ message: 'puzzle created', puzzle });
  } catch(error) {
    return res.status(500).json({ error: `error adding puzzle ${error}` });
  }
})

function deriveDateUTC() {
    const now = new Date();
    const date = now.getUTCFullYear() * 10000
        + (now.getUTCMonth() + 1) * 100
        + now.getUTCDate();
    return date;
}

async function verifyTransactionSigner(signature: any, expectedSignerAddress: any) {
  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) {
      console.log("Transaction not found or not confirmed.");
      return false;
    }

    const accountKeys = transaction.transaction.message.accountKeys;
    let isSignedByExpectedSigner = false;

    for (const account of accountKeys) {
      if (account.signer) {
        if (account.pubkey.toBase58() === expectedSignerAddress) {
          isSignedByExpectedSigner = true;
          break; 
        }
      }
    }

    if (isSignedByExpectedSigner) {
      return true;
    } else {
      return false;
    }

  } catch (error) {
    return false;
  }
}

app.post('/api/submit-solver', submitSolverLimiter, async (req: Request, res: Response) => {
    try {
        const schema = z.object({
            wallet_address: z.string(),
            tx_sig: z.string(),
            puzzle_id: z.string(),
        })
        const parsed_fields = schema.parse(req.body);
        if (!parsed_fields) {
            return res.status(400).json({ error: 'invalid request body' });
        }
        const { wallet_address, tx_sig, puzzle_id } = parsed_fields;

        let walletPubkey: PublicKey;
        try {
            walletPubkey = new PublicKey(wallet_address);
        } catch (e) {
            return res.status(400).json({ error: 'wallet_address is not a valid public key' });
        }

        const date = deriveDateUTC();
        const certificatePda = PublicKey.findProgramAddressSync(
            [
                Buffer.from("certificate"),
                walletPubkey.toBuffer(),
                Buffer.from([
                (date >> 24) & 0xff,
                (date >> 16) & 0xff,
                (date >> 8) & 0xff,
                date & 0xff,
                ]),
            ],
            new PublicKey(ANCHOR_PROGRAM_ID)
            )[0];

        const certAccount = await connection.getAccountInfo(certificatePda);
        if (!certAccount) {
            return res.status(400).json({ error: 'no certificate account found for this wallet' });
        }

        const owner = certAccount.data.slice(8, 40);
        if (!owner.equals(walletPubkey.toBytes())) {
            return res.status(400).json({ error: 'certificate account owner does not match wallet_address' });
        } 

        const isValidSigner = await verifyTransactionSigner(tx_sig, wallet_address);

        if (!isValidSigner) {
            return res.status(400).json({ error: 'transaction not signed by wallet_address' });
        }

        const puzzle = await prisma.puzzle.findUnique({ where: { puzzle_id } });
        if (!puzzle) {
            return res.status(404).json({ error: 'puzzle not found' });
        }
        
        let user = await prisma.user.findUnique({where: {wallet_address}})
        if (!user) {
            user = await prisma.user.create({ data: { wallet_address } });
        }

        const already = await prisma.leaderboard.findFirst({ where: { puzzle_id: puzzle.id, user_id: user.id } });
        if (already) {
            return res.status(409).json({ error: 'leaderboard entry already exists for this user on this puzzle' });
        }

        const lb = await prisma.leaderboard.create({ data: { puzzle_id: puzzle.id, user_id: user.id, tx_sig } });

        return res.status(200).json({ message: 'leaderboard updated', leaderboard: lb });
    } catch (error: any) {
        console.error('submit-solver error', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

app.listen(PORT, () => {        
    console.log(`Server is running on port ${PORT}`);
});

export default app;


