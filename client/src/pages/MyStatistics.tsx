import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, FileText, PlayCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import PlacementProgress from '@/components/PlacementProgress';
import { useToast } from '@/hooks/use-toast';
import {
  userService,
  type RecentGame,
  type UserProfile,
  type GameMovePair,
  type RatingHistoryItem,
} from '@/services/userService';
import AppNavHeader from '@/components/AppNavHeader';

const MyStatistics = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryItem[]>([]);
  const [lastRatingDelta, setLastRatingDelta] = useState(0);
  const [gameReport, setGameReport] = useState<{
    gameId: number;
    summary: string;
    opening: string;
    keyMoments: string[];
    conclusion: string;
  } | null>(null);

  const buildGameReport = (game: RecentGame, movePairs: GameMovePair[]) => {
    const plies = movePairs.flatMap(pair => {
      const items: { moveNumber: number; color: 'white' | 'black'; san: string }[] = [];
      if (pair.white?.san) {
        items.push({ moveNumber: pair.moveNumber, color: 'white', san: pair.white.san });
      }
      if (pair.black?.san) {
        items.push({ moveNumber: pair.moveNumber, color: 'black', san: pair.black.san });
      }
      return items;
    });

    const totalPlies = plies.length;
    const captures = plies.filter(m => m.san.includes('x'));
    const checks = plies.filter(m => m.san.includes('+'));
    const mates = plies.filter(m => m.san.includes('#'));
    const castles = plies.filter(m => m.san.startsWith('O-O'));
    const promotions = plies.filter(m => m.san.includes('='));

    const openingMoves = plies
      .slice(0, 8)
      .map(m => `${m.moveNumber}${m.color === 'white' ? 'w' : 'b'}: ${m.san}`)
      .join(' | ');

    const keyMoments = plies
      .filter(m => m.san.includes('x') || m.san.includes('+') || m.san.includes('#') || m.san.startsWith('O-O') || m.san.includes('='))
      .slice(0, 6)
      .map(m => `النقلة ${m.moveNumber} (${m.color === 'white' ? 'أبيض' : 'أسود'}): ${m.san}`);

    const lastMove = plies[plies.length - 1];
    let conclusion = '';
    if (game.result === 'فوز') {
      if (lastMove?.san?.includes('#')) {
        conclusion = `حسمت المباراة بكش مات في النقلة ${lastMove.moveNumber}.`;
      } else if (captures.length >= 4) {
        conclusion = 'حسمت المباراة عبر تفوق تكتيكي واضح وكسب قطع مؤثرة.';
      } else {
        conclusion = 'تفوقت استراتيجيًا في منتصف ونهاية اللعب حتى تحقق الفوز.';
      }
    } else if (game.result === 'خسارة') {
      if (lastMove?.san?.includes('#')) {
        conclusion = `انتهت المباراة بكش مات ضدك في النقلة ${lastMove.moveNumber}.`;
      } else if (captures.length >= 4) {
        conclusion = 'شهدت المباراة تبادلات حادة وانتهت لصالح الخصم في النهاية.';
      } else {
        conclusion = 'تفوق الخصم تدريجيًا حتى أنهى المباراة لصالحه.';
      }
    } else if (game.result === 'تعادل') {
      conclusion = 'انتهت المباراة بتوازن في الموقف دون أفضلية حاسمة لأي طرف.';
    } else {
      conclusion = 'المباراة ما زالت جارية.';
    }

    return {
      gameId: game.id,
      summary: `إجمالي النقلات: ${Math.ceil(totalPlies / 2)} | الأخذ: ${captures.length} | الكش: ${checks.length} | التبييت: ${castles.length} | الترقيات: ${promotions.length} | كش مات: ${mates.length}`,
      opening: openingMoves || 'لا توجد نقلات افتتاحية كافية للتحليل.',
      keyMoments: keyMoments.length > 0 ? keyMoments : ['لا توجد لحظات تكتيكية بارزة حسب سجل النقلات.'],
      conclusion,
    };
  };

  const handleOpenReport = async (game: RecentGame) => {
    if (expandedGameId === game.id) {
      setExpandedGameId(null);
      return;
    }

    setExpandedGameId(game.id);
    setReportLoading(true);

    try {
      const moves = await userService.getGameMoves(game.id);
      const report = buildGameReport(game, moves);
      setGameReport(report);
    } catch (error: unknown) {
      setGameReport(null);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في جلب تقرير المباراة',
        variant: 'destructive',
      });
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profileData, recent, ratingData] = await Promise.all([
          userService.getProfileStats(),
          userService.getRecentGames(10),
          userService.getRatingHistory(20),
        ]);
        setProfile(profileData);
        setRecentGames(recent);
        setRatingHistory(ratingData.history || []);
        setLastRatingDelta(Number(ratingData.lastDelta) || 0);
      } catch (error: unknown) {
        toast({
          title: 'خطأ',
          description: error instanceof Error ? error.message : 'فشل في تحميل الإحصائيات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle" dir="rtl">
        <AppNavHeader />
        <main className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <AppNavHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="border-yellow-500/20 bg-card/60">
          <CardHeader>
            <CardTitle className="font-cairo">كيف يعمل التقييم (Rating)؟</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>الفوز ضد لاعب أقوى يعطي نقاط أكثر، والفوز ضد لاعب أضعف يعطي نقاط أقل.</div>
            <div>الخسارة ضد لاعب أضعف تنقص نقاط أكثر، والخسارة ضد لاعب أقوى تنقص نقاط أقل.</div>
            <div>التعادل ضد أقوى يزيد قليلًا، وضد أضعف ينقص قليلًا.</div>
            <div className="rounded-md border border-border bg-background/30 p-3">
              مثال: إذا كان تقييمك 1500 ولعبت ضد 1700 وفزت، فغالبًا ستحصل على زيادة أكبر من الفوز على لاعب 1300.
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${lastRatingDelta >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(8, Math.abs(lastRatingDelta) * 4))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-foreground">
              <span>تقييمك الحالي: <span className="font-bold text-yellow-500">{profile?.rating || 1500}</span></span>
              <span className={lastRatingDelta >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                آخر تغير: {lastRatingDelta > 0 ? `+${lastRatingDelta}` : lastRatingDelta}
              </span>
            </div>
          </CardContent>
        </Card>

        <PlacementProgress
          gamesPlayed={Number(profile?.placementGamesPlayed ?? profile?.total_games ?? 0)}
          totalMatches={Number(profile?.placementMatches ?? 10)}
          isPlacement={Boolean(profile?.isPlacement)}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center"><div className="text-sm">التقييم</div><div className="text-2xl font-bold">{profile?.rating || 1500}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-sm">انتصارات</div><div className="text-2xl font-bold">{profile?.wins || 0}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-sm">خسائر</div><div className="text-2xl font-bold">{profile?.losses || 0}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-sm">تعادل</div><div className="text-2xl font-bold">{profile?.draws || 0}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-sm">نسبة الفوز</div><div className="text-2xl font-bold">{(profile?.win_rate || 0).toFixed(1)}%</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              آخر المباريات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentGames.length === 0 ? (
              <div className="text-muted-foreground">لا توجد مباريات بعد</div>
            ) : (
              recentGames.map(game => (
                <div key={game.id} className="border rounded-lg p-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleOpenReport(game)}
                    className="w-full flex items-center justify-between text-right"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">ضد: {game.opponent}</div>
                      <div className="text-sm text-muted-foreground">
                        {game.color === 'white' ? 'أبيض' : 'أسود'} • {game.game_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={game.result === 'فوز' ? 'default' : game.result === 'خسارة' ? 'destructive' : 'secondary'}>
                        {game.result}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        تقرير
                      </Badge>
                    </div>
                  </button>

                  <div className="flex items-center justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/game-replay/${game.id}`}
                        state={{ game }}
                      >
                        <PlayCircle className="h-4 w-4 ml-1" />
                        مشاهدة المباراة
                      </Link>
                    </Button>
                  </div>

                  {expandedGameId === game.id && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                      {reportLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-44" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ) : gameReport?.gameId === game.id ? (
                        <>
                          <div>
                            <div className="text-sm font-semibold mb-1">ملخص عام</div>
                            <div className="text-sm text-muted-foreground">{gameReport.summary}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold mb-1">بداية اللعب</div>
                            <div className="text-sm text-muted-foreground">{gameReport.opening}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold mb-1">نقاط التحول</div>
                            <div className="space-y-1">
                              {gameReport.keyMoments.map((moment, idx) => (
                                <div key={`${game.id}-${idx}`} className="text-sm text-muted-foreground">
                                  {idx + 1}. {moment}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold mb-1">الخلاصة</div>
                            <div className="text-sm text-muted-foreground">{gameReport.conclusion}</div>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">لا يوجد تقرير متاح لهذه المباراة.</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-cairo">سجل تغيّر التقييم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratingHistory.length === 0 ? (
              <div className="text-muted-foreground">لا يوجد سجل تقييم حتى الآن</div>
            ) : (
              ratingHistory.map((item) => (
                <div key={item.gameId} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm">
                    <div className="font-medium">ضد: {item.opponent}</div>
                    <div className="text-muted-foreground">
                      {new Date(item.endedAt).toLocaleString('ar')} • {item.gameType} • {item.result}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${item.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {item.delta >= 0 ? `+${item.delta}` : item.delta}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyStatistics;
