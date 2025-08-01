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
  Clock, 
  User,
  Settings,
  LogOut,
  Check,
  X,
  MessageCircle,
  Crown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userService, UserProfile } from '@/services/userService';
import { inviteService } from '@/services/inviteService';
import { useNavigate } from 'react-router-dom';


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

const Dashboard = () => {
  const { user: authUser, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);

  const [invites, setInvites] = useState<any[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const { updateStatus } = useAuth();

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
        const userProfile = await userService.getCurrentUserProfile();
        setUser(userProfile);
        
        // تحميل الدعوات الواردة
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
    // Update status to in-game
    updateStatus('in-game');
    // Navigate to game page
    window.location.href = '/game';
  };

  const handleAcceptInvite = async (inviteId: string) => {
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
      await inviteService.acceptInvite(inviteId);
      toast({
        title: "تم قبول الدعوة",
        description: "جاري الانتقال إلى المباراة..."
      });

      // Remove from invites list
      setInvites(prev => prev.filter(inv => inv.id !== inviteId));

      // Navigate to game
      setTimeout(() => {
        navigate("/game?id=invited_game_123");
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
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'game_started':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // دالة معالجة أزرار الدعوة بناءً على الحالة
  const renderInviteButtons = (invite: any) => {
    const status = invite.status;
    
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => acceptInvite(invite.id)}
              variant="chess"
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
            variant="chess"
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
            variant="chess"
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">
                  {user.username.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-amiri text-xl font-bold">{user.username}</h2>
                                 <div className="flex items-center gap-2">
                   <Badge variant="secondary">
                     <Trophy className="w-3 h-3 ml-1" />
                     {user.rating || 1200}
                   </Badge>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="play" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="play" className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  ابدأ لعبة
                </TabsTrigger>
                <TabsTrigger value="games" className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  المباريات
                </TabsTrigger>
              </TabsList>

              <TabsContent value="play">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="hover:shadow-elegant transition-shadow cursor-pointer"
                        onClick={handleStartQuickGame}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary" />
                        لعبة سريعة
                      </CardTitle>
                      <CardDescription>
                        ابحث عن خصم عشوائي وابدأ المباراة فوراً
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="chess" className="w-full">
                        بحث عن خصم
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-elegant transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-secondary" />
                        تحدي صديق
                      </CardTitle>
                      <CardDescription>
                        أرسل دعوة لأحد أصدقائك لبدء مباراة
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="secondary" className="w-full" onClick={() => window.location.href = '/friends'}>
                        اختر صديق
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-elegant transition-shadow cursor-pointer"
                        onClick={() => navigate('/ai-loading')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-accent" />
                        ضد الذكاء الاصطناعي
                      </CardTitle>
                      <CardDescription>
                        تدرب مع الذكاء الاصطناعي
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        ابدأ اللعب
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-elegant transition-shadow cursor-pointer"
                        onClick={() => window.location.href = '/connect-board'}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-primary-glow" />
                        اللوحة المادية
                      </CardTitle>
                      <CardDescription>
                        العب بالشطرنج المادي المتصل
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        اتصال باللوحة
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

                             

              <TabsContent value="games">
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-amiri text-xl font-bold mb-2">لا توجد مباريات حالياً</h3>
                  <p className="text-muted-foreground">ابدأ لعبة جديدة لتظهر هنا</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="font-amiri">إحصائياتك</CardTitle>
              </CardHeader>
                             <CardContent className="space-y-4">
                 <div className="flex justify-between">
                   <span>انتصارات</span>
                   <Badge variant="secondary">{user.wins || 0}</Badge>
                 </div>
                 <div className="flex justify-between">
                   <span>هزائم</span>
                   <Badge variant="destructive">{user.losses || 0}</Badge>
                 </div>
                 <div className="flex justify-between">
                   <span>تعادل</span>
                   <Badge variant="outline">{user.draws || 0}</Badge>
                 </div>
                 <div className="flex justify-between">
                   <span>إجمالي المباريات</span>
                   <Badge variant="outline">{user.total_games || 0}</Badge>
                 </div>
                <div className="flex justify-between">
                  <span>نسبة الفوز</span>
                  <Badge variant="outline">
                    {user.win_rate ? user.win_rate.toFixed(1) : '0.0'}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Invites */}
            {invites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    الدعوات الواردة ({invites.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invites.map((invite) => (
                    <div key={invite.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={invite.fromUser?.thumbnail} />
                          <AvatarFallback>{invite.fromUser?.username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{invite.fromUser?.username || 'مستخدم غير معروف'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Crown className="w-3 h-3" />
                            <span>{invite.fromUser?.rank || 1200}</span>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    الدعوات الواردة
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