import prisma from '../src/db';
// app.get("/api/leaderboard", async (req: Request, res: Response) => {
// })

export default async function handler(req: any, res: any) {
  try {
    const leaderboard = await prisma.leaderboard.findMany({
      orderBy: {
        solved_at : 'asc'
      },
      select: {
        user: {
          select: {
            wallet_address: true,
          }
        }
      }
    });
    res.status(200).json({ leaderboard });
  } catch(error) {
    res.status(500).json({ error: "error fetching leaderboard" });
  }
}