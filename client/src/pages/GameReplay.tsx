import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  ArrowRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ListVideo,
} from 'lucide-react';
import ChessBoard from '@/components/ChessBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { userService, type GameMovePair } from '@/services/userService';

type ReplayPly = {
  index: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  fen: string;
};

type ReplayState = {
  game?: {
    id: number;
    opponent: string;
    game_type: string;
    result: string;
    color: 'white' | 'black';
    started_at?: string;
    ended_at?: string | null;
  };
};

const SPEED_OPTIONS = [
  { label: 'بطيء', value: 1400 },
  { label: 'متوسط', value: 900 },
  { label: 'سريع', value: 500 },
] as const;

const GameReplay = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const state = (location.state || {}) as ReplayState;

  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState<ReplayPly[]>([]);
  const [positions, setPositions] = useState<string[]>([new Chess().fen()]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(SPEED_OPTIONS[1].value);

  const parsedGameId = Number(gameId || 0);
  const totalPlies = moves.length;
  const orientation = state?.game?.color === 'black' ? 'black' : 'white';

  const currentFen = positions[currentIndex] || positions[0];
  const replayBoard = useMemo(() => new Chess(currentFen), [currentFen]);
  const currentMove = currentIndex > 0 ? moves[currentIndex - 1] : null;

  useEffect(() => {
    let mounted = true;

    const buildReplayTimeline = (pairs: GameMovePair[]) => {
      const game = new Chess();
      const replayMoves: ReplayPly[] = [];
      const replayPositions: string[] = [game.fen()];

      for (const pair of pairs) {
        if (pair.white?.san) {
          const move = game.move(pair.white.san, { sloppy: true });
          if (!move) continue;
          replayMoves.push({
            index: replayMoves.length + 1,
            moveNumber: pair.moveNumber,
            color: 'white',
            san: pair.white.san,
            fen: game.fen(),
          });
          replayPositions.push(game.fen());
        }

        if (pair.black?.san) {
          const move = game.move(pair.black.san, { sloppy: true });
          if (!move) continue;
          replayMoves.push({
            index: replayMoves.length + 1,
            moveNumber: pair.moveNumber,
            color: 'black',
            san: pair.black.san,
            fen: game.fen(),
          });
          replayPositions.push(game.fen());
        }
      }

      return { replayMoves, replayPositions };
    };

    const loadReplay = async () => {
      if (!parsedGameId) {
        toast({
          title: 'خطأ',
          description: 'معرّف المباراة غير صالح',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const pairs = await userService.getGameMoves(parsedGameId);
        const { replayMoves, replayPositions } = buildReplayTimeline(pairs);
        if (!mounted) return;
        setMoves(replayMoves);
        setPositions(replayPositions);
        setCurrentIndex(0);
      } catch (error: any) {
        if (!mounted) return;
        toast({
          title: 'خطأ',
          description: error?.message || 'فشل في تحميل سجل المباراة',
          variant: 'destructive',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadReplay();

    return () => {
      mounted = false;
    };
  }, [parsedGameId, toast]);

  useEffect(() => {
    if (!isPlaying || totalPlies === 0) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalPlies) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, speedMs, totalPlies]);

  const handlePlayPause = () => {
    if (totalPlies === 0) return;
    if (currentIndex >= totalPlies) {
      setCurrentIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const goToStart = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const goToEnd = () => {
    setIsPlaying(false);
    setCurrentIndex(totalPlies);
  };

  const goPrev = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(totalPlies, prev + 1));
  };

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="رجوع" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold font-cairo">مشاهدة المباراة</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-5">
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <ListVideo className="h-5 w-5" />
              <span>إعادة تشغيل تفاعلية</span>
              {state?.game?.result ? <Badge variant="outline">{state.game.result}</Badge> : null}
              {state?.game?.opponent ? <Badge variant="secondary">ضد: {state.game.opponent}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">جاري تحميل المباراة...</div>
            ) : totalPlies === 0 ? (
              <div className="text-muted-foreground">لا توجد نقلات متاحة لهذه المباراة.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,680px)_minmax(300px,1fr)] gap-5">
                <div className="space-y-4">
                  <div className="max-w-[680px] mx-auto">
                    <ChessBoard
                      game={replayBoard}
                      onMove={() => false}
                      orientation={orientation}
                      allowMoves={false}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-background/40 p-3 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        الحركة الحالية:
                        {' '}
                        {currentIndex === 0
                          ? 'بداية المباراة'
                          : `${currentMove?.moveNumber}${currentMove?.color === 'white' ? '. أبيض' : '... أسود'} (${currentMove?.san})`}
                      </span>
                      <span>{currentIndex} / {totalPlies}</span>
                    </div>

                    <Slider
                      value={[currentIndex]}
                      min={0}
                      max={totalPlies}
                      step={1}
                      onValueChange={(value) => {
                        const next = Number(value?.[0] || 0);
                        setCurrentIndex(next);
                        setIsPlaying(false);
                      }}
                    />

                    <div className="flex flex-nowrap items-center gap-1 sm:gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={goToStart}
                        aria-label="الرجوع للبداية"
                        className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={goPrev}
                        aria-label="الحركة السابقة"
                        className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={handlePlayPause}
                        className="shrink-0 min-w-[96px] sm:min-w-[120px] h-8 sm:h-10 text-sm sm:text-base px-2 sm:px-4"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-4 w-4 ml-2" />
                            إيقاف
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 ml-2" />
                            تشغيل
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={goNext}
                        aria-label="الحركة التالية"
                        className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goToEnd}
                        className="shrink-0 h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
                      >
                        النهاية
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-center">
                      <span className="text-sm text-muted-foreground">السرعة:</span>
                      {SPEED_OPTIONS.map((speed) => (
                        <Button
                          key={speed.value}
                          type="button"
                          size="sm"
                          variant={speedMs === speed.value ? 'default' : 'outline'}
                          onClick={() => setSpeedMs(speed.value)}
                        >
                          {speed.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Card className="bg-background/35">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">سجل النقلات</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[520px] overflow-auto space-y-2">
                    {moves.map((move) => {
                      const isActive = move.index === currentIndex;
                      return (
                        <button
                          key={`${move.index}-${move.san}`}
                          type="button"
                          onClick={() => {
                            setCurrentIndex(move.index);
                            setIsPlaying(false);
                          }}
                          className={`w-full text-right rounded-md border px-3 py-2 transition ${
                            isActive
                              ? 'border-primary bg-primary/15'
                              : 'border-border bg-card/30 hover:bg-card/50'
                          }`}
                        >
                          <span className="text-xs text-muted-foreground ml-2">
                            {move.moveNumber}{move.color === 'white' ? '. أبيض' : '... أسود'}
                          </span>
                          <span className="font-semibold">{move.san}</span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default GameReplay;
