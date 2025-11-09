import { Button } from '@/components/ui/button';
import { Trophy, HelpCircle, Target } from 'lucide-react';

interface BottomNavProps {
  onLeaderboardClick: () => void;
  onHowToPlayClick: () => void;
}

export const BottomNav = ({ onLeaderboardClick, onHowToPlayClick }: BottomNavProps) => {
  return (
    <nav className="w-full max-w-2xl mx-auto mt-12 mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button
          variant="outline"
          className="bg-card hover:bg-muted border-2 border-border rounded-xl py-6 flex items-center justify-center gap-2 font-semibold text-base transition-all hover:scale-105"
        >
          <Target className="w-5 h-5" />
          Daily Puzzle
        </Button>
        <Button
          variant="outline"
          onClick={onLeaderboardClick}
          className="bg-card hover:bg-muted border-2 border-border rounded-xl py-6 flex items-center justify-center gap-2 font-semibold text-base transition-all hover:scale-105"
        >
          <Trophy className="w-5 h-5" />
          Leaderboard
        </Button>
        <Button
          variant="outline"
          onClick={onHowToPlayClick}
          className="bg-card hover:bg-muted border-2 border-border rounded-xl py-6 flex items-center justify-center gap-2 font-semibold text-base transition-all hover:scale-105"
        >
          <HelpCircle className="w-5 h-5" />
          How to Play
        </Button>
      </div>
    </nav>
  );
};
