import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Award, X } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuccessModal = ({ isOpen, onClose }: SuccessModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-4 border-border rounded-2xl max-w-md p-8">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-center mb-4">
            <div className="flex justify-center mb-4">
              <div className="bg-success rounded-full p-4 animate-bounce">
                <Trophy className="w-16 h-16 text-success-foreground" />
              </div>
            </div>
            PUZZLE SOLVED!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 text-center">
          <div className="bg-primary/20 rounded-xl p-6 border-2 border-primary">
            <Award className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-display text-xl text-foreground mb-2">
              🎉 Certificate Earned!
            </p>
            <p className="text-sm text-muted-foreground">
              Your achievement has been recorded on the blockchain
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time:</span>
              <span className="font-bold">2m 34s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts:</span>
              <span className="font-bold">1/3</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rating:</span>
              <span className="font-bold">1450</span>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full bg-primary hover:bg-accent text-primary-foreground font-display text-xl py-6 rounded-xl shadow-lg transition-all hover:scale-105"
          >
            AWESOME!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
