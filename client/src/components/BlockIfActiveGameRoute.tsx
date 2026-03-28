import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { userService } from '@/services/userService';
import type { ActiveGameSummary } from '@/services/userService';

interface BlockIfActiveGameRouteProps {
  children: React.ReactNode;
}

const resolveGamePath = (activeGame: ActiveGameSummary | null): string | null => {
  if (!activeGame?.id) return null;
  if (activeGame.game_type === 'ai') return '/ai-game';
  return `/game?id=${activeGame.id}`;
};

const BlockIfActiveGameRoute: React.FC<BlockIfActiveGameRouteProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [activeGame, setActiveGame] = useState<ActiveGameSummary | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const game = await userService.getCurrentActiveGame();
        if (!mounted) return;
        setActiveGame(game);
      } catch (_error) {
        if (!mounted) return;
        setActiveGame(null);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  const redirectPath = useMemo(() => resolveGamePath(activeGame), [activeGame]);

  if (checking) return null;

  if (redirectPath) {
    const samePath = location.pathname === '/ai-game'
      ? redirectPath === '/ai-game'
      : redirectPath.startsWith(location.pathname);

    if (!samePath) {
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

export default BlockIfActiveGameRoute;

