import { Connection, PublicKey } from '@solana/web3.js';
import ENV from '../src/config/env';
import z from 'zod';
import prisma from '../src/db';

const PORT = ENV.PORT;
const SOLANA_RPC = ENV.SOLANA_RPC;
const ANCHOR_PROGRAM_ID = ENV.ANCHOR_PROGRAM_ID;
const connection = new Connection(SOLANA_RPC, 'confirmed');


// app.post('/api/submit-solver', submitSolverLimiter, async (req: Request, res: Response) => {
// });

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

export default async function handler(req: any, res: any) { 
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
}