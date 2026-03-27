import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Users, 
  Mail, 
  Trophy, 
  Puzzle,
  Clock, 
  User,
  LogOut,
  Check,
  X,
  MessageCircle,
  Crown,
  BarChart3,
  UserCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userService, UserProfile, RecentGame, ActiveGameSummary } from '@/services/userService';
import { inviteService } from '@/services/inviteService';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitialsFromName, hasCustomAvatar } from '@/utils/avatar';
import BrandLogo from '@/components/BrandLogo';


interface GameInvite {
  id: string;
  from_user: {
    id: string;
    username: string;
    avatar: string;
    rating: number;
  };
  game_type: string;
  time_control: number;
  created_at: string;
}

// Using FriendType from friendService instead of local interface

interface ActiveGame {
  id: string;
  opponent: {
    username: string;
    avatar: string;
  };
  your_color: 'white' | 'black';
  status: 'waiting' | 'active' | 'finished';
  time_left: number;
}

const DASHBOARD_TAB_STORAGE_KEY = 'dashboard_active_tab_v1';
const DASHBOARD_TAB_VALUES = ['play', 'games'] as const;
type DashboardTabValue = (typeof DASHBOARD_TAB_VALUES)[number];

const Dashboard = () => {
  const { user: authUser, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);

  const [invites, setInvites] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [activeGame, setActiveGame] = useState<ActiveGameSummary | null>(null);
  const [endingGameId, setEndingGameId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTabValue>(() => {
    if (typeof window === 'undefined') return 'play';
    const savedTab = localStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    if (savedTab && (DASHBOARD_TAB_VALUES as readonly string[]).includes(savedTab)) {
      return savedTab as DashboardTabValue;
    }
    return 'play';
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        // Update status to online when fetching data
        try {
          await updateStatus('online');
        } catch (error) {
          console.error('Failed to update status:', error);
          // Continue with data fetching even if status update fails
        }
        const [userProfile, recent, currentActiveGame] = await Promise.all([
          userService.getProfileStats(),
          userService.getRecentGames(12),
          userService.getCurrentActiveGame(),
        ]);
        setUser(userProfile);
        setRecentGames(recent);
        setActiveGame(currentActiveGame);

        try {
          const invitesData = await inviteService.getReceivedInvites();
          setInvites(invitesData);
        } catch (error) {
          console.error('Error loading invites:', error);
        }
      } catch (error: any) {
        console.error('Error fetching user data:', error);
        toast({
          title: "خطأ في جلب البيانات",
          description: error.message || "فشل في تحميل بيانات المستخدم",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [toast, updateStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Update status when component mounts
  useEffect(() => {
    if (authUser) {
      try {
        updateStatus('online');
      } catch (error) {
        console.error('Failed to update status on mount:', error);
      }
    }
  }, [authUser, updateStatus]);

  // Update status when component unmounts
  useEffect(() => {
    return () => {
      if (authUser) {
        updateStatus('offline');
      }
    };
  }, [authUser, updateStatus]);

  const handleStartQuickGame = () => {
    if (activeGame) {
      toast({
        title: 'لديك مباراة جارية',
        description: 'لا يمكن بدء مباراة جديدة قبل إنهاء الحالية',
        variant: 'destructive',
      });
      navigate(activeGame.game_type === 'ai' ? '/ai-game' : `/game?id=${activeGame.id}`);
      return;
    }
    // Update status to in-game
    updateStatus('in-game');
    // Navigate to game page
    navigate('/game');
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (activeGame) {
      toast({
        title: 'لديك مباراة جارية',
        description: 'أنهِ المباراة الحالية أولًا قبل قبول دعوة جديدة',
        variant: 'destructive',
      });
      return;
    }
    // Update status to in-game when accepting invite
    updateStatus('in-game');
    await acceptInvite(inviteId);
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await inviteService.declineInvite(inviteId);
      setInvites(prev => prev.filter(inv => inv.id !== inviteId));
      toast({
        title: "تم رفض الدعوة",
        description: "تم رفض الدعوة بنجاح"
      });
    } catch (error) {
      console.error('Error declining invite:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من رفض الدعوة",
        variant: "destructive"
      });
    }
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      const result = await inviteService.acceptInvite(inviteId);
      toast({
        title: "تم قبول الدعوة",
        description: "جاري الانتقال إلى المباراة..."
      });

      // Remove from invites list
      setInvites(prev => prev.filter(inv => inv.id !== inviteId));

      // Navigate to game
      setTimeout(() => {
        const gameId = result?.data?.game?.id || result?.data?.gameId || result?.gameId;
        if (gameId) {
          navigate(`/game?id=${gameId}`);
          return;
        }
        navigate('/game');
      }, 1000);
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من قبول الدعوة",
        variant: "destructive"
      });
    }
  };

  // دالة بدء المباراة
  const startGame = async (inviteId: string) => {
    try {
      if (activeGame) {
        toast({
          title: 'لديك مباراة جارية',
          description: 'لا يمكن بدء مباراة جديدة قبل إنهاء الحالية',
          variant: 'destructive',
        });
        return;
      }

      const result = await inviteService.startGame(inviteId, 'phone');
      
      toast({
        title: 'تم بدء المباراة',
        description: 'جاري الانتقال إلى المباراة...',
      });

      // الانتقال إلى صفحة المباراة
      setTimeout(() => {
        navigate(`/game?id=${result.data?.gameId || 'new_game'}`);
      }, 1000);

    } catch (error) {
      console.error('Error starting game:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في بدء المباراة',
        variant: 'destructive',
      });
    }
  };

  // دالة دخول المباراة
  const joinGame = async (gameId: string) => {
    try {
      toast({
        title: 'جاري الانتقال',
        description: 'جاري الانتقال إلى المباراة...',
      });

      // الانتقال إلى صفحة المباراة
      setTimeout(() => {
        navigate(`/game?id=${gameId}`);
      }, 1000);

    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في دخول المباراة',
        variant: 'destructive',
      });
    }
  };

  // دالة الحصول على نص الحالة
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'accepted':
        return 'مقبولة';
      case 'rejected':
        return 'مرفوضة';
      case 'expired':
        return 'منتهية';
      case 'game_started':
        return 'المباراة جارية';
      default:
        return 'غير معروفة';
    }
  };

  // دالة الحصول على لون الحالة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-muted text-muted-foreground border border-border';
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'expired':
        return 'bg-muted text-muted-foreground border border-border';
      case 'game_started':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const handleEndGame = async (gameId: number) => {
    try {
      setEndingGameId(gameId);
      await userService.endCurrentGame(gameId);
      const [recent, currentActiveGame, refreshedProfile] = await Promise.all([
        userService.getRecentGames(12),
        userService.getCurrentActiveGame(),
        userService.getProfileStats(),
      ]);
      setRecentGames(recent);
      setActiveGame(currentActiveGame);
      setUser(refreshedProfile);
      toast({
        title: 'تم إنهاء المباراة',
        description: 'تم إنهاء المباراة الجارية بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'تعذر إنهاء المباراة',
        description: error.message || 'حدث خطأ أثناء إنهاء المباراة',
        variant: 'destructive',
      });
    } finally {
      setEndingGameId(null);
    }
  };

  const getResultBadgeVariant = (result: RecentGame['result']) => {
    if (result === 'فوز') return 'default';
    if (result === 'خسارة') return 'destructive';
    return 'secondary';
  };

  // دالة معالجة أزرار الدعوة بناءً على الحالة
  const renderInviteButtons = (invite: any) => {
    const status = invite.status;
    
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleAcceptInvite(invite.id)}
              variant="default"
              size="sm"
            >
              <Check className="h-4 w-4 ml-1" />
              قبول
            </Button>
            <Button
              onClick={() => handleDeclineInvite(invite.id)}
              variant="outline"
              size="sm"
            >
              <X className="h-4 w-4 ml-1" />
              رفض
            </Button>
          </div>
        );
      
      case 'accepted':
        return (
          <Button
            onClick={() => startGame(invite.id)}
            variant="default"
            size="sm"
          >
            <MessageCircle className="h-4 w-4 ml-1" />
            الدخول للمباراة
          </Button>
        );
      
      case 'rejected':
      case 'expired':
        return null; // لا توجد أزرار لهذه الحالات
      
      case 'game_started':
        return (
          <Button
            onClick={() => joinGame(invite.game_id)}
            variant="default"
            size="sm"
          >
            <MessageCircle className="h-4 w-4 ml-1" />
            دخول المباراة
          </Button>
        );
      
      default:
        return null;
    }
  };

  // Function to calculate "time ago" in Arabic
  const arabicPlural = (value: number, forms: [string, string, string, string]): string => {
    if (value === 1) return forms[0];
    if (value === 2) return forms[1];
    if (value >= 3 && value <= 10) return forms[2];
    return forms[3];
  };

  const parseUTCDateString = (dateString: string): Date => {
    let iso = dateString.replace(' ', 'T');
    if (!/Z$/.test(iso)) {
      iso += 'Z';
    }
    return new Date(iso);
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = parseUTCDateString(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    const minuteForms: [string, string, string, string] = ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'];
    const hourForms: [string, string, string, string] = ['ساعة', 'ساعتين', 'ساعات', 'ساعة'];
    const dayForms: [string, string, string, string] = ['يوم', 'يومين', 'أيام', 'يوم'];
    const monthForms: [string, string, string, string] = ['شهر', 'شهرين', 'أشهر', 'شهر'];
    const yearForms: [string, string, string, string] = ['سنة', 'سنتين', 'سنوات', 'سنة'];

    if (diffMin < 1) {
      return 'الآن';
    }
    if (diffMin < 60) {
      return `منذ ${diffMin} ${arabicPlural(diffMin, minuteForms)}`;
    }
    if (diffHrs < 24) {
      const remMin = diffMin % 60;
      const hrsPart = `منذ ${diffHrs} ${arabicPlural(diffHrs, hourForms)}`;
      return remMin === 0
        ? hrsPart
        : `${hrsPart} و${remMin} ${arabicPlural(remMin, minuteForms)}`;
    }
    if (diffDays < 30) {
      return `منذ ${diffDays} ${arabicPlural(diffDays, dayForms)}`;
    }
    if (diffMonths < 12) {
      return `منذ ${diffMonths} ${arabicPlural(diffMonths, monthForms)}`;
    }
    return `منذ ${diffYears} ${arabicPlural(diffYears, yearForms)}`;
  };

  const handleLogout = async () => {
    try {
      // Update status to offline before logout
      await updateStatus('offline');
    } catch (error) {
      console.error('Failed to update status on logout:', error);
      // Continue with logout even if status update fails
    }
    
    await logout();
  };



  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // Show error state if no user data
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">خطأ في تحميل البيانات</h2>
          <p className="text-muted-foreground mb-4">فشل في جلب بيانات المستخدم</p>
          <Button onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[radial-gradient(1200px_400px_at_80%_-10%,rgba(15,23,42,0.08),transparent),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]"
      dir="rtl"
    >
      {/* Header */}
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-4 rounded-xl border border-border bg-card px-3 py-2 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-11 w-11 ring-2 ring-border">
                      <AvatarImage src={hasCustomAvatar(user.avatar) ? user.avatar : undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {getInitialsFromName(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-right">
                      <h2 className="font-cairo text-lg font-bold text-foreground">{user.username}</h2>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-border text-foreground">
                          <Trophy className="w-3 h-3 ml-1 text-muted-foreground" />
                          {user.rating || 1500}
                        </Badge>
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 text-right" dir="rtl">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/my-profile')} className="justify-start gap-2">
                    <UserCircle className="h-4 w-4 shrink-0" />
                    الملف الشخصي
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-statistics')} className="justify-start gap-2">
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    الإحصائيات
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/friends')} className="justify-start gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    الأصدقاء
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/connect-board')} className="justify-start gap-2">
                    <Trophy className="h-4 w-4 shrink-0" />
                    ربط الرقعة
                  </DropdownMenuItem>
                  {authUser?.type === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="justify-start gap-2">
                      <Crown className="h-4 w-4 shrink-0" />
                      لوحة الإدارة
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="justify-start gap-2">
                    <LogOut className="h-4 w-4 shrink-0" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <BrandLogo variant="icon" imgClassName="h-8 w-8" />
              {authUser?.type === 'admin' && <Badge variant="outline" className="border-border text-foreground">مدير</Badge>}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="text-2xl font-bold text-foreground font-cairo">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة الحساب، متابعة الدعوات، والوصول السريع إلى خدمات المنصة.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTabValue)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-card border border-border p-1">
                <TabsTrigger value="play" className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  الوصول السريع
                </TabsTrigger>
                <TabsTrigger value="games" className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  النشاط
                </TabsTrigger>
              </TabsList>

              <TabsContent value="play">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-border bg-card hover:shadow-card transition-shadow cursor-pointer"
                        onClick={handleStartQuickGame}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary" />
                        مباراة سريعة
                      </CardTitle>
                      <CardDescription>
                        إنشاء مباراة مباشرة مع خصم متاح
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full border-border">
                        بدء الآن
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card hover:shadow-card transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        مباراة مع صديق
                      </CardTitle>
                      <CardDescription>
                        اختيار صديق وإرسال دعوة رسمية للمباراة
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full border-border" onClick={() => navigate('/friends')}>
                        إدارة الأصدقاء
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card hover:shadow-card transition-shadow cursor-pointer"
                        onClick={() => {
                          if (activeGame) {
                            toast({
                              title: 'لديك مباراة جارية',
                              description: 'لا يمكن بدء مباراة جديدة قبل إنهاء الحالية',
                              variant: 'destructive',
                            });
                            navigate(activeGame.game_type === 'ai' ? '/ai-game' : `/game?id=${activeGame.id}`);
                            return;
                          }
                          navigate('/ai-loading');
                        }}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        التحليل الذكي
                      </CardTitle>
                      <CardDescription>
                        جلسة تدريب وتحليل مع محرك الذكاء الاصطناعي
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full border-border">
                        بدء الجلسة
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card hover:shadow-card transition-shadow cursor-pointer"
                        onClick={() => navigate('/puzzle')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Puzzle className="w-5 h-5 text-primary" />
                        حل الألغاز
                      </CardTitle>
                      <CardDescription>
                        تدريب تكتيكي يومي لتحسين مستواك
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full border-border">
                        ابدأ حل الألغاز
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

                             

              <TabsContent value="games">
                <Card className="border-border bg-card">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        آخر النشاط
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/my-statistics')}
                      >
                        عرض جميع الإحصائيات
                      </Button>
                    </div>
                    <CardDescription>آخر 12 مباراة مسجلة في حسابك</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentGames.length === 0 ? (
                      <div className="text-center py-8">
                        <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">لا توجد مباريات مسجلة حتى الآن</p>
                      </div>
                    ) : (
                      recentGames.map(game => (
                        <div key={game.id} className="rounded-lg border border-border p-3 bg-muted/20">
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">ضد: {game.opponent}</div>
                              <div className="text-xs text-muted-foreground">
                                {game.color === 'white' ? 'أبيض' : 'أسود'} • {game.game_type} • {getTimeAgo(game.started_at)}
                              </div>
                            </div>
                            <Badge variant={getResultBadgeVariant(game.result)}>
                              {game.result}
                            </Badge>
                          </div>
                          {(game.status === 'active' || game.status === 'waiting') && (
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleEndGame(game.id)}
                                disabled={endingGameId === game.id}
                              >
                                {endingGameId === game.id ? 'جارٍ الإنهاء...' : 'إنهاء'}
                              </Button>
                              <Button size="sm" onClick={() => navigate(`/game?id=${game.id}`)}>
                                متابعة
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="font-cairo text-foreground">ملخص الأداء</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                 <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                   <span>انتصارات</span>
                   <Badge variant="outline" className="border-border">{user.wins || 0}</Badge>
                 </div>
                 <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                   <span>هزائم</span>
                   <Badge variant="outline" className="border-border">{user.losses || 0}</Badge>
                 </div>
                 <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                   <span>تعادل</span>
                   <Badge variant="outline" className="border-border">{user.draws || 0}</Badge>
                 </div>
                 <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                   <span>إجمالي المباريات</span>
                   <Badge variant="outline" className="border-border">{user.total_games || 0}</Badge>
                 </div>
                <div className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <span>نسبة الفوز</span>
                  <Badge variant="outline" className="border-border">
                    {user.win_rate ? user.win_rate.toFixed(1) : '0.0'}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Invites */}
            {invites.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Mail className="w-5 h-5 text-primary" />
                    الدعوات ({invites.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invites.map((invite) => (
                    <div key={invite.id} className="border border-border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={
                              hasCustomAvatar(invite.fromUser?.thumbnail)
                                ? invite.fromUser?.thumbnail
                                : undefined
                            }
                          />
                          <AvatarFallback>{getInitialsFromName(invite.fromUser?.username)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{invite.fromUser?.username || 'مستخدم غير معروف'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Crown className="w-3 h-3 text-muted-foreground" />
                            <span>{invite.fromUser?.rank || 1500}</span>
                            <span>•</span>
                            <span>{getTimeAgo(invite.date_time)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="default" className={getStatusColor(invite.status)}>
                              {getStatusText(invite.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {renderInviteButtons(invite)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {invites.length === 0 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Mail className="w-5 h-5 text-primary" />
                    الدعوات
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد دعوات جديدة</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
