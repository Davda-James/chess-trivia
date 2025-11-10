import dotenv from 'dotenv';
dotenv.config();

import * as anchor from '@coral-xyz/anchor';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const idlPath = path.resolve(__dirname, '..', 'target', 'idl', 'chess_trivia.json');
const idlString = fs.readFileSync(idlPath, 'utf8');
const idl = JSON.parse(idlString);

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const ADMIN_KEYPAIR_B64 = process.env.ADMIN_KEYPAIR_B64 || '';

if (!ADMIN_KEYPAIR_B64) {
  console.error('Missing ADMIN_KEYPAIR_B64 env var');
  process.exit(1);
}

const ADMIN_JSON = Buffer.from(ADMIN_KEYPAIR_B64, 'base64').toString('utf8');
const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(ADMIN_JSON)));

const connection = new Connection(RPC, 'confirmed');
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair) as any, { commitment: 'confirmed' });
anchor.setProvider(provider);

const programId = new PublicKey(idl.address);
const program = new anchor.Program(idl as any, provider as any);

async function main() {
  console.log('Admin pubkey:', adminKeypair.publicKey.toBase58());
  console.log('Program ID:', programId.toBase58());

  // Derive config PDA
  const [configPda, bump] = await PublicKey.findProgramAddress(
    [Buffer.from('config')],
    programId
  );
  
  console.log('Config PDA:', configPda.toBase58());

  // Check if config exists
  try {
    const configAccount = await (program as any).account.config.fetch(configPda);
    console.log('Config already initialized!');
    console.log('Admin:', (configAccount as any).admin.toBase58());
    console.log('Server:', (configAccount as any).server.toBase58());
    console.log('Bump:', (configAccount as any).bump);
  } catch (e) {
    console.log('Config not initialized. Initializing now...');
    
    // Use admin as server for now (you can change this)
    const serverPubkey = adminKeypair.publicKey;
    
    try {
      const tx = await program.methods
        .initialize(serverPubkey)
        .accounts({
          config: configPda,
          admin: adminKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      console.log('Config initialized!');
      console.log('Transaction:', tx);
      console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      
      // Fetch and display config
      const configAccount = await (program as any).account.config.fetch(configPda);
      console.log('\nConfig details:');
      console.log('  Admin:', (configAccount as any).admin.toBase58());
      console.log('  Server:', (configAccount as any).server.toBase58());
      console.log('  Bump:', (configAccount as any).bump);
    } catch (initError) {
      console.error('Failed to initialize config:', initError);
      process.exit(1);
    }
  }
}   

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
