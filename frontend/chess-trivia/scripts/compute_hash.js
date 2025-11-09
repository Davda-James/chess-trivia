import crypto from 'crypto';

const preimage = process.argv.slice(2).join(' ') || 'e1e8 g6h6 h5f5 f6f5 g4f5';
const hash = crypto.createHash('sha256').update(preimage, 'utf8').digest('hex');
console.log('preimage:', JSON.stringify(preimage));
console.log('sha256:', hash);
