import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  solveTime: string;
  attempts: number;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, wallet: "9xQe...7kL2", solveTime: "1m 23s", attempts: 1 },
  { rank: 2, wallet: "4mPt...3nB5", solveTime: "1m 47s", attempts: 1 },
  { rank: 3, wallet: "8hYu...2qW9", solveTime: "2m 05s", attempts: 2 },
  { rank: 4, wallet: "5jRt...6vC3", solveTime: "2m 34s", attempts: 1 },
  { rank: 5, wallet: "7nKp...4xZ8", solveTime: "3m 12s", attempts: 2 },
  { rank: 6, wallet: "2bVf...9sM1", solveTime: "3m 45s", attempts: 2 },
  { rank: 7, wallet: "6wLq...5tN4", solveTime: "4m 01s", attempts: 3 },
  { rank: 8, wallet: "3dHj...7pR6", solveTime: "4m 28s", attempts: 3 },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-6 h-6 text-yellow-500" />;
    case 2:
      return <Medal className="w-6 h-6 text-gray-400" />;
    case 3:
      return <Award className="w-6 h-6 text-amber-700" />;
    default:
      return <span className="font-bold text-lg">{rank}</span>;
  }
};

export const Leaderboard = ({ isOpen, onClose }: LeaderboardProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-4 border-border rounded-2xl max-w-2xl max-h-[80vh] overflow-y-auto p-6 sm:p-8">
        <div className="mb-4 inline-block px-3 py-1 rounded-full text-center bg-yellow-50 text-yellow-800 font-semibold">Coming Soon</div>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl sm:text-3xl text-center mb-2">
            🏆 LEADERBOARD
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Today's fastest solvers
          </p>
        </DialogHeader>
        
        <div className="space-y-3 mt-6">
          {mockLeaderboard.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                entry.rank <= 3
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div>
                  <p className="font-mono font-bold text-base sm:text-lg">
                    {entry.wallet}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {entry.attempts} attempt{entry.attempts > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-base sm:text-lg">{entry.solveTime}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet and solve today's puzzle to appear on the leaderboard!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
