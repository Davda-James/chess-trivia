// import express from 'express';
// import type { Request, Response } from 'express';
// import dotenv from 'dotenv';
// import prisma from './db';
// import axios from 'axios';
// import * as z from 'zod';
// import { Connection, PublicKey } from '@solana/web3.js';
// import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
// import { verifyAdmin } from './middlewares/index';
// import cors from 'cors';
// import ENV from './config/env';

// const submitSolverLimiter = rateLimit({
//   windowMs: 60 * 1000, 
//   max: 3, 
//   keyGenerator: (req: any) => req.body.wallet_address || ipKeyGenerator(req),
//   handler: (_, res: Response) => {
//     res.status(429).json({ error: 'Too many submissions. Please wait before trying again.' });
//   },
// });

// const addPuzzleLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, 
//   max: 5, 
//   handler: (_, res: Response) => {
//     res.status(429).json({ error: 'Too many requests from this IP.' });
//   },
// }); 

// const globalLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, 
//   max: 50, 
//   handler: (_, res: Response) => {
//     res.status(429).json({ error: 'Too many requests from this IP.' });
//   },
// });

// dotenv.config();

// const PORT = ENV.PORT;
// const SOLANA_RPC = ENV.SOLANA_RPC;
// const ANCHOR_PROGRAM_ID = ENV.ANCHOR_PROGRAM_ID;
// const connection = new Connection(SOLANA_RPC, 'confirmed');

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));    
// app.use(globalLimiter);

// app.get("/health", (req: Request, res: Response) => {
//   res.status(200).json({ status: "ok"});
// });





// app.listen(PORT, () => {        
//     console.log(`Server is running on port ${PORT}`);
// });

// export default app;


