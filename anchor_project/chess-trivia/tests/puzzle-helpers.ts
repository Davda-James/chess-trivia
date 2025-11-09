import * as crypto from "crypto";
import { Chess } from "chess.js";

export interface LichessPuzzle {
  game: {
    id: string;
    pgn: string;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    solution: string[];
    themes: string[];
    initialPly: number;
  };
}

/**
 * Parse Lichess puzzle JSON and extract FEN + solution hash
 */
export function parseLichessPuzzle(puzzleData: LichessPuzzle): {
  fen: string;
  solutionMoves: string;
  solutionHash: number[];
} {
  const chess = new Chess();
  
  // Load the game up to the initial puzzle position
  const moves = puzzleData.game.pgn.split(" ");
  const initialPly = puzzleData.puzzle.initialPly;
  
  for (let i = 0; i < initialPly; i++) {
    chess.move(moves[i]);
  }
  
  // Get FEN at puzzle starting position
  const fen = chess.fen();
  
  const solutionMoves = puzzleData.puzzle.solution.join(" ");
  
  // Compute SHA-256 hash
  const solutionHash = Array.from(
    crypto.createHash("sha256").update(solutionMoves).digest()
  );
  
  return {
    fen,
    solutionMoves,
    solutionHash,
  };
}

/**
 * Generate a wrong solution for testing
 */
export function generateWrongSolution(correctSolution: string): string {
  // Just append an extra move to make it wrong
  return correctSolution + " e2e4";
}

/**
 * Convert date to u32 format (YYYYMMDD)
 */
export function dateToU32(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return parseInt(`${year}${month}${day}`);
}
