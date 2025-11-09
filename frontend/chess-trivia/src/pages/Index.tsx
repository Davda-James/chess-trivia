import { useState } from 'react';
import { WalletProvider } from '@/components/WalletProvider';
import { Header } from '@/components/Header';
import { PuzzleCard } from '@/components/PuzzleCard';
import { BottomNav } from '@/components/BottomNav';
import { SuccessModal } from '@/components/SuccessModal';
import { Leaderboard } from '@/components/Leaderboard';
import { HowToPlay } from '@/components/HowToPlay';

const IndexContent = () => {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight mb-4 text-foreground">
            CAN YOU SOLVE
            <br />
            <span className="text-secondary">TODAY'S CHESS</span>
            <br />
            PUZZLE?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Solve daily puzzles, earn blockchain certificates, and compete for the top spot!
          </p>
        </div>

        {/* Puzzle Section */}
        <PuzzleCard onSolved={() => setIsSuccessModalOpen(true)} />

        {/* Bottom Navigation */}
        <BottomNav
          onLeaderboardClick={() => setIsLeaderboardOpen(true)}
          onHowToPlayClick={() => setIsHowToPlayOpen(true)}
        />
      </main>

      {/* Modals */}
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
      <HowToPlay
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />
    </div>
  );
};

const Index = () => {
  return (
    <WalletProvider>
      <IndexContent />
    </WalletProvider>
  );
};

export default Index;
