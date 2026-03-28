import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess, Square } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import ChessBoard from '@/components/ChessBoard';
import { puzzleService, type PlayablePuzzle, type PuzzleItem, type PuzzleLevel } from '@/services/puzzleService';
import {
  ArrowLeft,
  Lightbulb,
  Eye,
  SkipForward,
  RotateCcw,
  Clock,
  Trophy,
  Target,
  Map,
  Lock,
  CheckCircle2,
  Zap,
} from 'lucide-react';

type AppliedMove = {
  actor: 'player' | 'opponent';
  uci?: string;
  san?: string;
};

const DEFAULT_TIME_LIMIT_SECONDS = 5 * 60;

const toArabicLevel = (level: PuzzleLevel) => {
  if (level === 'easy') return 'سهل';
  if (level === 'hard') return 'صعب';
  return 'متوسط';
};

const getDifficultyColor = (level: PuzzleLevel) => {
  if (level === 'easy') return 'text-green-500';
  if (level === 'hard') return 'text-red-500';
  return 'text-yellow-500';
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const buildUci = (from: Square, to: Square, promotion?: string) =>
  `${from}${to}${promotion || ''}`.toLowerCase();

const hasBothKings = (chess: Chess) => {
  let hasWhiteKing = false;
  let hasBlackKing = false;

  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.type === 'k' && piece.color === 'w') hasWhiteKing = true;
      if (piece.type === 'k' && piece.color === 'b') hasBlackKing = true;
    }
  }

  return hasWhiteKing && hasBlackKing;
};

const mapPuzzleErrorToArabic = (message?: string) => {
  const raw = String(message || '').toLowerCase();
  if (raw.includes('invalid fen')) {
    return 'حالة الرقعة في هذا اللغز غير صالحة. يرجى إعادة المحاولة أو الانتقال للغز آخر.';
  }
  return message || 'حدث خطأ غير متوقع أثناء حل اللغز.';
};

