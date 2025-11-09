import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { ChessTrivia } from "../target/types/chess_trivia";
import { expect } from "chai";
import * as crypto from "crypto";
import { parseLichessPuzzle, generateWrongSolution, dateToU32 } from "./puzzle-helpers";
import * as fs from "fs";
import * as path from "path";

const puzzleData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "puzzle-data.json"), "utf8")
);

describe("chess-trivia", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ChessTrivia as Program<ChessTrivia>;
  
  // Keypair test accounts required
  const admin = provider.wallet as anchor.Wallet;
  const server = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  
  // PDAs
  let configPda: PublicKey;
  let configBump: number;
  
  // Helper function to derive Config PDA
  function getConfigPda() {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    return { pda, bump };
  }
  
  // Helper function to derive Round PDA
  function getRoundPda(date: number) {
    const dateBuffer = Buffer.alloc(4);
    dateBuffer.writeUInt32BE(date, 0);
    
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), dateBuffer],
      program.programId
    );
    return { pda, bump };
  }
  
  // Helper function to derive UserAttempt PDA
  function getUserAttemptPda(roundPda: PublicKey, userPubkey: PublicKey) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("attempt"), roundPda.toBuffer(), userPubkey.toBuffer()],
      program.programId
    );
    return { pda, bump };
  }
  
  // Helper function to derive Certificate PDA
  function getCertificatePda(userPubkey: PublicKey, date: number) {
    const dateBuffer = Buffer.alloc(4);
    dateBuffer.writeUInt32BE(date, 0);
    
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("certificate"), userPubkey.toBuffer(), dateBuffer],
      program.programId
    );
    return { pda, bump };
  }
  
  // Helper function to compute SHA-256 hash
  function computeSolutionHash(solution: string): number[] {
    return Array.from(crypto.createHash("sha256").update(solution).digest());
  }
  
  // Helper function to airdrop SOL
  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  }

  before(async () => {
    // Airdrop SOL to test users
    await airdrop(user1.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await airdrop(user2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Get config PDA
    const config = getConfigPda();
    configPda = config.pda;
    configBump = config.bump;
  });

  describe("Initialization", () => {
    it("Initializes the config successfully", async () => {
      const tx = await program.methods
        .initialize(server.publicKey)
        .accounts({
          config: configPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Config initialized:", tx);

      // Fetch and verify config account
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.admin.toString()).to.equal(admin.publicKey.toString());
      expect(configAccount.server.toString()).to.equal(server.publicKey.toString());
      expect(configAccount.bump).to.equal(configBump);
    });

    it("Fails to initialize config twice", async () => {
      try {
        await program.methods
          .initialize(server.publicKey)
          .accounts({
            config: configPda,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).to.exist;
        console.log("Correctly prevented duplicate config initialization");
      }
    });
  });

  describe("Round Creation", () => {
    const testDate = 20251108; // YYYYMMDD format
    const testFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const correctSolution = "e2e4 e7e5"; // Example solution
    const solutionHash = computeSolutionHash(correctSolution);
    let roundPda: PublicKey;

    it("Admin initializes a round successfully", async () => {
      const round = getRoundPda(testDate);
      roundPda = round.pda;

      const tx = await program.methods
        .initializeRound(testDate, testFen, solutionHash, 3)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Round initialized:", tx);

      // Fetch and verify round
      const roundAccount = await program.account.round.fetch(roundPda);
      expect(roundAccount.date).to.equal(testDate);
      expect(roundAccount.fen).to.equal(testFen);
      expect(roundAccount.attemptLimit).to.equal(3);
      expect(Array.from(roundAccount.solutionHash)).to.deep.equal(solutionHash);
    });

    it("Fails to initialize same round twice", async () => {
      try {
        await program.methods
          .initializeRound(testDate, testFen, solutionHash, 3)
          .accounts({
            round: roundPda,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).to.exist;
        console.log("Correctly prevented duplicate round creation");
      }
    });
  });

  describe("Submit Attempts", () => {
    const testDate = 20251109;
    const testFen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const correctSolution = "f1c4 g8f6 f3g5"; // Example puzzle solution
    const solutionHash = computeSolutionHash(correctSolution);
    let roundPda: PublicKey;

    before(async () => {
      // Create round for this test
      const round = getRoundPda(testDate);
      roundPda = round.pda;

      await program.methods
        .initializeRound(testDate, testFen, solutionHash, 3)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it("User submits correct solution and receives certificate", async () => {
      const userAttempt = getUserAttemptPda(roundPda, user1.publicKey);
      const certificate = getCertificatePda(user1.publicKey, testDate);

      const tx = await program.methods
        .attemptTrivia(correctSolution)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: user1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc(); 

      console.log("User1 solved puzzle:", tx);

      // Verify user attempt
      const attemptAccount = await program.account.userAttempt.fetch(userAttempt.pda);
      expect(attemptAccount.attempts).to.equal(1);
      expect(attemptAccount.lastAttemptTs.toNumber()).to.be.greaterThan(0);

      // Verify certificate was created
      const certAccount = await program.account.certificate.fetch(certificate.pda);
      expect(certAccount.owner.toString()).to.equal(user1.publicKey.toString());
      expect(certAccount.timestamp.toNumber()).to.be.greaterThan(0);
      console.log("Certificate issued to user1");
    });

    it("Second user can also solve the same puzzle", async () => {
      const userAttempt = getUserAttemptPda(roundPda, user2.publicKey);
      const certificate = getCertificatePda(user2.publicKey, testDate);

      const tx = await program.methods
        .attemptTrivia(correctSolution)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: user2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("User2 solved puzzle:", tx);

      // Verify certificate
      const certAccount = await program.account.certificate.fetch(certificate.pda);
      expect(certAccount.owner.toString()).to.equal(user2.publicKey.toString());
      console.log("Certificate issued to user2");
    });
  });

  describe("Submit Attempts - Attempt Limits", () => {
    const testDate = 20251110;
    const testFen = "8/8/8/8/8/8/8/4K2R w K - 0 1";
    const correctSolution = "e1g1"; // Castling
    const wrongSolution1 = "e1f1";
    const wrongSolution2 = "e1d1";
    const solutionHash = computeSolutionHash(correctSolution);
    let roundPda: PublicKey;
    const testUser = Keypair.generate();

    before(async () => {
      // Airdrop to test user
      await airdrop(testUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

      // Create round with attempt_limit = 2
      const round = getRoundPda(testDate);
      roundPda = round.pda;

      await program.methods
        .initializeRound(testDate, testFen, solutionHash, 2)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it("User submits first wrong attempt", async () => {
      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      await program.methods
        .attemptTrivia(wrongSolution1)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Verify attempt count
      const attemptAccount = await program.account.userAttempt.fetch(userAttempt.pda);
      expect(attemptAccount.attempts).to.equal(1);
      console.log("First attempt recorded (1/2)");
    });

    it("User submits second wrong attempt", async () => {
      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      await program.methods
        .attemptTrivia(wrongSolution2)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Verify attempt count
      const attemptAccount = await program.account.userAttempt.fetch(userAttempt.pda);
      expect(attemptAccount.attempts).to.equal(2);
      // console.log("Second attempt recorded (2/2)");
    });

    it("Third attempt fails with AttemptLimitExceeded", async () => {
      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      try {
        await program.methods
          .attemptTrivia(correctSolution)
          .accounts({
            round: roundPda,
            userAttempt: userAttempt.pda,
            certificate: certificate.pda,
            user: testUser.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([testUser])
          .rpc();
        expect.fail("Should have thrown AttemptLimitExceeded error");
      } catch (err: any) {
        expect(err.error.errorMessage).to.include("Attempt limit exceeded");
        // console.log("Correctly rejected third attempt");
      }
    });
  });

  describe("Submit Attempts - Duplicate Prevention", () => {
    const testDate = 20251111;
    const testFen = "8/8/8/8/8/8/8/R3K3 w Q - 0 1";
    const correctSolution = "e1c1"; // Queen-side castling
    const solutionHash = computeSolutionHash(correctSolution);
    let roundPda: PublicKey;
    const testUser = Keypair.generate();

    before(async () => {
      await airdrop(testUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

      const round = getRoundPda(testDate);
      roundPda = round.pda;

      await program.methods
        .initializeRound(testDate, testFen, solutionHash, 5)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // First successful attempt
      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      await program.methods
        .attemptTrivia(correctSolution)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();
      
      // console.log("User received certificate on first attempt");
    });

    it("Second correct submission fails with CertificateAlreadyExists", async () => {
      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      try {
        await program.methods
          .attemptTrivia(correctSolution)
          .accounts({
            round: roundPda,
            userAttempt: userAttempt.pda,
            certificate: certificate.pda,
            user: testUser.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([testUser])
          .rpc();
        expect.fail("Should have thrown CertificateAlreadyExists error");
      } catch (err: any) {
        expect(err.error.errorMessage).to.include("Certificate already exists");
        // console.log("Correctly prevented duplicate certificate");
      }
    });
  });

  describe("Hash Verification", () => {
    const testDate = 20251112;
    const testFen = "8/8/8/8/8/8/8/8 w - - 0 1";
    const correctSolution = "test solution";
    const wrongSolution = "wrong solution";
    const solutionHash = computeSolutionHash(correctSolution);
    let roundPda: PublicKey;

    before(async () => {
      const round = getRoundPda(testDate);
      roundPda = round.pda;

      await program.methods
        .initializeRound(testDate, testFen, solutionHash, 3)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it("Wrong solution does not create certificate", async () => {
      const testUser = Keypair.generate();
      await airdrop(testUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      await program.methods
        .attemptTrivia(wrongSolution)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Attempt should be recorded
      const attemptAccount = await program.account.userAttempt.fetch(userAttempt.pda);
      expect(attemptAccount.attempts).to.equal(1);

      // Certificate should have default owner (not initialized properly)
      const certAccount = await program.account.certificate.fetch(certificate.pda);
      expect(certAccount.owner.toString()).to.equal(PublicKey.default.toString());
      // console.log("Wrong solution did not issue certificate");
    });
  });

  describe("Real Lichess Puzzle Integration", () => {
    const puzzle = parseLichessPuzzle(puzzleData as any);
    const testDate = 20251215; // Fixed date: Dec 15, 2025
    let roundPda: PublicKey;

    it("Initializes round with real Lichess puzzle", async () => {
      const round = getRoundPda(testDate);
      roundPda = round.pda;

      // console.log("Puzzle FEN:", puzzle.fen);
      // console.log("Solution:", puzzle.solutionMoves);
      // console.log("Rating:", puzzleData.puzzle.rating);
      // console.log("Themes:", puzzleData.puzzle.themes.join(", "));

      const tx = await program.methods
        .initializeRound(testDate, puzzle.fen, puzzle.solutionHash, 3)
        .accounts({
          round: roundPda,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Real Lichess puzzle initialized:", tx);

      const roundAccount = await program.account.round.fetch(roundPda);
      expect(roundAccount.fen).to.equal(puzzle.fen);
    });

    it("User solves the Lichess puzzle correctly", async () => {
      const testUser = Keypair.generate();
      await airdrop(testUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      console.log("Submitting solution:", puzzle.solutionMoves);

      const tx = await program.methods
        .attemptTrivia(puzzle.solutionMoves)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // console.log("User solved Lichess puzzle:", tx);

      // Verify certificate was issued
      const certAccount = await program.account.certificate.fetch(certificate.pda);
      expect(certAccount.owner.toString()).to.equal(testUser.publicKey.toString());
      expect(certAccount.timestamp.toNumber()).to.be.greaterThan(0);
      // console.log("Certificate issued at:", new Date(certAccount.timestamp.toNumber() * 1000));
    });

    it("Wrong solution for Lichess puzzle fails", async () => {
      const testUser = Keypair.generate();
      await airdrop(testUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

      const userAttempt = getUserAttemptPda(roundPda, testUser.publicKey);
      const certificate = getCertificatePda(testUser.publicKey, testDate);

      const wrongSolution = generateWrongSolution(puzzle.solutionMoves);
      // console.log("Submitting wrong solution:", wrongSolution);

      await program.methods
        .attemptTrivia(wrongSolution)
        .accounts({
          round: roundPda,
          userAttempt: userAttempt.pda,
          certificate: certificate.pda,
          user: testUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // No certificate should be issued
      const certAccount = await program.account.certificate.fetch(certificate.pda);
      expect(certAccount.owner.toString()).to.equal(PublicKey.default.toString());
      
      // Attempt should still be recorded
      const attemptAccount = await program.account.userAttempt.fetch(userAttempt.pda);
      expect(attemptAccount.attempts).to.equal(1);
      // console.log("Wrong solution correctly rejected");
    });
  });
});

