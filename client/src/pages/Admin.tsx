import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Home, 
  Shield, 
  Users, 
  GamepadIcon, 
  Mail, 
  Search, 
  Ban, 
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  BarChart3,
  Activity
} from "lucide-react";

const Admin = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  // Mock data
  const mockUsers = [
    {
      id: 1,
      username: "أحمد محمد",
      email: "ahmed@example.com",
      avatar: "/placeholder.svg",
      status: "online",
      rating: 1245,
      gamesPlayed: 150,
      joinedAt: "2024-01-15",
      banned: false,
      lastActive: "الآن"
    },
    {
      id: 2,
      username: "سارة أحمد",
      email: "sara@example.com",
      avatar: "/placeholder.svg",
      status: "in-game",
      rating: 1156,
      gamesPlayed: 89,
      joinedAt: "2024-02-20",
      banned: false,
      lastActive: "منذ 5 دقائق"
    },
    {
      id: 3,
      username: "محمد سبام",
      email: "spam@example.com",
      avatar: "/placeholder.svg",
      status: "offline",
      rating: 800,
      gamesPlayed: 15,
      joinedAt: "2024-03-01",
      banned: true,
      lastActive: "منذ يومين"
    }
  ];

  const mockGames = [
    {
      id: "game_001",
      whitePlayer: "أحمد محمد",
      blackPlayer: "سارة أحمد",
      status: "active",
      startedAt: "منذ 15 دقيقة",
      timeControl: "10+0",
      moves: 23
    },
    {
      id: "game_002",
      whitePlayer: "عمر خالد",
      blackPlayer: "ليلى محمد",
      status: "finished",
      startedAt: "منذ ساعة",
      timeControl: "5+3",
      moves: 45,
      result: "1-0"
    }
  ];

  const mockInvites = [
    {
      id: 1,
      from: "يوسف أحمد",
      to: "فاطمة سالم",
      timeControl: "15+10",
      status: "pending",
      createdAt: "منذ 5 دقائق",
      expiresAt: "خلال 5 دقائق"
    }
  ];

  const mockStats = {
    totalUsers: 1247,
    onlineUsers: 89,
    activeGames: 23,
    pendingInvites: 7,
    bannedUsers: 12,
    gamesPlayedToday: 156
  };

  useEffect(() => {
    checkAdminAccess();
    loadAdminData();
  }, []);

  const checkAdminAccess = async () => {
    // REST: GET /api/me -> check if user has admin role
    const userRole = "admin"; // Mock: assume user is admin
    if (userRole !== "admin") {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول لهذه الصفحة",
        variant: "destructive"
      });
      // Redirect to dashboard
      return;
    }
  };

  const loadAdminData = async () => {
    try {
      // REST: GET /api/admin/users -> fetch all users
      setUsers(mockUsers);
      
      // REST: GET /api/admin/games -> fetch all games
      setGames(mockGames);
      
      // REST: GET /api/admin/invites -> fetch all invites
      setInvites(mockInvites);
      
      // REST: GET /api/admin/stats -> fetch admin statistics
      setStats(mockStats);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل بيانات الإدارة",
        variant: "destructive"
      });
    }
  };

  const banUser = async (userId: number) => {
    try {
      // REST: POST /api/admin/users/${userId}/ban -> ban user
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, banned: true } : user
      ));
      toast({
        title: "تم حظر المستخدم",
        description: "تم حظر المستخدم بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من حظر المستخدم",
        variant: "destructive"
      });
    }
  };

  const unbanUser = async (userId: number) => {
    try {
      // REST: POST /api/admin/users/${userId}/unban -> unban user
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, banned: false } : user
      ));
      toast({
        title: "تم إلغاء الحظر",
        description: "تم إلغاء حظر المستخدم بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من إلغاء حظر المستخدم",
        variant: "destructive"
      });
    }
  };

  const endGame = async (gameId: string) => {
    try {
      // REST: POST /api/admin/games/${gameId}/end -> force end game
      setGames(prev => prev.map(game => 
        game.id === gameId ? { ...game, status: "ended" } : game
      ));
      toast({
        title: "تم إنهاء المباراة",
        description: "تم إنهاء المباراة قسرياً"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من إنهاء المباراة",
        variant: "destructive"
      });
    }
  };

  const deleteInvite = async (inviteId: number) => {
    try {
      // REST: DELETE /api/admin/invites/${inviteId} -> delete invite
      setInvites(prev => prev.filter(invite => invite.id !== inviteId));
      toast({
        title: "تم حذف الدعوة",
        description: "تم حذف الدعوة بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من حذف الدعوة",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-500 text-white">متصل</Badge>;
      case "in-game":
        return <Badge className="bg-yellow-500 text-white">في مباراة</Badge>;
      case "offline":
        return <Badge variant="secondary">غير متصل</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">لوحة الإدارة</h1>
              </div>
            </div>

            <Badge variant="outline" className="text-primary border-primary">
              <Shield className="ml-1 h-3 w-3" />
              مدير
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <div className="text-xs text-muted-foreground">إجمالي المستخدمين</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.onlineUsers}</div>
              <div className="text-xs text-muted-foreground">متصل الآن</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <GamepadIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.activeGames}</div>
              <div className="text-xs text-muted-foreground">مباريات نشطة</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.pendingInvites}</div>
              <div className="text-xs text-muted-foreground">دعوات معلقة</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Ban className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.bannedUsers}</div>
              <div className="text-xs text-muted-foreground">محظورين</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.gamesPlayedToday}</div>
              <div className="text-xs text-muted-foreground">مباريات اليوم</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="games">المباريات</TabsTrigger>
            <TabsTrigger value="invites">الدعوات</TabsTrigger>
            <TabsTrigger value="reports">البلاغات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Search */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="ابحث في المستخدمين..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">قائمة المستخدمين</CardTitle>
                <CardDescription>إدارة حسابات المستخدمين</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التقييم</TableHead>
                      <TableHead>المباريات</TableHead>
                      <TableHead>تاريخ الانضمام</TableHead>
                      <TableHead>آخر نشاط</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>{user.username[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium font-cairo">{user.username}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive">محظور</Badge>
                          ) : (
                            getStatusBadge(user.status)
                          )}
                        </TableCell>
                        <TableCell>{user.rating}</TableCell>
                        <TableCell>{user.gamesPlayed}</TableCell>
                        <TableCell>{user.joinedAt}</TableCell>
                        <TableCell>{user.lastActive}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.banned ? (
                              <Button 
                                onClick={() => unbanUser(user.id)}
                                variant="outline" 
                                size="icon"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                onClick={() => banUser(user.id)}
                                variant="outline" 
                                size="icon"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">إدارة المباريات</CardTitle>
                <CardDescription>مراقبة والتحكم في المباريات الجارية</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>معرف المباراة</TableHead>
                      <TableHead>اللاعبون</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التحكم في الوقت</TableHead>
                      <TableHead>بدأت منذ</TableHead>
                      <TableHead>الحركات</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className="font-mono text-sm">{game.id}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{game.whitePlayer} (أبيض)</div>
                            <div>{game.blackPlayer} (أسود)</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={game.status === "active" ? "default" : "secondary"}>
                            {game.status === "active" ? "جارية" : "منتهية"}
                          </Badge>
                        </TableCell>
                        <TableCell>{game.timeControl}</TableCell>
                        <TableCell>{game.startedAt}</TableCell>
                        <TableCell>{game.moves}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {game.status === "active" && (
                              <Button 
                                onClick={() => endGame(game.id)}
                                variant="outline" 
                                size="icon"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">إدارة الدعوات</CardTitle>
                <CardDescription>مراقبة الدعوات المعلقة</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>من</TableHead>
                      <TableHead>إلى</TableHead>
                      <TableHead>التحكم في الوقت</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>تم الإنشاء</TableHead>
                      <TableHead>تنتهي</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.from}</TableCell>
                        <TableCell>{invite.to}</TableCell>
                        <TableCell>{invite.timeControl}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">معلقة</Badge>
                        </TableCell>
                        <TableCell>{invite.createdAt}</TableCell>
                        <TableCell className="text-red-500">{invite.expiresAt}</TableCell>
                        <TableCell>
                          <Button 
                            onClick={() => deleteInvite(invite.id)}
                            variant="outline" 
                            size="icon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardContent className="text-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد بلاغات</h3>
                <p className="text-muted-foreground">لا توجد بلاغات جديدة تحتاج للمراجعة</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;