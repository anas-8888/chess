import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Home, 
  Users, 
  UserPlus, 
  Search, 
  Crown, 
  Clock, 
  MessageCircle,
  Check,
  X,
  MoreVertical,
  Mail,
  Shield
} from "lucide-react";

const Friends = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTime, setSelectedTime] = useState("10");
  const [friends, setFriends] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  // Mock data
  const mockFriends = [
    {
      id: 1,
      username: "أحمد محمد",
      avatar: "/placeholder.svg",
      status: "online",
      rating: 1245,
      lastSeen: "الآن",
      inGame: false
    },
    {
      id: 2,
      username: "سارة أحمد",
      avatar: "/placeholder.svg",
      status: "in-game",
      rating: 1156,
      lastSeen: "منذ 5 دقائق",
      inGame: true,
      currentGame: "ضد محمد علي"
    },
    {
      id: 3,
      username: "عمر خالد",
      avatar: "/placeholder.svg",
      status: "offline",
      rating: 1332,
      lastSeen: "منذ ساعتين",
      inGame: false
    }
  ];

  const mockInvites = [
    {
      id: 1,
      from: "ليلى أحمد",
      fromAvatar: "/placeholder.svg",
      timeControl: "10",
      createdAt: "منذ دقيقتين",
      expiresAt: "خلال 8 دقائق"
    },
    {
      id: 2,
      from: "يوسف محمد",
      fromAvatar: "/placeholder.svg",
      timeControl: "5",
      createdAt: "منذ 5 دقائق",
      expiresAt: "خلال 5 دقائق"
    }
  ];

  const mockPendingInvites = [
    {
      id: 1,
      to: "فاطمة سالم",
      toAvatar: "/placeholder.svg",
      timeControl: "15",
      sentAt: "منذ 3 دقائق",
      status: "pending"
    }
  ];

  useEffect(() => {
    loadFriendsData();
    loadInvites();
    setupSocketListeners();
  }, []);

  const loadFriendsData = async () => {
    try {
      // REST: GET /api/friends -> fetch user's friends list
      setFriends(mockFriends);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل قائمة الأصدقاء",
        variant: "destructive"
      });
    }
  };

  const loadInvites = async () => {
    try {
      // REST: GET /api/invites -> fetch pending invitations
      setInvites(mockInvites);
      setPendingInvites(mockPendingInvites);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل الدعوات",
        variant: "destructive"
      });
    }
  };

  const setupSocketListeners = () => {
    // SOCKET: socket.on('inviteCreated', (invite) => {
    //   setInvites(prev => [invite, ...prev]);
    //   toast({
    //     title: "دعوة جديدة",
    //     description: `${invite.from} يدعوك للعب`
    //   });
    // });

    // SOCKET: socket.on('inviteExpired', (inviteId) => {
    //   setInvites(prev => prev.filter(inv => inv.id !== inviteId));
    // });

    // SOCKET: socket.on('friendStatusChanged', (friendData) => {
    //   setFriends(prev => prev.map(friend => 
    //     friend.id === friendData.id ? { ...friend, ...friendData } : friend
    //   ));
    // });
  };

  const sendFriendRequest = async (username: string) => {
    try {
      // REST: POST /api/friends/request -> send friend request
      toast({
        title: "تم إرسال طلب الصداقة",
        description: `تم إرسال طلب صداقة إلى ${username}`
      });
      setSearchTerm("");
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من إرسال طلب الصداقة",
        variant: "destructive"
      });
    }
  };

  const sendGameInvite = async (friendId: number, timeControl: string) => {
    try {
      // SOCKET: socket.emit('sendInvite', {
      //   toUserId: friendId,
      //   timeControl: timeControl,
      //   gameType: 'standard'
      // });
      
      toast({
        title: "تم إرسال الدعوة",
        description: `تم إرسال دعوة لمباراة ${timeControl} دقائق`
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من إرسال الدعوة",
        variant: "destructive"
      });
    }
  };

  const acceptInvite = async (inviteId: number) => {
    try {
      // REST: POST /api/invites/${inviteId}/accept -> accept invitation
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
      toast({
        title: "خطأ",
        description: "لم نتمكن من قبول الدعوة",
        variant: "destructive"
      });
    }
  };

  const declineInvite = async (inviteId: number) => {
    try {
      // REST: POST /api/invites/${inviteId}/decline -> decline invitation
      setInvites(prev => prev.filter(inv => inv.id !== inviteId));
      toast({
        title: "تم رفض الدعوة",
        description: "تم رفض الدعوة بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من رفض الدعوة",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string, inGame?: boolean, currentGame?: string) => {
    if (status === "online" && !inGame) {
      return <Badge className="bg-green-500 text-white">متصل</Badge>;
    } else if (status === "in-game" || inGame) {
      return <Badge className="bg-yellow-500 text-white">في مباراة</Badge>;
    } else {
      return <Badge variant="secondary">غير متصل</Badge>;
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <Home className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">الأصدقاء والدعوات</h1>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{friends.length} صديق</span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span>{invites.length} دعوة</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="friends" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">الأصدقاء ({friends.length})</TabsTrigger>
            <TabsTrigger value="invites">
              الدعوات الواردة ({invites.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              الدعوات المرسلة ({pendingInvites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-6">
            {/* Add Friend */}
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  إضافة صديق جديد
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="ابحث باسم المستخدم..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Button onClick={() => sendFriendRequest(searchTerm)} disabled={!searchTerm}>
                    إرسال طلب
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Friends List */}
            <div className="grid gap-4">
              {filteredFriends.map((friend) => (
                <Card key={friend.id} className="hover:shadow-card transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={friend.avatar} />
                          <AvatarFallback>{friend.username[0]}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold font-cairo">{friend.username}</h3>
                            {getStatusBadge(friend.status, friend.inGame, friend.currentGame)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Crown className="h-3 w-3" />
                              <span>{friend.rating}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{friend.lastSeen}</span>
                            </div>
                          </div>
                          {friend.inGame && friend.currentGame && (
                            <div className="text-xs text-yellow-600">
                              {friend.currentGame}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {friend.status === "online" && !friend.inGame && (
                          <div className="flex items-center gap-2">
                            <Select defaultValue={selectedTime} onValueChange={setSelectedTime}>
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 د</SelectItem>
                                <SelectItem value="10">10 د</SelectItem>
                                <SelectItem value="15">15 د</SelectItem>
                                <SelectItem value="30">30 د</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              onClick={() => sendGameInvite(friend.id, selectedTime)}
                              variant="chess"
                              size="sm"
                            >
                              دعوة للعب
                            </Button>
                          </div>
                        )}
                        <Button variant="ghost" size="icon">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredFriends.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد أصدقاء</h3>
                    <p className="text-muted-foreground">ابدأ بإضافة أصدقاء جدد للعب معهم</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="invites" className="space-y-4">
            {invites.map((invite) => (
              <Card key={invite.id} className="border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={invite.fromAvatar} />
                        <AvatarFallback>{invite.from[0]}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h3 className="font-semibold font-cairo">{invite.from}</h3>
                        <div className="text-sm text-muted-foreground">
                          يدعوك لمباراة {invite.timeControl} دقائق • {invite.createdAt}
                        </div>
                        <div className="text-xs text-red-500">
                          تنتهي {invite.expiresAt}
                        </div>
                      </div>
                    </div>

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
                        onClick={() => declineInvite(invite.id)}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4 ml-1" />
                        رفض
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {invites.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد دعوات</h3>
                  <p className="text-muted-foreground">لا توجد دعوات جديدة في الوقت الحالي</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingInvites.map((invite) => (
              <Card key={invite.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={invite.toAvatar} />
                        <AvatarFallback>{invite.to[0]}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h3 className="font-semibold font-cairo">{invite.to}</h3>
                        <div className="text-sm text-muted-foreground">
                          دعوة لمباراة {invite.timeControl} دقائق • {invite.sentAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">في الانتظار</Badge>
                      <Button variant="ghost" size="sm">
                        إلغاء
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {pendingInvites.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد دعوات معلقة</h3>
                  <p className="text-muted-foreground">جميع دعواتك المرسلة تم الرد عليها</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Friends;