import z from 'zod';
import prisma from '../src/db';
import { verifyAdmin } from '../src/middlewares';

// should be only called by admin 
// app.post("/api/add-puzzle", addPuzzleLimiter, verifyAdmin ,async(req: Request, res: Response) => {
// })

export default async function handler(req: any , res: any) {
    try {
        verifyAdmin(req);
    } catch(error) {
        return res.status(403).json({ error: 'Forbidden Route' });
    }
    try {
        const schema = z.object({ 
        puzzle_id: z.string(),
        rating: z.number().optional(),
        fen: z.string(),
        solution: z.array(z.string()),
        });
        const parsed_fields = schema.parse(req.body);
        if (!parsed_fields) {
        return res.status(400).json({ error: 'invalid request body' });
        }
        const { puzzle_id, rating, solution, fen } = parsed_fields;

        const existing = await prisma.puzzle.findUnique({ where: { puzzle_id } });
        if (existing) {
        return res.status(409).json({ error: 'puzzle with this puzzle_id already exists' });
        }
        
        const puzzle = await prisma.puzzle.create({ data: { puzzle_id, rating, fen, solution } });

        return res.status(200).json({ message: 'puzzle created', puzzle });
  } catch(error) {
    return res.status(500).json({ error: `error adding puzzle ${error}` });
  }
}
