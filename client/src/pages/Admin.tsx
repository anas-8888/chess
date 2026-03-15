import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/urls";
import { authService } from "@/services/authService";
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
  Activity,
} from "lucide-react";

type AdminStats = {
  totalUsers: number;
  onlineUsers: number;
  activeGames: number;
  pendingInvites: number;
  bannedUsers: number;
  gamesPlayedToday: number;
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  status: "online" | "offline" | "in-game";
  rating: number;
  gamesPlayed: number;
  type: "user" | "admin";
  banned: boolean;
  joinedAt: string;
  lastActiveAt: string;
};

type AdminGame = {
  id: number;
  whitePlayer: string;
  blackPlayer: string;
  status: "waiting" | "active" | "ended";
  initialTime: number;
  startedAt: string;
  endedAt: string | null;
  moves: number;
  gameType: string;
};

type AdminInvite = {
  id: number;
  fromUsername: string;
  toUsername: string;
  timeControl: number;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  gameType: string;
};

type AdminEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type Paginated<T> = {
  items: T[];
};

const defaultStats: AdminStats = {
  totalUsers: 0,
  onlineUsers: 0,
  activeGames: 0,
  pendingInvites: 0,
  bannedUsers: 0,
  gamesPlayedToday: 0,
};

const toArabicRelative = (isoDate?: string | null): string => {
  if (!isoDate) return "غير متوفر";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "غير متوفر";

  const now = Date.now();
  const diffMinutes = Math.floor((now - date.getTime()) / 60000);
  if (diffMinutes <= 0) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `منذ ${diffDays} يوم`;

  return date.toLocaleDateString("ar-SA");
};

const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return "غير متوفر";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return date.toLocaleDateString("ar-SA");
};

