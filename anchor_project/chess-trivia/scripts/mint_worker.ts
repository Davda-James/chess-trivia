import dotenv from 'dotenv';
dotenv.config();

import * as anchor from '@coral-xyz/anchor';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, signerIdentity, some, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { base58 } from '@metaplex-foundation/umi/serializers';
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const idlPath = path.resolve(__dirname, '..', 'idl', 'chess_trivia.json');
const idlString = fs.readFileSync(idlPath, 'utf8');
let idl;
try{
    idl = JSON.parse(idlString);
} catch (e) {
    console.error("Failed to parse IDL JSON:", e);
    process.exit(1);
} 

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const ADMIN_KEYPAIR_B64 = process.env.ADMIN_KEYPAIR_B64 || '';

const POLL_INTERVAL_MS = Number(process.env.MINT_WORKER_POLL_MS || 30_000);

if (!ADMIN_KEYPAIR_B64) {
  console.error('Missing ADMIN_KEYPAIR_B64 env var (base64-encoded keypair JSON)');
  process.exit(1);
}

const ADMIN_JSON = Buffer.from(ADMIN_KEYPAIR_B64, 'base64').toString('utf8');
const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(ADMIN_JSON)));

const connection = new Connection(RPC, 'confirmed');
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair) as any, { commitment: 'confirmed' });
anchor.setProvider(provider);

const programId = new PublicKey(idl.address);
const program = new anchor.Program(idl as any, provider as any);

// Initialize Umi
const umi = createUmi(RPC);
const umiKeypair = fromWeb3JsKeypair(adminKeypair);
const umiSigner = createSignerFromKeypair(umi, umiKeypair);
umi.use(signerIdentity(umiSigner)).use(mplTokenMetadata());

const FILEBASE_S3_KEY = (process.env.FILEBASE_ACCESS_KEY || '').trim();
const FILEBASE_S3_SECRET = (process.env.FILEBASE_ACCESS_KEY_SECRET || '').trim();
const FILEBASE_BUCKET = (process.env.FILEBASE_BUCKET || '').trim();
const FILEBASE_S3_ENDPOINT = (process.env.FILEBASE_S3_ENDPOINT || 'https://s3.filebase.com').trim();

if (!FILEBASE_S3_KEY || !FILEBASE_S3_SECRET || !FILEBASE_BUCKET) {
  console.error('Missing Filebase S3 configuration. Please set FILEBASE_S3_KEY, FILEBASE_S3_SECRET and FILEBASE_BUCKET.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: FILEBASE_S3_ENDPOINT,
  credentials: { accessKeyId: FILEBASE_S3_KEY, secretAccessKey: FILEBASE_S3_SECRET },
});

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function uploadMetadata(metadata: { name: string; description: string; image?: string }) {
  try {
    const metadataJson = JSON.stringify({ name: metadata.name, description: metadata.description });
    const key = `chess-trivia/metadata-${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
    const cmd = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: key,
      Body: Buffer.from(metadataJson, 'utf8'),
      ContentType: 'application/json',
    });
    await s3.send(cmd);
    // public URL pattern for Filebase S3
    const publicUrl = `${FILEBASE_S3_ENDPOINT.replace(/\/+$/,'')}/${FILEBASE_BUCKET}/${encodeURIComponent(key)}`;
    return publicUrl;
  } catch (e) {
    console.error('Failed to upload metadata to Filebase S3', (e as any)?.message || e);
    if ((e as any)?.$response) console.error('Response data:', (e as any).$response);
    throw e;
  }
}

async function createAndMintNFT(owner: PublicKey, metadataUri: string, name: string, symbol = 'CHT') {
  // Generate a new mint signer
  const mint = generateSigner(umi);
  
  console.log('Creating NFT with Umi...');
  
  // Use createNft which handles mint creation, metadata, and initial token in one transaction
  const tx = await createNft(umi, {
    mint,
    name: name.substring(0, 32),
    symbol: symbol.substring(0, 10),
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    decimals: some(0), 
    tokenOwner: fromWeb3JsPublicKey(owner), 
  }).sendAndConfirm(umi);

  const signature = base58.deserialize(tx.signature)[0];
  console.log(`NFT created: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  
  return new PublicKey(mint.publicKey);
}

async function processCertificatesOnce() {
  console.log('Fetching certificate accounts...');
  const allCerts = await (program as any).account.certificate.all();
  for (const c of allCerts) {
    try {
      const cert = c.account as any;
      const certPda = c.publicKey;
      // cert.mint is a PublicKey object in account data
      const mintKey = new PublicKey(cert.mint);
      const ownerKey = new PublicKey(cert.owner);
      const defaultPub = PublicKey.default;
      
      if (ownerKey.equals(defaultPub)) {
        console.log('Skipping certificate with default owner:', certPda.toBase58());
        continue;
      }
      
      if (mintKey.equals(defaultPub)) {
        console.log('Found unminted certificate:', certPda.toBase58(), 'owner=', cert.owner.toString());

        // Build metadata
        const name = `ChessTrivia Certificate ${certPda.toBase58().slice(0, 8)}`;
        const description = `Certificate for solving puzzle on date ${cert.date}`;

        const metadataUri = await uploadMetadata({ name, description });
        console.log('Uploaded metadata:', metadataUri);

        // create and mint NFT
        const mint = await createAndMintNFT(new PublicKey(cert.owner), metadataUri, name);
        console.log('Created mint', mint.toBase58());

        // call register_certificate_mint on-chain
        const tx = await program.methods
          .registerCertificateMint(mint)
          .accounts({
            certificate: certPda,
            // use the explicit programId derived from the IDL instead of relying on program.programId typing
            config: (await PublicKey.findProgramAddress([Buffer.from('config')], programId))[0],
            admin: adminKeypair.publicKey,
          })
          .rpc();
        console.log('registerCertificateMint tx', tx);
      }
    } catch (e) {
      console.error('Failed processing certificate', c.publicKey.toBase58(), e);
    }
  }
}
async function main() {
  // If POLL_INTERVAL_MS is 0, run once and exit (for CI/CD)
  if (POLL_INTERVAL_MS === 0) {
    console.log('Running mint worker once as workflow runs it every 5 minutes');
    try {
      await processCertificatesOnce();
      console.log('Mint worker completed successfully');
      process.exit(0);
    } catch (e) {
      console.error('Mint worker failed:', e);
      process.exit(1);
    }
  }

  // Continuous polling mode (for local/server deployment)
  // console.log('Starting mint worker — polling every', POLL_INTERVAL_MS, 'ms');
  // while (true) {
  //   try {
  //     await processCertificatesOnce();
  //   } catch (e) {
  //     console.error('Worker run failed', e);
  //   }
  //   await sleep(POLL_INTERVAL_MS);
  // }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
