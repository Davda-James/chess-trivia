import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../../idl/chess_trivia.json';
import { SystemProgram } from '@solana/web3.js';

interface PuzzleCardProps {
  onSolved: () => void;
}

export const PuzzleCard = ({ onSolved }: PuzzleCardProps) => {
  const [moveInput, setMoveInput] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [fenState, setFenState] = useState<string | null>(null);
  const [attemptLimitState, setAttemptLimitState] = useState<number | null>(null);
  const [userAttemptCount, setUserAttemptCount] = useState<number | null>(null);
  const [loadingOnchain, setLoadingOnchain] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [solved, setSolved] = useState(false);
  const [certificateInfo, setCertificateInfo] = useState<{ owner?: string; mint?: string; meta?: string } | null>(null);
  const [certificatePdaState, setCertificatePdaState] = useState<string | null>(null);
  const [showMintBanner, setShowMintBanner] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true;
      const v = window.localStorage.getItem('showMintBanner');
      return v === null ? true : v === 'true';
    } catch (e) {
      return true;
    }
  });

  const { connection } = useConnection();
  const wallet = useWallet();
  const publicKey = wallet.publicKey;

  const deployed_contract_address = idl.address;

  // fallback mock
  const fallbackFen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

  useEffect(() => {
    // Countdown until next UTC midnight (when the next puzzle becomes active)
    function computeTimeLeft() {
      const now = new Date();
      const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diffMs = nextUtcMidnight.getTime() - now.getTime();
      if (diffMs <= 0) return { hours: 0, minutes: 0, seconds: 0 };
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return { hours, minutes, seconds };
    }

    setTimeLeft(computeTimeLeft());
    const id = setInterval(() => setTimeLeft(computeTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('showMintBanner', String(showMintBanner));
    } catch (e) {
      // ignore
    }
  }, [showMintBanner]);

  // Helper: decode Anchor-style Round account (skipping 8-byte discriminator)
  function decodeRoundAccount(data: Uint8Array) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 8; // discriminator
    const date = dv.getUint32(offset, true); offset += 4;
    const strLen = dv.getUint32(offset, true); offset += 4;
    const strBytes = new Uint8Array(data.buffer, data.byteOffset + offset, strLen);
    const fen = new TextDecoder().decode(strBytes); offset += strLen;
    // solution_hash: 32 bytes
    const solutionHash = new Uint8Array(data.buffer, data.byteOffset + offset, 32); offset += 32;
    const attemptLimit = dv.getUint8(offset); offset += 1;
    const bump = dv.getUint8(offset); offset += 1;
    return { date, fen, solutionHash, attemptLimit, bump };
  }

  // Helper: decode UserAttempt account
  function decodeUserAttempt(data: Uint8Array) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 8; // discriminator
    const attempts = dv.getUint8(offset); offset += 1;
    const lastAttemptTs = Number(dv.getBigInt64(offset, true)); offset += 8;
    const bump = dv.getUint8(offset); offset += 1;
    return { attempts, lastAttemptTs, bump };
  }

  // Fetch on-chain round for today's date
  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let initTimeout: ReturnType<typeof setTimeout> | null = null;
    async function fetchRound() {
      setLoadingOnchain(true);
      try {
        const now = new Date();
        const date = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
        // scheduled initialization: cron runs at 00:05 UTC (5 minutes after midnight)
        const INIT_DELAY_MINUTES = 5;
        const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const scheduledInitTs = todayUtcMidnight.getTime() + INIT_DELAY_MINUTES * 60_000;
        const nowTs = now.getTime();
        // If we're before the scheduled init time, wait until the cron runs instead of returning "no round"
        if (nowTs < scheduledInitTs) {
          // schedule a re-fetch just after the cron is expected to run
          const delay = scheduledInitTs - nowTs + 2000; // small buffer (2s)
          if (mounted) {
            setFenState(null);
            // don't treat this as an error; the round will be created by cron shortly
          }
          initTimeout = setTimeout(() => {
            setFetchTrigger((t) => t + 1);
          }, delay);
          return;
        }
        const dateBuf = Uint8Array.of((date >> 24) & 0xff, (date >> 16) & 0xff, (date >> 8) & 0xff, date & 0xff);
        const PROGRAM_ID = new PublicKey(deployed_contract_address);
  const [roundPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('round'), dateBuf], PROGRAM_ID);
        const acc = await connection.getAccountInfo(roundPda);
        if (!acc) {
          // If the scheduled init time has already passed, start polling until the round appears
          if (mounted) setFenState(null);
          // start polling every 30s to pick up the cron-initialized account
          pollInterval = setInterval(async () => {
            try {
              const a = await connection.getAccountInfo(roundPda);
              if (a && mounted) {
                // round now exists — trigger a re-fetch to decode and update UI
                setFetchTrigger((t) => t + 1);
              }
            } catch (e) {
              // ignore transient RPC errors while polling
              console.warn('Polling for round failed', e);
            }
          }, 30_000);
          return;
        }
        const decoded = decodeRoundAccount(new Uint8Array(acc.data));
        if (mounted) {
          setFenState(decoded.fen);
          setAttemptLimitState(decoded.attemptLimit);
          setAttempts(decoded.attemptLimit);
        }

        // If user connected, fetch their UserAttempt
        if (publicKey) {
          const [userAttemptPda] = PublicKey.findProgramAddressSync([
            new TextEncoder().encode('attempt'),
            roundPda.toBuffer(),
            publicKey.toBuffer(),
          ], PROGRAM_ID);
          const ua = await connection.getAccountInfo(userAttemptPda);
            if (ua) {
              const decodedUa = decodeUserAttempt(new Uint8Array(ua.data));
              if (mounted) {
                setUserAttemptCount(decodedUa.attempts);
                // attempts state tracks remaining attempts shown in the UI
                setAttempts(Math.max(0, decoded.attemptLimit - decodedUa.attempts));
              }
            }

          // check if certificate already exists for this user & round
          const [certificatePda] = PublicKey.findProgramAddressSync([
            new TextEncoder().encode('certificate'),
            publicKey.toBuffer(),
            dateBuf,
          ], PROGRAM_ID);
          const certAcc = await connection.getAccountInfo(certificatePda);
          if (certAcc) {
            try {
              const cd = new Uint8Array(certAcc.data);
              let off = 8; // discriminator
              const owner = new PublicKey(cd.slice(off, off + 32)); off += 32;
              const mint = new PublicKey(cd.slice(off, off + 32)); off += 32;
              const metaLen = new DataView(cd.buffer, cd.byteOffset + off, 4).getUint32(0, true); off += 4;
              const meta = new TextDecoder().decode(new Uint8Array(cd.buffer, cd.byteOffset + off, metaLen)); off += metaLen;
              if (mounted) {
                setSolved(true);
                setCertificatePdaState(certificatePda.toBase58());
                setCertificateInfo({ owner: owner.toBase58(), mint: mint.toBase58(), meta });
              }
            } catch (e) {
              console.warn('Failed to decode certificate account in UI', e);
              if (mounted) setSolved(true);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch on-chain round:', e);
      } finally {
        if (mounted) setLoadingOnchain(false);
      }
    }
    fetchRound();
    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, [connection, publicKey, fetchTrigger]);

  const validateUCIFormat = (input: string): boolean => {
    const uciPattern = /^([a-h][1-8][a-h][1-8](\s+[a-h][1-8][a-h][1-8])*)?$/;
    return uciPattern.test(input.trim().toLowerCase());
  };


  // Submit attempt to on-chain program using Anchor
  const submitOnchainAttempt = async (preimage: string) => {
    if (!publicKey) {
      toast.error('Connect your wallet to submit attempts');
      return;
    }

    try {
      const walletForAnchor = {
        publicKey: publicKey,
        signTransaction: wallet.signTransaction?.bind(wallet),
        signAllTransactions: wallet.signAllTransactions?.bind(wallet),
      } as unknown as anchor.Wallet;

      const provider = new anchor.AnchorProvider(connection, walletForAnchor as any, { commitment: 'confirmed' });
      const programId = new PublicKey(deployed_contract_address);
      const program = new anchor.Program(idl as any, provider);

      const now = new Date();
      const date = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
      const dateBuf = Uint8Array.of((date >> 24) & 0xff, (date >> 16) & 0xff, (date >> 8) & 0xff, date & 0xff);
      const [roundPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('round'), dateBuf], programId);
      const [userAttemptPda] = PublicKey.findProgramAddressSync([
        new TextEncoder().encode('attempt'),
        roundPda.toBuffer(),
        publicKey.toBuffer(),
      ], programId);
      const [certificatePda] = PublicKey.findProgramAddressSync([
        new TextEncoder().encode('certificate'),
        publicKey.toBuffer(),
        dateBuf,
      ], programId);

      // derive PDAs and prepare transaction

      setLoadingOnchain(true);

      // Build a transaction instruction for simulation before sending
      const ix = await program.methods.attemptTrivia(preimage).accounts({
        round: roundPda,
        userAttempt: userAttemptPda,
        certificate: certificatePda,
        user: publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction();

      const tx = new anchor.web3.Transaction().add(ix);
      tx.feePayer = publicKey;
      const latest = await connection.getLatestBlockhash();
      tx.recentBlockhash = latest.blockhash;

      // sign with the wallet (most wallets implement signTransaction)
      if (!wallet.signTransaction) {
        toast.error('Your wallet does not support signTransaction. Try another wallet.');
        return;
      }

      let signedTx: anchor.web3.Transaction;
      try {
        signedTx = await wallet.signTransaction(tx);
      } catch (signErr: any) {
        console.error('Wallet signTransaction failed', signErr);
        // common extension issues: disconnected port, service worker problems, or popup blocked
        const signMsg = signErr?.message || String(signErr);
        toast.error('Wallet failed to sign the transaction — try reloading the page or the wallet extension');
        // add a helpful console hint for the user
        console.info('If using Phantom, try disabling/enabling the extension, or open the extension popup and re-approve.');
        return;
      }

      // Simulate the signed transaction and surface logs if it fails
      let sim;
      try {
        sim = await connection.simulateTransaction(signedTx);
      } catch (simErr: any) {
        console.error('simulateTransaction threw', simErr);
        toast.error('Simulation failed due to network or RPC error — check your RPC and try again');
        return;
      }

      if (sim?.value?.err) {
        console.error('Simulation failed with error:', sim.value.err);
        console.error('Program logs:\n', (sim.value.logs || []).join('\n'));
        toast.error('Simulation failed — check console logs for program logs');
        return;
      }

      // Simulation passed — submit the signed transaction for real
      try {
        const raw = signedTx.serialize();
        const sendSig = await connection.sendRawTransaction(raw);
        // confirm using the latest blockhash / height
        await connection.confirmTransaction({ signature: sendSig, ...latest }, 'confirmed');
      } catch (sendErr: any) {
        console.error('sendRawTransaction/confirmTransaction failed', sendErr);
        toast.error('Failed to send or confirm transaction — check console for details');
        return;
      }

      toast.success('Attempt submitted — refreshed state');
      setMoveInput('');
      setFetchTrigger((t) => t + 1);
    } catch (err: any) {
      console.error('Attempt tx failed', err);
      const msg = err?.message ?? String(err);
      toast.error('Submit failed: ' + msg);
    } finally {
      setLoadingOnchain(false);
    }
  };

  const handleSubmit = () => {
    if (!moveInput.trim()) {
      toast.error("Please enter your move!");
      return;
    }

    const formattedInput = moveInput.trim().toLowerCase();
    
    if (!validateUCIFormat(formattedInput)) {
      toast.error("Invalid format! Use UCI notation (e.g., e2e4 e7e5)");
      return;
    }

    // Submit the formatted UCI preimage to the on-chain program. It will validate attempts and create certificate on success.
    submitOnchainAttempt(formattedInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Dismissible banner about minting certificates coming soon */}
      {showMintBanner && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-between">
          <div className="text-sm text-yellow-800 font-semibold">Minting certificates coming soon — stay tuned!</div>
          <div>
            <button
              className="text-yellow-700 font-bold rounded px-2 py-1 hover:bg-yellow-100"
              onClick={() => setShowMintBanner(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Puzzle Info Bar */}
        <div className="flex flex-wrap gap-4 justify-center sm:justify-between items-center text-sm sm:text-base">
          {/* <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-secondary" />
            <span className="font-semibold">Rating: 1450</span>
          </div> */}
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-semibold">Themes: Fork, Pin</span>  
          </div>
          <div className="flex items-center gap-2">
            {solved ? (
              <span className="font-bold text-success">
                Solved — certificate issued{userAttemptCount !== null ? (
                  <span className="font-normal"> (Solved in {userAttemptCount} attempt{userAttemptCount === 1 ? '' : 's'})</span>
                ) : null}
              </span>
            ) : (
              <span className={`font-bold ${attempts <= 1 ? 'text-destructive' : 'text-foreground'}`}>
                Attempts: {attempts}/{attemptLimitState ?? 3}
              </span>
            )}
          </div>
        </div>

      {/* Chess Board */}
      <div className="bg-secondary rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-8 shadow-2xl border-4 border-border">
        <div className="bg-background/10 rounded-xl sm:rounded-2xl p-2 sm:p-4 backdrop-blur-sm">
          <div className="max-w-full flex justify-center">
            <Chessboard 
              id={1}
              position={fenState ?? fallbackFen}
              arePiecesDraggable={false}
              boardWidth={Math.min(500, typeof window !== 'undefined' ? window.innerWidth - 100 : 500)}
              customDarkSquareStyle={{ backgroundColor: '#B58863' }}
              customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
            />
          </div>
        </div>

        {/* Move Input */}
        <div className="mt-6 space-y-3">
          <label className="block text-secondary-foreground font-semibold text-sm sm:text-base">
            Enter your solution (UCI format):
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="e.g., e2e4 e7e5"
              value={moveInput}
              onChange={(e) => setMoveInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={attempts === 0 || solved}
              className="flex-1 bg-input text-foreground rounded-xl border-2 border-border px-4 py-3 text-base font-mono focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={handleSubmit}
              disabled={attempts === 0 || solved}
              className="bg-primary hover:bg-accent text-primary-foreground font-display text-lg sm:text-xl px-6 sm:px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              SUBMIT
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-secondary-foreground/80 italic">
            Hint: Use lowercase letters and spaces between moves (e.g., f3e5 f6d5)
          </p>
        </div>
      </div>

      {/* Certificate info when solved */}
      {solved && certificatePdaState && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-green-900">Certificate awarded</div>
              <div className="text-sm text-green-800">You already have a certificate for today&apos;s puzzle.</div>
            </div>
            <div className="text-right">
              <a
                className="text-sm text-primary underline"
                href={`https://explorer.solana.com/address/${certificatePdaState}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View certificate
              </a>
            </div>
          </div>
          {certificateInfo && (
            <div className="mt-2 text-sm text-muted-foreground">
              <div>Owner: {certificateInfo.owner}</div>
              <div>Mint: {certificateInfo.mint}</div>
              {certificateInfo.meta ? <div>Metadata: {certificateInfo.meta}</div> : null}
            </div>
          )}
        </div>
      )}

      {/* Timer */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 bg-muted rounded-xl px-4 py-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground">
            Next puzzle in {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String((timeLeft as any).seconds ?? 0).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};


