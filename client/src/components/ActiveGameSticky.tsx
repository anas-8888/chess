import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, XCircle, Swords } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ActiveGameSummary, userService } from '@/services/userService';

const PLAY_PAGES = ['/game', '/ai-game', '/ai-loading', '/play', '/puzzle'];

const GAME_TYPE_LABELS: Record<string, string> = {
  ai: 'ضد الذكاء الاصطناعي',
  friend: 'مباراة مع صديق',
  online: 'مباراة أونلاين',
  quick: 'مباراة سريعة',
};

const ActiveGameSticky: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeGame, setActiveGame] = useState<ActiveGameSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const shouldHide = useMemo(() => {
    if (!isAuthenticated) return true;
    return PLAY_PAGES.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  }, [isAuthenticated, location.pathname]);

  const fetchActiveGame = useCallback(async () => {
    if (shouldHide) {
      setActiveGame(null);
      return;
    }

    setLoading(true);
    try {
      const game = await userService.getCurrentActiveGame();
      setActiveGame(game);
    } catch {
      setActiveGame(null);
    } finally {
      setLoading(false);
    }
  }, [shouldHide]);

  useEffect(() => {
    fetchActiveGame();

    if (shouldHide) return;

    const interval = window.setInterval(fetchActiveGame, 15000);
    const onFocus = () => fetchActiveGame();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchActiveGame, shouldHide]);

  const handleResume = () => {
    if (!activeGame) return;

    const path = activeGame.game_type === 'ai' ? '/ai-game' : '/game';
    navigate(path);
  };

  const handleEnd = () => {
    if (!activeGame || ending) return;
    setShowEndConfirm(true);
  };

  const handleConfirmEnd = async () => {
    if (!activeGame || ending) return;

    setEnding(true);
    try {
      await userService.endCurrentGame(activeGame.id);
      setShowEndConfirm(false);
      setActiveGame(null);
      toast({
        title: 'تم إنهاء المباراة',
        description: 'تم إنهاء المباراة الجارية بنجاح.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل إنهاء المباراة الجارية';
      toast({
        title: 'تعذر إنهاء المباراة',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setEnding(false);
    }
  };

  if (shouldHide || !activeGame) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 w-[min(430px,calc(100%-2rem))]" dir="rtl">
        <Card className="border-primary/30 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  <p className="font-semibold">توجد مباراة جارية</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  النوع: {GAME_TYPE_LABELS[activeGame.game_type] || activeGame.game_type}
                </p>
              </div>
              <Badge variant="outline">#{activeGame.id}</Badge>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleResume}>
                <Play className="ml-1 h-4 w-4" />
                استئناف
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleEnd} disabled={ending || loading}>
                <XCircle className="ml-1 h-4 w-4" />
                {ending ? 'جارٍ الإنهاء...' : 'إنهاء المباراة'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-bold">تأكيد إنهاء المباراة</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              سيتم إنهاء المباراة الجارية واحتساب نتيجتها حسب الحالة الحالية. هل تريد المتابعة؟
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
              >
                إلغاء
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleConfirmEnd} disabled={ending}>
                {ending ? 'جارٍ الإنهاء...' : 'تأكيد الإنهاء'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ActiveGameSticky;
