import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Keyboard, Trophy, Zap } from 'lucide-react';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlay = ({ isOpen, onClose }: HowToPlayProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-4 border-border rounded-2xl max-w-2xl max-h-[80vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl sm:text-3xl text-center mb-2">
            ♟️ HOW TO PLAY
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className="bg-card border-2 border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-primary rounded-lg p-3">
                <Target className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-2">Daily Puzzle</h3>
                <p className="text-sm text-muted-foreground">
                  A new chess puzzle is released every 24 hours. Solve it to earn a certificate and climb the leaderboard!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-secondary rounded-lg p-3">
                <Keyboard className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-2">UCI Format</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Enter your moves using Universal Chess Interface (UCI) notation:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="font-mono bg-muted px-3 py-2 rounded">
                    <span className="text-accent font-bold">e2e4</span> - Move piece from e2 to e4
                  </li>
                  <li className="font-mono bg-muted px-3 py-2 rounded">
                    <span className="text-accent font-bold">e2e4 e7e5</span> - Multiple moves separated by spaces
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Use lowercase letters for files (a-h) and numbers for ranks (1-8)
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-accent rounded-lg p-3">
                <Zap className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-2">Attempts</h3>
                <p className="text-sm text-muted-foreground">
                  You have 3 attempts to solve each puzzle. The faster you solve it with fewer attempts, the higher you'll rank on the leaderboard!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-success rounded-lg p-3">
                <Trophy className="w-6 h-6 text-success-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-2">Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Successfully solve a puzzle to earn a blockchain certificate stored on Solana. Connect your wallet to track your achievements!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-primary/20 border-2 border-primary rounded-xl text-center">
          <p className="font-semibold text-sm">
            💡 Pro tip: Study the position carefully before submitting your answer!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
