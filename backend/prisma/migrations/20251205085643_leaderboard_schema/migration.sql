-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "rating" INTEGER,
    "solution" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tx_sig" TEXT NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_address_key" ON "User"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_puzzle_id_key" ON "Puzzle"("puzzle_id");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_tx_sig_key" ON "Leaderboard"("tx_sig");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_puzzle_id_user_id_key" ON "Leaderboard"("puzzle_id", "user_id");

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "Puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
