import { Connection, PublicKey } from '@solana/web3.js';

function hex(b) { return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join(''); }

(async () => {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const PROGRAM_ID = new PublicKey('DyjfXwMRPQRTUzMt7RKgtXxba7rNo7VU7YZGrABMYft4');
  const userPub = new PublicKey(process.argv[2] || 'your_public_key'); 

  const now = new Date();
  const date = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  const dateBuf = Buffer.from([ (date >> 24) & 0xff, (date >> 16) & 0xff, (date >> 8) & 0xff, date & 0xff ]);

  const [roundPda] = PublicKey.findProgramAddressSync([Buffer.from('round'), dateBuf], PROGRAM_ID);
  const [userAttemptPda] = PublicKey.findProgramAddressSync([Buffer.from('attempt'), roundPda.toBuffer(), userPub.toBuffer()], PROGRAM_ID);
  const [certificatePda] = PublicKey.findProgramAddressSync([Buffer.from('certificate'), userPub.toBuffer(), dateBuf], PROGRAM_ID);

  console.log('roundPda:', roundPda.toBase58());
  console.log('userAttemptPda:', userAttemptPda.toBase58());
  console.log('certificatePda:', certificatePda.toBase58());

  const ua = await connection.getAccountInfo(userAttemptPda);
  if (!ua) console.log('UserAttempt: not found (0 attempts)');
  else {
    const d = Buffer.from(ua.data);
    let off = 8;
    const attempts = d.readUInt8(off); off += 1;
    const lastTs = Number(d.readBigInt64LE(off)); off += 8;
    const bump = d.readUInt8(off);
    console.log('UserAttempt -> attempts used:', attempts, 'lastAttemptTs:', lastTs, 'bump:', bump);
  }

  const cert = await connection.getAccountInfo(certificatePda);
  if (!cert) {
    console.log('Certificate: not found (user has not been awarded a certificate yet)');
  } else {
    console.log('Certificate exists: lamports:', cert.lamports, 'data len:', cert.data.length);
    const cd = Buffer.from(cert.data);
    // skip discriminator
    let off = 8;
    const owner = new PublicKey(cd.slice(off, off+32)); off += 32;
    const mint = new PublicKey(cd.slice(off, off+32)); off += 32;
    const metaLen = cd.readUInt32LE(off); off += 4;
    const meta = cd.slice(off, off+metaLen).toString('utf8'); off += metaLen;
    const ts = Number(cd.readBigInt64LE(off)); off += 8;
    console.log('Certificate decoded -> owner:', owner.toBase58(), 'mint:', mint.toBase58(), 'meta_uri:', meta, 'timestamp:', ts);
  }
})();