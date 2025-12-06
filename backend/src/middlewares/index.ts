import type { Request, Response, NextFunction } from 'express'
import ENV  from '../config/env';

const adminSecret = ENV.ADMIN_SECRET;

// export function verifyAdmin(req: Request, res: Response, next: NextFunction) {
    // const secret = req.headers.authorization;
    // if (secret !== `Bearer ${adminSecret}`) {
        // return res.status(403).json({ error: 'Forbidden Route' });
        // throw new Error('Forbidden Route');
    // }
    // next();
// }

export function verifyAdmin(req: any) {
    const secret = req.headers.authorization;

    if (secret !== `Bearer ${adminSecret}`) {
        throw new Error('Forbidden Route');
    }
}