const formatTimeControl = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "-";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}+0`;
};

const Admin = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [stats, setStats] = useState<AdminStats>(defaultStats);

  const token = authService.getToken();

  const fetchAdmin = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    if (!token) {
      throw new Error("لم يتم العثور على جلسة تسجيل دخول");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = body?.message || "فشل في تنفيذ الطلب";
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return body as T;
  };

  const checkAdminAccess = async () => {
    try {
      const response = await fetchAdmin<AdminEnvelope<{ type: "admin" | "user" }>>("/api/admin/access");
      if (response?.data?.type !== "admin") {
        throw new Error("ليس لديك صلاحيات مدير");
      }
    } catch (error) {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول إلى لوحة الإدارة",
        variant: "destructive",
      });
      window.location.href = "/dashboard";
      throw error;
    }
  };

  const loadAdminData = async () => {
    const [statsResponse, usersResponse, gamesResponse, invitesResponse] = await Promise.all([
      fetchAdmin<AdminEnvelope<AdminStats>>("/api/admin/stats"),
      fetchAdmin<AdminEnvelope<Paginated<AdminUser>>>(`/api/admin/users?limit=200&search=${encodeURIComponent(searchTerm)}`),
      fetchAdmin<AdminEnvelope<Paginated<AdminGame>>>("/api/admin/games?limit=200"),
      fetchAdmin<AdminEnvelope<Paginated<AdminInvite>>>("/api/admin/invites?limit=200"),
    ]);

    setStats(statsResponse.data || defaultStats);
    setUsers(usersResponse.data?.items || []);
    setGames(gamesResponse.data?.items || []);
    setInvites(invitesResponse.data?.items || []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        await checkAdminAccess();
        await loadAdminData();
      } catch {
        // handled in helpers
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAdminData().catch(() => {
        toast({
          title: "خطأ",
          description: "تعذر تحديث بيانات الإدارة",
          variant: "destructive",
        });
      });
    }
  }, [searchTerm]);

  const banUser = async (userId: number) => {
    try {
      await fetchAdmin(`/api/admin/users/${userId}/ban`, { method: "POST" });
      await loadAdminData();
      toast({ title: "تم", description: "تم حظر المستخدم بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل في حظر المستخدم",
        variant: "destructive",
      });
    }
  };

  const unbanUser = async (userId: number) => {
    try {
      await fetchAdmin(`/api/admin/users/${userId}/unban`, { method: "POST" });
      await loadAdminData();
      toast({ title: "تم", description: "تم إلغاء حظر المستخدم بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل في إلغاء الحظر",
        variant: "destructive",
      });
    }
  };

  const endGame = async (gameId: number) => {
    try {
      await fetchAdmin(`/api/admin/games/${gameId}/end`, { method: "POST" });
      await loadAdminData();
      toast({ title: "تم", description: "تم إنهاء المباراة بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل في إنهاء المباراة",
        variant: "destructive",
      });
    }
  };

  const deleteInvite = async (inviteId: number) => {
    try {
      await fetchAdmin(`/api/admin/invites/${inviteId}`, { method: "DELETE" });
      await loadAdminData();
      toast({ title: "تم", description: "تم حذف الدعوة بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل في حذف الدعوة",
        variant: "destructive",
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
      default:
        return <Badge variant="secondary">غير متصل</Badge>;
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        user =>
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center" dir="rtl">
        جاري تحميل لوحة الإدارة...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card><CardContent className="p-4 text-center"><Users className="h-8 w-8 text-primary mx-auto mb-2" /><div className="text-2xl font-bold">{stats.totalUsers}</div><div className="text-xs text-muted-foreground">إجمالي المستخدمين</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Activity className="h-8 w-8 text-green-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.onlineUsers}</div><div className="text-xs text-muted-foreground">متصل الآن</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><GamepadIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.activeGames}</div><div className="text-xs text-muted-foreground">مباريات نشطة</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.pendingInvites}</div><div className="text-xs text-muted-foreground">دعوات معلقة</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Ban className="h-8 w-8 text-red-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.bannedUsers}</div><div className="text-xs text-muted-foreground">محظورين</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.gamesPlayedToday}</div><div className="text-xs text-muted-foreground">مباريات اليوم</div></CardContent></Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="games">المباريات</TabsTrigger>
            <TabsTrigger value="invites">الدعوات</TabsTrigger>
            <TabsTrigger value="reports">البلاغات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="ابحث في المستخدمين..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </CardContent>
            </Card>

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
                      <TableHead>الدور</TableHead>
                      <TableHead>التقييم</TableHead>
                      <TableHead>المباريات</TableHead>
                      <TableHead>تاريخ الانضمام</TableHead>
                      <TableHead>آخر نشاط</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{user.username[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium font-cairo">{user.username}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.banned ? <Badge variant="destructive">محظور</Badge> : getStatusBadge(user.status)}</TableCell>
                        <TableCell>{user.type === "admin" ? <Badge variant="outline">مدير</Badge> : <Badge variant="secondary">مستخدم</Badge>}</TableCell>
                        <TableCell>{user.rating}</TableCell>
                        <TableCell>{user.gamesPlayed}</TableCell>
                        <TableCell>{formatDate(user.joinedAt)}</TableCell>
                        <TableCell>{toArabicRelative(user.lastActiveAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" disabled>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.type === "admin" ? null : user.banned ? (
                              <Button onClick={() => unbanUser(user.id)} variant="outline" size="icon">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button onClick={() => banUser(user.id)} variant="outline" size="icon">
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
                <CardDescription>مراقبة والتحكم في المباريات</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>معرف المباراة</TableHead>
                      <TableHead>اللاعبون</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead>البداية</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحركات</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map(game => (
                      <TableRow key={game.id}>
                        <TableCell className="font-mono text-sm">{game.id}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{game.whitePlayer} (أبيض)</div>
                            <div>{game.blackPlayer} (أسود)</div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={game.status === "active" ? "default" : "secondary"}>{game.status === "active" ? "جارية" : game.status === "ended" ? "منتهية" : "بانتظار البدء"}</Badge></TableCell>
                        <TableCell>{formatTimeControl(game.initialTime)}</TableCell>
                        <TableCell>{toArabicRelative(game.startedAt)}</TableCell>
                        <TableCell>{game.gameType}</TableCell>
                        <TableCell>{game.moves}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" disabled>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {game.status !== "ended" && (
                              <Button onClick={() => endGame(game.id)} variant="outline" size="icon">
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
                <CardDescription>مراقبة الدعوات المعلقة والمنتهية</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>من</TableHead>
                      <TableHead>إلى</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>تاريخ الإنشاء</TableHead>
                      <TableHead>انتهاء الصلاحية</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map(invite => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.fromUsername}</TableCell>
                        <TableCell>{invite.toUsername}</TableCell>
                        <TableCell>{invite.timeControl} دقيقة</TableCell>
                        <TableCell><Badge variant="secondary">{invite.status}</Badge></TableCell>
                        <TableCell>{toArabicRelative(invite.createdAt)}</TableCell>
                        <TableCell className="text-red-500">{toArabicRelative(invite.expiresAt)}</TableCell>
                        <TableCell>
                          <Button onClick={() => deleteInvite(invite.id)} variant="outline" size="icon">
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
                <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد بلاغات حالياً</h3>
                <p className="text-muted-foreground">يمكن إضافة نظام البلاغات لاحقاً حسب متطلباتك</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
