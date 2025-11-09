import { Connection, PublicKey } from '@solana/web3.js';

function bufToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join(''); }

(async () => {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const PROGRAM_ID = new PublicKey('DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4');

  // compute today's date in UTC the same way as the frontend
  const now = new Date();
  const date = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  const dateBuf = Buffer.from([ (date >> 24) & 0xff, (date >> 16) & 0xff, (date >> 8) & 0xff, date & 0xff ]);

  const [roundPda] = PublicKey.findProgramAddressSync([Buffer.from('round'), dateBuf], PROGRAM_ID);
  console.log('Round PDA:', roundPda.toBase58());

  const acc = await connection.getAccountInfo(roundPda);
  if (!acc) {
    console.log('Round account NOT found');
    return;
  }
  console.log('lamports:', acc.lamports, 'data length:', acc.data.length);

  const data = Buffer.from(acc.data);
  console.log('first bytes (hex):', bufToHex(data.slice(0, 64)));

  // decode per the frontend layout (skip 8-byte discriminator)
  let offset = 8;
  const dateVal = data.readUInt32LE(offset); offset += 4;
  const strLen = data.readUInt32LE(offset); offset += 4;
  const fen = data.slice(offset, offset + strLen).toString('utf8'); offset += strLen;
  const solutionHash = data.slice(offset, offset + 32); offset += 32;
  const attemptLimit = data.readUInt8(offset); offset += 1;
  const bump = data.readUInt8(offset); offset += 1;

  console.log('decoded date:', dateVal);
  console.log('fen length:', strLen, 'fen:', fen);
  console.log('solution_hash (hex):', bufToHex(solutionHash));
  console.log('attemptLimit:', attemptLimit, 'bump:', bump);
})();