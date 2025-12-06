import dotenv from 'dotenv';
dotenv.config();

const ENV = {
    DATABASE_URL: process.env.DATABASE_URL!,
    PORT: process.env.PORT!,
    SOLANA_RPC: process.env.SOLANA_RPC!,
    ANCHOR_PROGRAM_ID: process.env.ANCHOR_PROGRAM_ID!,
    ADMIN_SECRET: process.env.ADMIN_SECRET!,
};

export default ENV;