const Puzzle = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [playingLoading, setPlayingLoading] = useState(false);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof puzzleService.getProgressOverview>> | null>(null);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<PuzzleLevel | 'all'>('all');
  const [playablePuzzle, setPlayablePuzzle] = useState<PlayablePuzzle | null>(null);
  const [game, setGame] = useState(new Chess());
  const [appliedMoves, setAppliedMoves] = useState<AppliedMove[]>([]);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [usedSolution, setUsedSolution] = useState(false);
  const [hintText, setHintText] = useState('');
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showLevelMap, setShowLevelMap] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_LIMIT_SECONDS);
  const [startCountdown, setStartCountdown] = useState<number | null>(3);
  const startedAtRef = useRef<number>(Date.now());
  const finishedRef = useRef(false);

  const filteredPuzzles = useMemo(() => {
    if (!overview) return [];
    const rows = overview.all;
    if (selectedLevel === 'all') return rows;
    return rows.filter(row => row.level === selectedLevel);
  }, [overview, selectedLevel]);

  const currentPuzzleMeta = useMemo(
    () => overview?.all.find(p => p.id === selectedPuzzleId) || null,
    [overview, selectedPuzzleId]
  );

  const nextExpectedPlayerMove = useMemo(() => {
    if (!playablePuzzle) return null;
    const cursor = appliedMoves.length;
    for (let i = cursor; i < playablePuzzle.solution.length; i += 1) {
      if (playablePuzzle.solution[i].actor === 'player') {
        return playablePuzzle.solution[i];
      }
    }
    return null;
  }, [appliedMoves.length, playablePuzzle]);

  const resetRunState = useCallback((fen: string) => {
    try {
      const next = new Chess(fen);
      if (!hasBothKings(next)) {
        throw new Error('invalid fen: missing king');
      }
      setGame(next);
    } catch (_error) {
      setGame(new Chess());
      toast({
        title: 'خطأ في بيانات اللغز',
        description: 'هذا اللغز يحتوي على وضعية غير صالحة. اختر لغزًا آخر.',
        variant: 'destructive',
      });
    }
    setAppliedMoves([]);
    setMistakesCount(0);
    setHintsUsed(0);
    setUsedSolution(false);
    setHintText('');
    setIsSolved(false);
    setIsFailed(false);
    setShowSolution(false);
    setTimeLeft(DEFAULT_TIME_LIMIT_SECONDS);
    setStartCountdown(3);
    startedAtRef.current = Date.now();
    finishedRef.current = false;
  }, [toast]);

  const loadOverview = useCallback(async () => {
    const data = await puzzleService.getProgressOverview();
    setOverview(data);
    return data;
  }, []);

  const chooseDefaultPuzzle = useCallback((data: Awaited<ReturnType<typeof puzzleService.getProgressOverview>>) => {
    const firstUnlocked = data.all.find(p => p.status === 'unlocked') || data.all.find(p => p.status === 'completed') || null;
    if (firstUnlocked) {
      setSelectedPuzzleId(firstUnlocked.id);
    } else {
      setSelectedPuzzleId(null);
    }
  }, []);

  const loadPlayablePuzzle = useCallback(
    async (id: number) => {
      setPlayingLoading(true);
      try {
        const puzzle = await puzzleService.getPlayablePuzzle(id);
        setPlayablePuzzle(puzzle);
        resetRunState(puzzle.fen);
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: error?.message || 'تعذر تحميل اللغز',
          variant: 'destructive',
        });
      } finally {
        setPlayingLoading(false);
      }
    },
    [resetRunState, toast]
  );

  const finishAttempt = useCallback(
    async (status: 'solved' | 'failed' | 'abandoned', movesSnapshot?: AppliedMove[]) => {
      if (!playablePuzzle || finishedRef.current) return;
      finishedRef.current = true;
      const elapsedSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      const finalMoves = movesSnapshot ?? appliedMoves;

      try {
        const result = await puzzleService.finishAttempt(playablePuzzle.id, {
          status,
          moves: finalMoves.map(move => ({ uci: move.uci, san: move.san })),
          mistakesCount,
          hintsUsed,
          usedSolution,
          elapsedSeconds,
        });

        setOverview(result.progress);

        if (status === 'solved') {
          toast({
            title: 'أحسنت',
            description: `تم حل اللغز بنجاح (+${result.pointsAwarded} نقطة)`,
          });
        } else if (status === 'failed') {
          toast({
            title: 'انتهى الوقت',
            description: 'تم تسجيل المحاولة كفشل، يمكنك إعادة المحاولة الآن',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: error?.message || 'فشل إنهاء المحاولة',
          variant: 'destructive',
        });
      }
    },
    [appliedMoves, hintsUsed, mistakesCount, playablePuzzle, toast, usedSolution]
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const data = await loadOverview();
        chooseDefaultPuzzle(data);
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: error?.message || 'فشل تحميل الألغاز',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [chooseDefaultPuzzle, loadOverview, toast]);

  useEffect(() => {
    if (!selectedPuzzleId) return;
    loadPlayablePuzzle(selectedPuzzleId);
  }, [loadPlayablePuzzle, selectedPuzzleId]);

  useEffect(() => {
    if (!playablePuzzle || isSolved || isFailed) return;
    if (startCountdown === null) return;

    const timer = window.setTimeout(() => {
      setStartCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [playablePuzzle, startCountdown, isSolved, isFailed]);

  useEffect(() => {
    if (!playablePuzzle || isSolved || isFailed) return;
    if (startCountdown !== null) return;
    if (timeLeft <= 0) {
      setIsFailed(true);
      finishAttempt('failed');
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [finishAttempt, isFailed, isSolved, playablePuzzle, startCountdown, timeLeft]);

  const loadByDifficulty = (level: string) => {
    const nextLevel = (level as PuzzleLevel | 'all') || 'all';
    setSelectedLevel(nextLevel);
    if (!overview) return;
    const pool = nextLevel === 'all' ? overview.all : overview.all.filter(p => p.level === nextLevel);
    const candidate = pool.find(p => p.status === 'unlocked') || pool.find(p => p.status === 'completed') || null;
    if (candidate) {
      setSelectedPuzzleId(candidate.id);
    }
  };

  const reloadPuzzle = () => {
    if (!playablePuzzle) return;
    resetRunState(playablePuzzle.fen);
  };

  const goNextPuzzle = () => {
    if (!overview || !playablePuzzle) return;
    const source = selectedLevel === 'all' ? overview.all : overview.all.filter(p => p.level === selectedLevel);
    const currentIndex = source.findIndex(p => p.id === playablePuzzle.id);
    if (currentIndex < 0) return;
    const next = source
      .slice(currentIndex + 1)
      .find(p => p.status === 'unlocked' || p.status === 'completed');

    if (next) {
      setSelectedPuzzleId(next.id);
      return;
    }

    toast({
      title: 'ممتاز',
      description: 'لا يوجد لغز متاح بعد هذا في نفس التصنيف حالياً',
    });
  };

  const showHintAction = () => {
    if (!nextExpectedPlayerMove) {
      toast({
        title: 'لا يوجد تلميح',
        description: 'أكملت اللغز أو لا توجد خطوة لاعب متبقية',
      });
      return;
    }
    setHintsUsed(prev => prev + 1);
    const hint = nextExpectedPlayerMove.san || nextExpectedPlayerMove.uci || nextExpectedPlayerMove.raw;
    setHintText(`التلميح: جرّب نقلة ${hint}`);
    toast({
      title: 'تلميح',
      description: `النقلة الأقرب الآن: ${hint}`,
    });
  };

  const revealSolution = () => {
    setShowSolution(true);
    setUsedSolution(true);
    toast({
      title: 'تم عرض الحل',
      description: 'سيتم احتساب نقاط أقل لهذه المحاولة',
    });
  };

  const onMove = async (from: Square, to: Square, promotion?: string): Promise<boolean> => {
    if (!playablePuzzle || isSolved || isFailed || startCountdown !== null) return false;

    const trial = new Chess(game.fen());
    let move;
    try {
      move = trial.move({ from, to, promotion: promotion as any });
    } catch {
      return false;
    }
    if (!move) return false;

    if (!hasBothKings(trial)) {
      toast({
        title: 'حركة غير صالحة',
        description: 'هذه النقلة تؤدي إلى وضعية غير قانونية في اللغز.',
        variant: 'destructive',
      });
      return false;
    }

    const playerMove: AppliedMove = {
      actor: 'player',
      uci: buildUci(from, to, promotion),
      san: move.san,
    };
    const candidateMoves = [...appliedMoves, playerMove];

    try {
      const check = await puzzleService.checkMove(playablePuzzle.id, candidateMoves.map(m => ({ uci: m.uci, san: m.san })));

      if (!check.isCorrect) {
        setMistakesCount(prev => prev + 1);
        toast({
          title: 'حركة غير صحيحة',
          description: check.message || 'حاول مساراً آخر',
          variant: 'destructive',
        });
        return false;
      }

      const merged = [...candidateMoves];
      if (Array.isArray(check.autoMoves) && check.autoMoves.length > 0) {
        for (const auto of check.autoMoves) {
          const beforeFen = trial.fen();
          const applied = auto.san
            ? trial.move(auto.san, { sloppy: true })
            : auto.uci
              ? trial.move({ from: auto.uci.slice(0, 2), to: auto.uci.slice(2, 4), promotion: auto.uci.slice(4) || undefined } as any)
              : null;

          if (!applied) {
            trial.load(beforeFen);
            continue;
          }
          merged.push({
            actor: 'opponent',
            uci: auto.uci || undefined,
            san: applied.san,
          });
        }
      }

      setAppliedMoves(merged);
      setGame(new Chess(trial.fen()));

      if (check.completed) {
        setIsSolved(true);
        await finishAttempt('solved', merged);
      }

      return true;
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: mapPuzzleErrorToArabic(error?.message),
        variant: 'destructive',
      });
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle" dir="rtl">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid lg:grid-cols-3 gap-8">
            <Skeleton className="h-[620px] w-full rounded-xl lg:col-span-2" />
            <div className="space-y-6">
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-60 w-full rounded-xl" />
              <Skeleton className="h-52 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-3 md:justify-start">
              <div className="flex items-center gap-3 min-w-0">
                <Button variant="ghost" size="icon" aria-label="رجوع" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-6 w-6 text-primary shrink-0" />
                  <h1 className="text-base sm:text-xl font-bold text-foreground font-cairo truncate">الألغاز التكتيكية</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm md:hidden shrink-0">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-medium">{overview?.stats.totalPoints || 0}</span>
              </div>
            </div>

            <div className="hidden md:flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Button onClick={() => setShowLevelMap(true)} variant="ghost" className="gap-2 w-full sm:w-auto">
                <Map className="h-4 w-4" />
                خريطة المستويات
              </Button>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-medium">{overview?.stats.totalPoints || 0} نقطة</span>
              </div>
              <Select value={selectedLevel} onValueChange={loadByDifficulty}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستويات</SelectItem>
                  <SelectItem value="easy">سهل</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="hard">صعب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 md:hidden">
            <Button onClick={() => setShowLevelMap(true)} variant="ghost" className="gap-2 w-full">
              <Map className="h-4 w-4" />
              خريطة المستويات
            </Button>
            <Select value={selectedLevel} onValueChange={loadByDifficulty}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المستويات</SelectItem>
                <SelectItem value="easy">سهل</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="hard">صعب</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 sm:py-8">
        {playingLoading ? (
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            <Skeleton className="h-[620px] w-full rounded-xl lg:col-span-2" />
            <div className="space-y-6">
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-60 w-full rounded-xl" />
              <Skeleton className="h-52 w-full rounded-xl" />
            </div>
          </div>
        ) : playablePuzzle ? (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="p-3 sm:p-6">
                <div className="relative aspect-square max-w-lg mx-auto">
                  <ChessBoard
                    game={game}
                    onMove={onMove}
                    orientation={playablePuzzle.startsWith === 'black' ? 'black' : 'white'}
                    allowMoves={!isSolved && !isFailed && startCountdown === null}
                    resultSticker={isSolved ? 'win' : isFailed ? 'loss' : null}
                  />
                  {startCountdown !== null && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-[1px]">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2 font-cairo">ابدأ التركيز</p>
                        <p className="text-6xl font-black text-primary leading-none">{startCountdown}</p>
                      </div>
                    </div>
                  )}
                </div>

                {hintText && (
                  <div className="mt-3 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
                    {hintText}
                  </div>
                )}

                {showSolution && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 font-cairo">الحل الكامل:</h4>
                    <div className="flex flex-wrap gap-2">
                      {playablePuzzle.solution.map((move, index) => (
                        <Badge key={`${index}-${move.raw}`} variant="outline">
                          {index + 1}. {move.raw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-cairo">{playablePuzzle.name}</CardTitle>
                    <Badge className={getDifficultyColor(playablePuzzle.level)}>
                      {toArabicLevel(playablePuzzle.level)}
                    </Badge>
                  </div>
                  <CardDescription>{playablePuzzle.details || 'لا يوجد وصف إضافي'}</CardDescription>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>الهدف:</span>
                    <span className="font-medium text-foreground">
                      {playablePuzzle.objective || 'أكمل المسار الصحيح للنهايه'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الوقت المتبقي</span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-mono">{formatTime(timeLeft)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">حالة اللغز</span>
                    {isSolved ? (
                      <Badge className="bg-green-600 text-white">تم الحل</Badge>
                    ) : isFailed ? (
                      <Badge variant="destructive">فشل</Badge>
                    ) : (
                      <Badge variant="outline">جاري الحل</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الأخطاء</span>
                    <span>{mistakesCount}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">التلميحات المستخدمة</span>
                    <span>{hintsUsed}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">نقاط اللغز</span>
                    <span>{playablePuzzle.points}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <Button
                    onClick={showHintAction}
                    disabled={isSolved || isFailed}
                    variant="elegant"
                    className="w-full"
                  >
                    <Lightbulb className="ml-2 h-4 w-4" />
                    تلميح
                  </Button>

                  <Button
                    onClick={revealSolution}
                    disabled={isSolved || isFailed}
                    variant="outline"
                    className="w-full"
                  >
                    <Eye className="ml-2 h-4 w-4" />
                    عرض الحل
                  </Button>

                  <Separator />

                  <Button onClick={goNextPuzzle} variant="chess" className="w-full">
                    <SkipForward className="ml-2 h-4 w-4" />
                    اللغز التالي
                  </Button>

                  <Button onClick={reloadPuzzle} variant="ghost" className="w-full">
                    <RotateCcw className="ml-2 h-4 w-4" />
                    إعادة المحاولة
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo text-lg">إحصائياتك في الألغاز</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">الألغاز المكتملة</span>
                    <span className="font-medium">{overview?.stats.completedPuzzles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">المحاولات</span>
                    <span className="font-medium">{overview?.stats.totalAttempts || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">نسبة النجاح</span>
                    <span className="font-medium">{overview?.stats.successRate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">اللغز الحالي</span>
                    <span className="font-medium">{currentPuzzleMeta?.status === 'completed' ? 'مكتمل' : currentPuzzleMeta?.status === 'locked' ? 'مقفل' : 'متاح'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد ألغاز متاحة</h3>
            <p className="text-muted-foreground mb-4">تأكد من إضافة ألغاز فعالة من لوحة الإدارة</p>
          </div>
        )}

        <Dialog open={showLevelMap} onOpenChange={setShowLevelMap}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-cairo">خريطة المستويات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 p-1">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPuzzles.map((puzzle: PuzzleItem) => {
                  const isCurrent = puzzle.id === selectedPuzzleId;
                  return (
                    <button
                      key={puzzle.id}
                      type="button"
                      disabled={puzzle.status === 'locked'}
                      onClick={() => {
                        if (puzzle.status === 'locked') return;
                        setSelectedPuzzleId(puzzle.id);
                        setShowLevelMap(false);
                      }}
                      className={`rounded-lg border p-3 text-right transition ${
                        isCurrent
                          ? 'border-primary bg-primary/10'
                          : puzzle.status === 'completed'
                            ? 'border-green-500/40 bg-green-500/10'
                            : puzzle.status === 'locked'
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{puzzle.name}</div>
                        {puzzle.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : puzzle.status === 'locked' ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Zap className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {toArabicLevel(puzzle.level)} • {puzzle.points} نقطة
                      </div>
                      <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
                        {puzzle.objective || puzzle.details || 'بدون وصف'}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>مكتمل</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>متاح</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>مقفل</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Puzzle;
