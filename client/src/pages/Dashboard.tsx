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
  LogOut
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userService, UserProfile } from '@/services/userService';
import { friendService, Friend as FriendType } from '@/services/friendService';

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<FriendType[]>([]);
  const [invites, setInvites] = useState<GameInvite[]>([]);
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
        const friendsData = await friendService.getFriends();
        // تأكد من أن البيانات تأتي بالشكل الصحيح
        if (Array.isArray(friendsData)) {
          setFriends(friendsData);
        } else {
          console.error('Unexpected friends data format:', friendsData);
          setFriends([]);
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

  const handleAcceptInvite = (inviteId: string) => {
    // Update status to in-game when accepting invite
    updateStatus('in-game');
    // TODO: Implement accept invite logic
    toast({
      title: "تم قبول الدعوة",
      description: "جاري الانتقال إلى اللعبة...",
    });
  };

  const handleDeclineInvite = (inviteId: string) => {
    // TODO: Implement decline invite logic
    toast({
      title: "تم رفض الدعوة",
      description: "تم إرسال الرد إلى المرسل",
    });
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

  const refreshFriends = async () => {
    try {
      // Update status to online when refreshing friends
      updateStatus('online');
      const friendsData = await friendService.getFriends();
      console.log('Friends data:', friendsData); // للتصحيح
      // تأكد من أن البيانات تأتي بالشكل الصحيح
      if (Array.isArray(friendsData)) {
        setFriends(friendsData);
      } else {
        console.error('Unexpected friends data format:', friendsData);
        setFriends([]);
      }
    } catch (error: any) {
      console.error('Error refreshing friends:', error);
      toast({
        title: "خطأ في تحديث الأصدقاء",
        description: error.message || "فشل في تحديث قائمة الأصدقاء",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'in-game': return 'bg-primary';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'متاح';
      case 'in-game': return 'في مباراة';
      case 'offline': return 'غير متصل';
      default: return 'غير معروف';
    }
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
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="play" className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  ابدأ لعبة
                </TabsTrigger>
                <TabsTrigger value="friends" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  الأصدقاء
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

                  <Card className="hover:shadow-elegant transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-accent" />
                        ضد الحاسوب
                      </CardTitle>
                      <CardDescription>
                        تدرب مع الذكاء الاصطناعي
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" disabled>
                        قريباً
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-elegant transition-shadow">
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
                      <Button variant="outline" className="w-full" disabled>
                        قريباً
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

                             <TabsContent value="friends">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-amiri text-lg font-bold">الأصدقاء ({friends.length})</h3>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={refreshFriends}
                     className="text-xs"
                   >
                     تحديث
                   </Button>
                 </div>
                 <div className="space-y-4">
                   {friends.length === 0 ? (
                     <div className="text-center py-8">
                       <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                       <h3 className="font-amiri text-lg font-bold mb-2">لا توجد أصدقاء</h3>
                       <p className="text-muted-foreground">ابحث عن لاعبين وأضفهم كأصدقاء</p>
                     </div>
                   ) : (
                     friends.map((friend) => (
                       <Card key={friend.id}>
                         <CardContent className="p-4">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                               <div className="relative">
                                 <Avatar>
                                   <AvatarImage src={friend.thumbnail} />
                                   <AvatarFallback>{friend.username.charAt(0)}</AvatarFallback>
                                 </Avatar>
                                 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(friend.state || 'offline')}`} />
                               </div>
                               <div>
                                 <h3 className="font-cairo font-medium">{friend.username}</h3>
                                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                   <span>{getStatusText(friend.state || 'offline')}</span>
                                   <Badge variant="outline" className="text-xs">
                                     {friend.rank || 1200}
                                   </Badge>
                                 </div>
                               </div>
                             </div>
                             
                             {(friend.state === 'online' || friend.is_online) && (
                               <Button size="sm" variant="chess">
                                 تحدي
                               </Button>
                             )}
                           </div>
                         </CardContent>
                       </Card>
                     ))
                   )}
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
                    الدعوات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invites.map((invite) => (
                    <div key={invite.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={invite.from_user.avatar} />
                          <AvatarFallback>{invite.from_user.username.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{invite.from_user.username}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {invite.time_control} دقيقة
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="chess"
                          className="flex-1 text-xs"
                          onClick={() => handleAcceptInvite(invite.id)}
                        >
                          قبول
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 text-xs"
                          onClick={() => handleDeclineInvite(invite.id)}
                        >
                          رفض
                        </Button>
                      </div>
                    </div>
                  ))}
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