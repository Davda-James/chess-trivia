import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Trophy } from 'lucide-react';

export const Header = () => {
  return (
    <header className="w-full py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-secondary p-2 rounded-xl">
            <Trophy className="w-6 h-6 text-secondary-foreground" />
          </div>
          <span className="font-display text-xl sm:text-2xl text-foreground">
            PUZZLE<span className="text-secondary">RUSH</span>
          </span>
        </div>
        <WalletMultiButton className="!bg-primary hover:!bg-accent !rounded-xl !font-sans !font-semibold !text-primary-foreground !h-12 !px-6 transition-colors" />
      </div>
    </header>
  );
};
