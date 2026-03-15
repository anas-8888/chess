import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Trophy, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  userService,
  type RecentGame,
  type UserProfile,
  type GameMovePair,
} from '@/services/userService';

const MyStatistics = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
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
    } catch (error: any) {
      setGameReport(null);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب تقرير المباراة',
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
        const [profileData, recent] = await Promise.all([
          userService.getProfileStats(),
          userService.getRecentGames(10),
        ]);
        setProfile(profileData);
        setRecentGames(recent);
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: error.message || 'فشل في تحميل الإحصائيات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center" dir="rtl">
        جاري تحميل الإحصائيات...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold font-cairo">إحصائياتي</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center"><div className="text-sm">التقييم</div><div className="text-2xl font-bold">{profile?.rating || 1200}</div></CardContent></Card>
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

                  {expandedGameId === game.id && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                      {reportLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جاري إعداد التقرير...
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
      </main>
    </div>
  );
};

export default MyStatistics;
