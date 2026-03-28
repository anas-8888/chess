import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppNavHeader from "@/components/AppNavHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/urls";
import { authService } from "@/services/authService";
import { getInitialsFromName, hasCustomAvatar } from "@/utils/avatar";
import {
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
  Puzzle,
  PlusCircle,
  Save,
  Pencil,
  UserPlus,
  UserRoundX,
  PlayCircle,
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
  puzzleLevel?: number;
  gamesPlayed: number;
  type: "user" | "admin";
  banned: boolean;
  bannedAt?: string | null;
  bannedReason?: string | null;
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
  currentTurn?: "white" | "black";
  winnerId?: number | null;
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

type AdminPuzzle = {
  id: number;
  name: string;
  level: "easy" | "medium" | "hard";
  fen: string;
  details: string;
  objective: string;
  startsWith: "white" | "black";
  points: number;
  orderIndex: number;
  isActive: boolean;
  solution: Array<{ actor?: "player" | "opponent"; uci?: string; san?: string; raw?: string }> | string[];
};

type AdminEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type UserFriend = {
  friendshipId: number;
  status: string;
  createdAt: string;
  friendId: number;
  friendUsername: string;
  friendAvatar: string | null;
  friendRank: number;
  friendState: "online" | "offline" | "in-game";
};

type UserGame = {
  id: number;
  status: "waiting" | "active" | "ended";
  gameType: string;
  initialTime: number;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentTurn: "white" | "black";
  winnerId: number | null;
  startedAt: string;
  endedAt: string | null;
  whitePlayer: string;
  blackPlayer: string;
  moves: number;
};

type ReplayGameSource = {
  id: number;
  status: "waiting" | "active" | "ended";
  gameType: string;
  startedAt: string;
  endedAt: string | null;
  whitePlayer: string;
  blackPlayer: string;
};

type AdminUserDetails = {
  user: {
    id: number;
    username: string;
    email: string;
    type: "user" | "admin";
    state: "online" | "offline" | "in-game";
    rank: number;
    puzzleLevel: number;
    avatar: string | null;
    banned: boolean;
    bannedAt: string | null;
    bannedReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  friends: UserFriend[];
  games: UserGame[];
  stats: { friendsCount: number; gamesCount: number };
};

type AdminGameDetails = {
  game: {
    id: number;
    status: "waiting" | "active" | "ended";
    gameType: "friend" | "ranked" | "ai" | "puzzle";
    aiLevel: number | null;
    initialTime: number;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    whitePlayMethod: "phone" | "physical_board";
    blackPlayMethod: "phone" | "physical_board";
    currentFen: string;
    currentTurn: "white" | "black";
    winnerId: number | null;
    whiteRankChange: number | null;
    blackRankChange: number | null;
    startedAt: string;
    endedAt: string | null;
    whitePlayerId: number;
    whitePlayer: string;
    blackPlayerId: number;
    blackPlayer: string;
  };
  moves: Array<{
    id: number;
    moveNumber: number;
    playerId: number;
    playerName: string;
    uci: string;
    san: string;
    fenAfter: string;
    createdAt: string;
  }>;
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

const ADMIN_TAB_STORAGE_KEY = "admin_active_tab_v1";
const ADMIN_TAB_VALUES = ["users", "games", "invites", "puzzles"] as const;
type AdminTab = (typeof ADMIN_TAB_VALUES)[number];

const normalizeAdminTab = (value: string | null | undefined): AdminTab => {
  if (value && (ADMIN_TAB_VALUES as readonly string[]).includes(value)) {
    return value as AdminTab;
  }
  return "users";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<Record<AdminTab, boolean>>({
    users: false,
    games: false,
    invites: false,
    puzzles: false,
  });
  const [userFilters, setUserFilters] = useState({
    query: "",
    status: "all" as "all" | "online" | "offline" | "in-game",
    role: "all" as "all" | "user" | "admin",
    banned: "all" as "all" | "banned" | "not-banned",
  });
  const [gameFilters, setGameFilters] = useState({
    query: "",
    status: "all" as "all" | "waiting" | "active" | "ended",
    type: "all" as "all" | "friend" | "ranked" | "ai" | "puzzle",
    minMoves: "",
    maxMoves: "",
  });
  const [inviteFilters, setInviteFilters] = useState({
    query: "",
    status: "all",
    gameType: "all",
  });
  const [puzzleFilters, setPuzzleFilters] = useState({
    query: "",
    level: "all" as "all" | "easy" | "medium" | "hard",
    isActive: "all" as "all" | "active" | "inactive",
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [savingPuzzle, setSavingPuzzle] = useState(false);
  const [isPuzzleFormModalOpen, setIsPuzzleFormModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const fromQuery = normalizeAdminTab(new URLSearchParams(window.location.search).get("tab"));
    if (fromQuery !== "users") return fromQuery;
    const fromStorage =
      typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY) : null;
    return normalizeAdminTab(fromStorage);
  });
  const [puzzleDeleteCandidate, setPuzzleDeleteCandidate] = useState<AdminPuzzle | null>(null);
  const [editingPuzzleId, setEditingPuzzleId] = useState<number | null>(null);
  const [puzzleForm, setPuzzleForm] = useState({
    name: "",
    level: "easy" as "easy" | "medium" | "hard",
    fen: "",
    objective: "",
    details: "",
    startsWith: "white" as "white" | "black",
    points: 10,
    orderIndex: 0,
    isActive: true,
    solutionText: "",
  });
  const [stats, setStats] = useState<AdminStats>(defaultStats);
  const [userDeleteCandidate, setUserDeleteCandidate] = useState<AdminUser | null>(null);
  const [inviteDeleteCandidate, setInviteDeleteCandidate] = useState<AdminInvite | null>(null);
  const [userDetails, setUserDetails] = useState<AdminUserDetails | null>(null);
  const [gameDetails, setGameDetails] = useState<AdminGameDetails | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [loadingGameDetails, setLoadingGameDetails] = useState(false);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [isGameDetailsModalOpen, setIsGameDetailsModalOpen] = useState(false);
  const [isUserFormModalOpen, setIsUserFormModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [updatingGame, setUpdatingGame] = useState(false);
  const [gameEdit, setGameEdit] = useState({
    status: "waiting" as "waiting" | "active" | "ended",
    initialTime: 600,
    whiteTimeLeft: 600,
    blackTimeLeft: 600,
    currentTurn: "white" as "white" | "black",
    winnerId: "",
    gameType: "friend" as "friend" | "ranked" | "ai" | "puzzle",
    whitePlayMethod: "phone" as "phone" | "physical_board",
    blackPlayMethod: "phone" as "phone" | "physical_board",
    currentFen: "startpos",
  });
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    password: "",
    type: "user" as "user" | "admin",
    rating: 1500,
    puzzleLevel: 1,
    status: "offline" as "online" | "offline" | "in-game",
    thumbnail: "",
    banned: false,
    bannedReason: "",
  });

  const token = authService.getToken();

  const toggleAdvancedFilter = (tab: AdminTab) => {
    setShowAdvancedFilters(prev => ({ ...prev, [tab]: !prev[tab] }));
  };

  const fetchAdmin = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
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
  }, [token]);

  const parseSolutionText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("يجب إدخال مسار الحل");
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore and fallback to line-based parsing
    }

    const rows = trimmed
      .split(/\r?\n/)
      .map(row => row.trim())
      .filter(Boolean);
    if (!rows.length) {
      throw new Error("حل اللغز غير صالح");
    }
    return rows;
  };

  const toSolutionText = (solution: AdminPuzzle["solution"]) => {
    try {
      return JSON.stringify(solution, null, 2);
    } catch {
      return "";
    }
  };

  const resetPuzzleForm = () => {
    setEditingPuzzleId(null);
    setPuzzleForm({
      name: "",
      level: "easy",
      fen: "",
      objective: "",
      details: "",
      startsWith: "white",
      points: 10,
      orderIndex: 0,
      isActive: true,
      solutionText: "",
    });
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      username: "",
      email: "",
      password: "",
      type: "user",
      rating: 1500,
      puzzleLevel: 1,
      status: "offline",
      thumbnail: "",
      banned: false,
      bannedReason: "",
    });
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username || "",
      email: user.email || "",
      password: "",
      type: user.type || "user",
      rating: Number(user.rating || 1500),
      puzzleLevel: Number(user.puzzleLevel || 1),
      status: user.status || "offline",
      thumbnail: user.avatar || "",
      banned: Boolean(user.banned),
      bannedReason: user.bannedReason || "",
    });
    setIsUserFormModalOpen(true);
  };

  useEffect(() => {
    const tabFromQuery = normalizeAdminTab(searchParams.get("tab"));
    if (tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tabFromQuery);
      }
    }
  }, [searchParams, activeTab]);

  const updateTabPersistence = (tab: AdminTab) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleTabChange = (value: string) => {
    const safeTab = normalizeAdminTab(value);
    setActiveTab(safeTab);
    updateTabPersistence(safeTab);
  };

  const checkAdminAccess = useCallback(async () => {
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
  }, [fetchAdmin, toast]);

  const loadAdminData = useCallback(async () => {
    const [statsResponse, usersResponse, gamesResponse, invitesResponse, puzzlesResponse] = await Promise.all([
      fetchAdmin<AdminEnvelope<AdminStats>>("/api/admin/stats"),
      fetchAdmin<AdminEnvelope<Paginated<AdminUser>>>("/api/admin/users?limit=200"),
      fetchAdmin<AdminEnvelope<Paginated<AdminGame>>>("/api/admin/games?limit=200"),
      fetchAdmin<AdminEnvelope<Paginated<AdminInvite>>>("/api/admin/invites?limit=200"),
      fetchAdmin<{ puzzles: AdminPuzzle[] }>("/api/puzzles?limit=100&includeInactive=1"),
    ]);

    setStats(statsResponse.data || defaultStats);
    setUsers(usersResponse.data?.items || []);
    setGames(gamesResponse.data?.items || []);
    setInvites(invitesResponse.data?.items || []);
    setPuzzles(puzzlesResponse?.puzzles || []);
  }, [fetchAdmin]);

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
  }, [checkAdminAccess, loadAdminData]);

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

  const saveUser = async () => {
    try {
      setSavingUser(true);
      const payload: Record<string, unknown> = {
        username: userForm.username.trim(),
        email: userForm.email.trim(),
        type: userForm.type,
        rank: Number(userForm.rating),
        puzzle_level: Number(userForm.puzzleLevel),
        state: userForm.status,
        thumbnail: userForm.thumbnail.trim() || "/img/default-avatar.png",
        is_banned: userForm.banned,
        banned_reason: userForm.bannedReason.trim() || null,
      };

      if (userForm.password.trim()) {
        payload.password = userForm.password.trim();
      }

      if (!editingUserId && !userForm.password.trim()) {
        throw new Error("كلمة المرور مطلوبة عند إنشاء مستخدم جديد");
      }

      if (editingUserId) {
        await fetchAdmin(`/api/admin/users/${editingUserId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "تم", description: "تم تحديث المستخدم بنجاح" });
      } else {
        await fetchAdmin(`/api/admin/users`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "تم", description: "تم إنشاء المستخدم بنجاح" });
      }

      resetUserForm();
      setIsUserFormModalOpen(false);
      await loadAdminData();
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حفظ المستخدم",
        variant: "destructive",
      });
    } finally {
      setSavingUser(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userDeleteCandidate) return;
    const userId = userDeleteCandidate.id;
    setUserDeleteCandidate(null);
    try {
      await fetchAdmin(`/api/admin/users/${userId}`, { method: "DELETE" });
      await loadAdminData();
      if (editingUserId === userId) resetUserForm();
      if (userDetails?.user?.id === userId) {
        setUserDetails(null);
        setIsUserDetailsModalOpen(false);
      }
      toast({ title: "تم", description: "تم حذف المستخدم بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حذف المستخدم",
        variant: "destructive",
      });
    }
  };

  const loadUserDetails = async (userId: number) => {
    try {
      setLoadingUserDetails(true);
      const response = await fetchAdmin<AdminEnvelope<AdminUserDetails>>(`/api/admin/users/${userId}/details`);
      setUserDetails(response.data);
      setIsUserDetailsModalOpen(true);
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل جلب تفاصيل المستخدم",
        variant: "destructive",
      });
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const removeFriendByAdmin = async (ownerUserId: number, friendId: number) => {
    try {
      await fetchAdmin(`/api/admin/users/${ownerUserId}/friends/${friendId}`, {
        method: "DELETE",
      });
      toast({ title: "تم", description: "تم حذف الصديق من علاقة المستخدم" });
      await loadUserDetails(ownerUserId);
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حذف الصديق",
        variant: "destructive",
      });
    }
  };

  const loadGameDetails = async (gameId: number) => {
    try {
      setLoadingGameDetails(true);
      setIsUserDetailsModalOpen(false);
      const response = await fetchAdmin<AdminEnvelope<AdminGameDetails>>(`/api/admin/games/${gameId}/details`);
      setGameDetails(response.data);
      setIsGameDetailsModalOpen(true);
      setGameEdit({
        status: response.data.game.status,
        initialTime: Number(response.data.game.initialTime || 600),
        whiteTimeLeft: Number(response.data.game.whiteTimeLeft || 0),
        blackTimeLeft: Number(response.data.game.blackTimeLeft || 0),
        currentTurn: response.data.game.currentTurn,
        winnerId: response.data.game.winnerId ? String(response.data.game.winnerId) : "",
        gameType: response.data.game.gameType,
        whitePlayMethod: response.data.game.whitePlayMethod,
        blackPlayMethod: response.data.game.blackPlayMethod,
        currentFen: response.data.game.currentFen || "startpos",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل جلب تفاصيل المباراة",
        variant: "destructive",
      });
    } finally {
      setLoadingGameDetails(false);
    }
  };

  const saveGameEdit = async () => {
    if (!gameDetails?.game?.id) return;
    try {
      setUpdatingGame(true);
      await fetchAdmin(`/api/admin/games/${gameDetails.game.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: gameEdit.status,
          initial_time: Number(gameEdit.initialTime),
          white_time_left: Number(gameEdit.whiteTimeLeft),
          black_time_left: Number(gameEdit.blackTimeLeft),
          current_turn: gameEdit.currentTurn,
          winner_id: gameEdit.winnerId ? Number(gameEdit.winnerId) : null,
          game_type: gameEdit.gameType,
          white_play_method: gameEdit.whitePlayMethod,
          black_play_method: gameEdit.blackPlayMethod,
          current_fen: gameEdit.currentFen,
        }),
      });

      await loadAdminData();
      await loadGameDetails(gameDetails.game.id);
      toast({ title: "تم", description: "تم تحديث المباراة بنجاح" });
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل تحديث المباراة",
        variant: "destructive",
      });
    } finally {
      setUpdatingGame(false);
    }
  };

  const openReplayFromAdmin = (game: ReplayGameSource) => {
    navigate(`/game-replay/${game.id}`, {
      state: {
        game: {
          id: game.id,
          opponent: `${game.whitePlayer} vs ${game.blackPlayer}`,
          game_type: game.gameType,
          result: game.status === "ended" ? "منتهية" : "جارية",
          color: "white",
          started_at: game.startedAt,
          ended_at: game.endedAt || null,
        },
      },
    });
  };

  const editPuzzle = (puzzle: AdminPuzzle) => {
    setEditingPuzzleId(puzzle.id);
    setPuzzleForm({
      name: puzzle.name || "",
      level: puzzle.level,
      fen: puzzle.fen || "",
      objective: puzzle.objective || "",
      details: puzzle.details || "",
      startsWith: puzzle.startsWith || "white",
      points: Number(puzzle.points || 10),
      orderIndex: Number(puzzle.orderIndex || 0),
      isActive: Boolean(puzzle.isActive),
      solutionText: toSolutionText(puzzle.solution),
    });
    setIsPuzzleFormModalOpen(true);
  };

  const savePuzzle = async () => {
    try {
      setSavingPuzzle(true);
      const payload = {
        name: puzzleForm.name.trim(),
        level: puzzleForm.level,
        fen: puzzleForm.fen.trim(),
        objective: puzzleForm.objective.trim(),
        details: puzzleForm.details.trim(),
        startsWith: puzzleForm.startsWith,
        points: Number(puzzleForm.points),
        orderIndex: Number(puzzleForm.orderIndex),
        isActive: Boolean(puzzleForm.isActive),
        solution: parseSolutionText(puzzleForm.solutionText),
      };

      if (!payload.name || !payload.fen) {
        throw new Error("الاسم وFEN مطلوبان");
      }

      if (editingPuzzleId) {
        await fetchAdmin(`/api/puzzles/${editingPuzzleId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "تم", description: "تم تحديث اللغز بنجاح" });
      } else {
        await fetchAdmin(`/api/puzzles`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "تم", description: "تم إنشاء اللغز بنجاح" });
      }

      resetPuzzleForm();
      setIsPuzzleFormModalOpen(false);
      await loadAdminData();
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حفظ اللغز",
        variant: "destructive",
      });
    } finally {
      setSavingPuzzle(false);
    }
  };

  const removePuzzle = async (puzzleId: number) => {
    try {
      await fetchAdmin(`/api/puzzles/${puzzleId}`, { method: "DELETE" });
      await loadAdminData();
      toast({ title: "تم", description: "تم حذف اللغز" });
      if (editingPuzzleId === puzzleId) {
        resetPuzzleForm();
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حذف اللغز",
        variant: "destructive",
      });
    }
  };

  const confirmDeletePuzzle = async () => {
    if (!puzzleDeleteCandidate) return;
    const puzzleId = puzzleDeleteCandidate.id;
    setPuzzleDeleteCandidate(null);
    await removePuzzle(puzzleId);
  };

  const confirmDeleteInvite = async () => {
    if (!inviteDeleteCandidate) return;
    const inviteId = inviteDeleteCandidate.id;
    setInviteDeleteCandidate(null);
    await deleteInvite(inviteId);
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

  const filteredUsers = useMemo(() => {
    const query = userFilters.query.trim().toLowerCase();
    return users.filter(user => {
      const textMatched =
        !query ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        String(user.id).includes(query);
      const statusMatched = userFilters.status === "all" || user.status === userFilters.status;
      const roleMatched = userFilters.role === "all" || user.type === userFilters.role;
      const bannedMatched =
        userFilters.banned === "all" ||
        (userFilters.banned === "banned" && user.banned) ||
        (userFilters.banned === "not-banned" && !user.banned);
      return textMatched && statusMatched && roleMatched && bannedMatched;
    });
  }, [users, userFilters]);

  const filteredGames = useMemo(() => {
    const query = gameFilters.query.trim().toLowerCase();
    const minMoves = gameFilters.minMoves === "" ? null : Number(gameFilters.minMoves);
    const maxMoves = gameFilters.maxMoves === "" ? null : Number(gameFilters.maxMoves);
    return games.filter(game => {
      const textMatched =
        !query ||
        String(game.id).includes(query) ||
        game.whitePlayer.toLowerCase().includes(query) ||
        game.blackPlayer.toLowerCase().includes(query);
      const statusMatched = gameFilters.status === "all" || game.status === gameFilters.status;
      const typeMatched = gameFilters.type === "all" || game.gameType === gameFilters.type;
      const minMovesMatched = minMoves == null || game.moves >= minMoves;
      const maxMovesMatched = maxMoves == null || game.moves <= maxMoves;
      return textMatched && statusMatched && typeMatched && minMovesMatched && maxMovesMatched;
    });
  }, [games, gameFilters]);

  const filteredInvites = useMemo(() => {
    const query = inviteFilters.query.trim().toLowerCase();
    return invites.filter(invite => {
      const textMatched =
        !query ||
        String(invite.id).includes(query) ||
        invite.fromUsername.toLowerCase().includes(query) ||
        invite.toUsername.toLowerCase().includes(query);
      const statusMatched = inviteFilters.status === "all" || invite.status === inviteFilters.status;
      const typeMatched = inviteFilters.gameType === "all" || invite.gameType === inviteFilters.gameType;
      return textMatched && statusMatched && typeMatched;
    });
  }, [invites, inviteFilters]);

  const filteredPuzzles = useMemo(() => {
    const query = puzzleFilters.query.trim().toLowerCase();
    return puzzles.filter(puzzle => {
      const textMatched =
        !query ||
        String(puzzle.id).includes(query) ||
        puzzle.name.toLowerCase().includes(query) ||
        (puzzle.objective || "").toLowerCase().includes(query);
      const levelMatched = puzzleFilters.level === "all" || puzzle.level === puzzleFilters.level;
      const activeMatched =
        puzzleFilters.isActive === "all" ||
        (puzzleFilters.isActive === "active" && puzzle.isActive) ||
        (puzzleFilters.isActive === "inactive" && !puzzle.isActive);
      return textMatched && levelMatched && activeMatched;
    });
  }, [puzzles, puzzleFilters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle" dir="rtl">
        <AppNavHeader />
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <AppNavHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card><CardContent className="p-4 text-center"><Users className="h-8 w-8 text-primary mx-auto mb-2" /><div className="text-2xl font-bold">{stats.totalUsers}</div><div className="text-xs text-muted-foreground">إجمالي المستخدمين</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Activity className="h-8 w-8 text-green-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.onlineUsers}</div><div className="text-xs text-muted-foreground">متصل الآن</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><GamepadIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.activeGames}</div><div className="text-xs text-muted-foreground">مباريات نشطة</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.pendingInvites}</div><div className="text-xs text-muted-foreground">دعوات معلقة</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Ban className="h-8 w-8 text-red-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.bannedUsers}</div><div className="text-xs text-muted-foreground">محظورين</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-2" /><div className="text-2xl font-bold">{stats.gamesPlayedToday}</div><div className="text-xs text-muted-foreground">مباريات اليوم</div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="games">المباريات</TabsTrigger>
            <TabsTrigger value="invites">الدعوات</TabsTrigger>
            <TabsTrigger value="puzzles">الألغاز</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardContent className="p-4 flex flex-row-reverse items-center justify-between gap-3">
                <div className="text-right">
                  <div className="font-cairo font-semibold">إدارة المستخدمين</div>
                  <div className="text-sm text-muted-foreground">إضافة وتعديل وحذف المستخدمين من نافذة منبثقة</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => toggleAdvancedFilter("users")}>
                    <Search className="h-4 w-4" />
                    بحث متقدم وفلترة
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      resetUserForm();
                      setIsUserFormModalOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    إضافة مستخدم جديد
                  </Button>
                </div>
              </CardContent>
            </Card>

            {showAdvancedFilters.users && (
              <Card>
                <CardContent className="p-4 grid md:grid-cols-4 gap-3">
                  <Input
                    placeholder="بحث بالاسم / البريد / المعرّف"
                    value={userFilters.query}
                    onChange={e => setUserFilters(prev => ({ ...prev, query: e.target.value }))}
                  />
                  <select aria-label="قائمة اختيار" title="قائمة اختيار"
                    className="h-10 rounded-md border bg-background px-3"
                    value={userFilters.status}
                    onChange={e =>
                      setUserFilters(prev => ({
                        ...prev,
                        status: e.target.value as "all" | "online" | "offline" | "in-game",
                      }))
                    }
                  >
                    <option value="all">كل الحالات</option>
                    <option value="online">متصل</option>
                    <option value="offline">غير متصل</option>
                    <option value="in-game">في مباراة</option>
                  </select>
                  <select aria-label="قائمة اختيار" title="قائمة اختيار"
                    className="h-10 rounded-md border bg-background px-3"
                    value={userFilters.role}
                    onChange={e =>
                      setUserFilters(prev => ({
                        ...prev,
                        role: e.target.value as "all" | "user" | "admin",
                      }))
                    }
                  >
                    <option value="all">كل الأدوار</option>
                    <option value="user">مستخدم</option>
                    <option value="admin">مدير</option>
                  </select>
                  <select aria-label="قائمة اختيار" title="قائمة اختيار"
                    className="h-10 rounded-md border bg-background px-3"
                    value={userFilters.banned}
                    onChange={e =>
                      setUserFilters(prev => ({
                        ...prev,
                        banned: e.target.value as "all" | "banned" | "not-banned",
                      }))
                    }
                  >
                    <option value="all">محظور وغير محظور</option>
                    <option value="banned">محظور فقط</option>
                    <option value="not-banned">غير محظور فقط</option>
                  </select>
                </CardContent>
              </Card>
            )}

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
                              <AvatarImage src={hasCustomAvatar(user.avatar) ? user.avatar || undefined : undefined} />
                              <AvatarFallback>{getInitialsFromName(user.username)}</AvatarFallback>
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
                            <Button variant="ghost" size="icon" onClick={() => loadUserDetails(user.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => startEditUser(user)}>
                              <Pencil className="h-4 w-4 ml-1" />
                              تعديل
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
                            {user.type !== "admin" && (
                              <Button onClick={() => setUserDeleteCandidate(user)} variant="outline" size="icon">
                                <UserRoundX className="h-4 w-4" />
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
                <div className="flex flex-row-reverse items-center justify-between gap-2">
                  <CardTitle className="font-cairo text-right">إدارة المباريات</CardTitle>
                  <Button variant="outline" className="gap-2" onClick={() => toggleAdvancedFilter("games")}>
                    <Search className="h-4 w-4" />
                    بحث متقدم وفلترة
                  </Button>
                </div>
                <CardDescription className="text-right">مراقبة والتحكم في المباريات</CardDescription>
              </CardHeader>
              <CardContent>
                {showAdvancedFilters.games && (
                  <div className="grid md:grid-cols-5 gap-3 mb-4">
                    <Input
                      placeholder="بحث باللاعب / المعرّف"
                      value={gameFilters.query}
                      onChange={e => setGameFilters(prev => ({ ...prev, query: e.target.value }))}
                    />
                    <select aria-label="قائمة اختيار" title="قائمة اختيار"
                      className="h-10 rounded-md border bg-background px-3"
                      value={gameFilters.status}
                      onChange={e =>
                        setGameFilters(prev => ({
                          ...prev,
                          status: e.target.value as "all" | "waiting" | "active" | "ended",
                        }))
                      }
                    >
                      <option value="all">كل الحالات</option>
                      <option value="waiting">بانتظار البدء</option>
                      <option value="active">جارية</option>
                      <option value="ended">منتهية</option>
                    </select>
                    <select aria-label="قائمة اختيار" title="قائمة اختيار"
                      className="h-10 rounded-md border bg-background px-3"
                      value={gameFilters.type}
                      onChange={e =>
                        setGameFilters(prev => ({
                          ...prev,
                          type: e.target.value as "all" | "friend" | "ranked" | "ai" | "puzzle",
                        }))
                      }
                    >
                      <option value="all">كل الأنواع</option>
                      <option value="friend">friend</option>
                      <option value="ranked">ranked</option>
                      <option value="ai">ai</option>
                      <option value="puzzle">puzzle</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="أقل عدد نقلات"
                      value={gameFilters.minMoves}
                      onChange={e => setGameFilters(prev => ({ ...prev, minMoves: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="أعلى عدد نقلات"
                      value={gameFilters.maxMoves}
                      onChange={e => setGameFilters(prev => ({ ...prev, maxMoves: e.target.value }))}
                    />
                  </div>
                )}
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
                    {filteredGames.map(game => (
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
                            <Button variant="ghost" size="icon" onClick={() => openReplayFromAdmin(game)}>
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                            {game.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="مشاهدة مباشرة"
                                onClick={() => navigate(`/game?id=${game.id}&spectator=1&skip_countdown=1`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
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
                <div className="flex flex-row-reverse items-center justify-between gap-2">
                  <CardTitle className="font-cairo text-right">إدارة الدعوات</CardTitle>
                  <Button variant="outline" className="gap-2" onClick={() => toggleAdvancedFilter("invites")}>
                    <Search className="h-4 w-4" />
                    بحث متقدم وفلترة
                  </Button>
                </div>
                <CardDescription className="text-right">مراقبة الدعوات المعلقة والمنتهية</CardDescription>
              </CardHeader>
              <CardContent>
                {showAdvancedFilters.invites && (
                  <div className="grid md:grid-cols-3 gap-3 mb-4">
                    <Input
                      placeholder="بحث بالمرسل / المستقبل / المعرّف"
                      value={inviteFilters.query}
                      onChange={e => setInviteFilters(prev => ({ ...prev, query: e.target.value }))}
                    />
                    <Input
                      placeholder="فلترة بالحالة (accepted/pending...)"
                      value={inviteFilters.status === "all" ? "" : inviteFilters.status}
                      onChange={e =>
                        setInviteFilters(prev => ({
                          ...prev,
                          status: e.target.value.trim() ? e.target.value.trim() : "all",
                        }))
                      }
                    />
                    <Input
                      placeholder="فلترة بالنوع (friend/ranked...)"
                      value={inviteFilters.gameType === "all" ? "" : inviteFilters.gameType}
                      onChange={e =>
                        setInviteFilters(prev => ({
                          ...prev,
                          gameType: e.target.value.trim() ? e.target.value.trim() : "all",
                        }))
                      }
                    />
                  </div>
                )}
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
                    {filteredInvites.map(invite => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.fromUsername}</TableCell>
                        <TableCell>{invite.toUsername}</TableCell>
                        <TableCell>{invite.timeControl} دقيقة</TableCell>
                        <TableCell><Badge variant="secondary">{invite.status}</Badge></TableCell>
                        <TableCell>{toArabicRelative(invite.createdAt)}</TableCell>
                        <TableCell className="text-red-500">{toArabicRelative(invite.expiresAt)}</TableCell>
                        <TableCell>
                          <Button onClick={() => setInviteDeleteCandidate(invite)} variant="outline" size="icon">
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

          <TabsContent value="puzzles" className="space-y-6">
            <Card>
              <CardContent className="p-4 flex flex-row-reverse items-center justify-between gap-3">
                <div className="text-right">
                  <div className="font-cairo font-semibold">إدارة الألغاز</div>
                  <div className="text-sm text-muted-foreground">إضافة وتعديل الألغاز من نافذة منبثقة</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => toggleAdvancedFilter("puzzles")}>
                    <Search className="h-4 w-4" />
                    بحث متقدم وفلترة
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      resetPuzzleForm();
                      setIsPuzzleFormModalOpen(true);
                    }}
                  >
                    <PlusCircle className="h-4 w-4" />
                    إضافة لغز
                  </Button>
                </div>
              </CardContent>
            </Card>

            {showAdvancedFilters.puzzles && (
              <Card>
                <CardContent className="p-4 grid md:grid-cols-3 gap-3">
                  <Input
                    placeholder="بحث بالاسم / الهدف / المعرّف"
                    value={puzzleFilters.query}
                    onChange={e => setPuzzleFilters(prev => ({ ...prev, query: e.target.value }))}
                  />
                  <select aria-label="قائمة اختيار" title="قائمة اختيار"
                    className="h-10 rounded-md border bg-background px-3"
                    value={puzzleFilters.level}
                    onChange={e =>
                      setPuzzleFilters(prev => ({
                        ...prev,
                        level: e.target.value as "all" | "easy" | "medium" | "hard",
                      }))
                    }
                  >
                    <option value="all">كل المستويات</option>
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                  <select aria-label="قائمة اختيار" title="قائمة اختيار"
                    className="h-10 rounded-md border bg-background px-3"
                    value={puzzleFilters.isActive}
                    onChange={e =>
                      setPuzzleFilters(prev => ({
                        ...prev,
                        isActive: e.target.value as "all" | "active" | "inactive",
                      }))
                    }
                  >
                    <option value="all">نشط وغير نشط</option>
                    <option value="active">نشط فقط</option>
                    <option value="inactive">غير نشط فقط</option>
                  </select>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">قائمة الألغاز ({puzzles.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اللغز</TableHead>
                      <TableHead>المستوى</TableHead>
                      <TableHead>الهدف</TableHead>
                      <TableHead>النقاط</TableHead>
                      <TableHead>الترتيب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPuzzles.map(puzzle => (
                      <TableRow key={puzzle.id}>
                        <TableCell>
                          <div className="font-medium">{puzzle.name}</div>
                          <div className="text-xs text-muted-foreground">#{puzzle.id}</div>
                        </TableCell>
                        <TableCell>{puzzle.level === "easy" ? "سهل" : puzzle.level === "hard" ? "صعب" : "متوسط"}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{puzzle.objective || "-"}</TableCell>
                        <TableCell>{puzzle.points}</TableCell>
                        <TableCell>{puzzle.orderIndex}</TableCell>
                        <TableCell>
                          {puzzle.isActive ? <Badge className="bg-green-600 text-white">نشط</Badge> : <Badge variant="secondary">غير نشط</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => editPuzzle(puzzle)}>
                              تعديل
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setPuzzleDeleteCandidate(puzzle)}>
                              حذف
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <Dialog
        open={isUserFormModalOpen}
        onOpenChange={open => {
          setIsUserFormModalOpen(open);
          if (!open) {
            resetUserForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {editingUserId ? "تعديل مستخدم" : "إضافة مستخدم جديد"}
            </DialogTitle>
            <DialogDescription>
              يمكنك من هنا إنشاء أو تعديل أو حذف المستخدمين والتحكم الكامل ببياناتهم
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                placeholder="اسم المستخدم"
                value={userForm.username}
                onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))}
              />
              <Input
                placeholder="البريد الإلكتروني"
                value={userForm.email}
                onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))}
              />
              <Input
                placeholder={editingUserId ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}
                type="password"
                value={userForm.password}
                onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={userForm.type}
                onChange={e => setUserForm(prev => ({ ...prev, type: e.target.value as "user" | "admin" }))}
              >
                <option value="user">مستخدم</option>
                <option value="admin">مدير</option>
              </select>
              <Input
                type="number"
                min={0}
                max={3000}
                placeholder="التقييم"
                value={userForm.rating}
                onChange={e => setUserForm(prev => ({ ...prev, rating: Number(e.target.value || 0) }))}
              />
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="مستوى الألغاز"
                value={userForm.puzzleLevel}
                onChange={e => setUserForm(prev => ({ ...prev, puzzleLevel: Number(e.target.value || 1) }))}
              />
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={userForm.status}
                onChange={e =>
                  setUserForm(prev => ({
                    ...prev,
                    status: e.target.value as "online" | "offline" | "in-game",
                  }))
                }
              >
                <option value="offline">غير متصل</option>
                <option value="online">متصل</option>
                <option value="in-game">في مباراة</option>
              </select>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                placeholder="رابط الصورة المصغرة (اختياري)"
                value={userForm.thumbnail}
                onChange={e => setUserForm(prev => ({ ...prev, thumbnail: e.target.value }))}
              />
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={userForm.banned ? "1" : "0"}
                onChange={e => setUserForm(prev => ({ ...prev, banned: e.target.value === "1" }))}
              >
                <option value="0">غير محظور</option>
                <option value="1">محظور</option>
              </select>
              <Input
                placeholder="سبب الحظر (اختياري)"
                value={userForm.bannedReason}
                onChange={e => setUserForm(prev => ({ ...prev, bannedReason: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveUser} disabled={savingUser}>
                {editingUserId ? "حفظ التعديل" : "إنشاء المستخدم"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetUserForm();
                  setIsUserFormModalOpen(false);
                }}
              >
                إلغاء / تفريغ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPuzzleFormModalOpen}
        onOpenChange={open => {
          setIsPuzzleFormModalOpen(open);
          if (!open) {
            resetPuzzleForm();
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              {editingPuzzleId ? "تعديل لغز" : "إضافة لغز جديد"}
            </DialogTitle>
            <DialogDescription>
              أدخل بيانات اللغز والحل كسلسلة حركات (JSON أو أسطر).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="اسم اللغز"
                value={puzzleForm.name}
                onChange={e => setPuzzleForm(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="الهدف (مثال: مات في نقلة)"
                value={puzzleForm.objective}
                onChange={e => setPuzzleForm(prev => ({ ...prev, objective: e.target.value }))}
              />
            </div>
            <Textarea
              rows={3}
              placeholder="FEN"
              value={puzzleForm.fen}
              onChange={e => setPuzzleForm(prev => ({ ...prev, fen: e.target.value }))}
            />
            <Textarea
              rows={3}
              placeholder="وصف / تفاصيل اللغز"
              value={puzzleForm.details}
              onChange={e => setPuzzleForm(prev => ({ ...prev, details: e.target.value }))}
            />
            <div className="grid md:grid-cols-5 gap-3">
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={puzzleForm.level}
                onChange={e =>
                  setPuzzleForm(prev => ({
                    ...prev,
                    level: e.target.value as "easy" | "medium" | "hard",
                  }))
                }
              >
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={puzzleForm.startsWith}
                onChange={e =>
                  setPuzzleForm(prev => ({
                    ...prev,
                    startsWith: e.target.value as "white" | "black",
                  }))
                }
              >
                <option value="white">يبدأ الأبيض</option>
                <option value="black">يبدأ الأسود</option>
              </select>
              <Input
                type="number"
                min={1}
                placeholder="النقاط"
                value={puzzleForm.points}
                onChange={e => setPuzzleForm(prev => ({ ...prev, points: Number(e.target.value || 0) }))}
              />
              <Input
                type="number"
                min={0}
                placeholder="الترتيب"
                value={puzzleForm.orderIndex}
                onChange={e =>
                  setPuzzleForm(prev => ({ ...prev, orderIndex: Number(e.target.value || 0) }))
                }
              />
              <select aria-label="قائمة اختيار" title="قائمة اختيار"
                className="h-10 rounded-md border bg-background px-3"
                value={puzzleForm.isActive ? "1" : "0"}
                onChange={e => setPuzzleForm(prev => ({ ...prev, isActive: e.target.value === "1" }))}
              >
                <option value="1">نشط</option>
                <option value="0">غير نشط</option>
              </select>
            </div>
            <Textarea
              rows={8}
              placeholder={`solution\nمثال JSON:\n[\n  { "actor": "player", "uci": "e2e4" },\n  { "actor": "opponent", "uci": "e7e5" }\n]\n\nأو كسطور:\ne2e4\ne7e5`}
              value={puzzleForm.solutionText}
              onChange={e => setPuzzleForm(prev => ({ ...prev, solutionText: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button onClick={savePuzzle} disabled={savingPuzzle} className="gap-2">
                <Save className="h-4 w-4" />
                {editingPuzzleId ? "حفظ تعديل اللغز" : "إضافة اللغز"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetPuzzleForm();
                  setIsPuzzleFormModalOpen(false);
                }}
              >
                إلغاء / تفريغ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isUserDetailsModalOpen}
        onOpenChange={open => {
          setIsUserDetailsModalOpen(open);
          if (!open) setUserDetails(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo">تفاصيل المستخدم المحدد</DialogTitle>
            <DialogDescription>
              {userDetails?.user
                  ? `المستخدم: ${userDetails.user.username}`
                  : "لا توجد بيانات لعرضها"}
            </DialogDescription>
          </DialogHeader>

          {loadingUserDetails ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : !userDetails?.user ? (
            <div className="text-muted-foreground">لا توجد بيانات لعرضها حاليًا.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">البريد:</span> {userDetails.user.email}</div>
                <div><span className="text-muted-foreground">التقييم:</span> {userDetails.user.rank}</div>
                <div><span className="text-muted-foreground">الحالة:</span> {userDetails.user.state}</div>
                <div><span className="text-muted-foreground">عدد الأصدقاء:</span> {userDetails.stats?.friendsCount ?? 0}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">الأصدقاء ({userDetails.friends.length})</h4>
                {userDetails.friends.length === 0 ? (
                  <div className="text-muted-foreground text-sm">لا يوجد أصدقاء لهذا المستخدم.</div>
                ) : (
                  <div className="space-y-2">
                    {userDetails.friends.map(friend => (
                      <div key={friend.friendshipId} className="flex items-center justify-between border rounded-md px-3 py-2">
                        <div className="text-sm">
                          <div>{friend.friendUsername} ({friend.friendRank})</div>
                          <div className="text-muted-foreground">{friend.friendState}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFriendByAdmin(userDetails.user.id, friend.friendId)}
                        >
                          حذف الصديق
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">المباريات ({userDetails.games.length})</h4>
                {userDetails.games.length === 0 ? (
                  <div className="text-muted-foreground text-sm">لا توجد مباريات لهذا المستخدم.</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {userDetails.games.map(game => (
                      <div key={game.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                        <div className="text-sm">
                          <div>#{game.id} - {game.whitePlayer} vs {game.blackPlayer}</div>
                          <div className="text-muted-foreground">{game.gameType} | {game.status} | {game.moves} نقلة</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => loadGameDetails(game.id)}>
                            تفاصيل
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReplayFromAdmin(game)}>
                            إعادة
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGameDetailsModalOpen}
        onOpenChange={open => {
          setIsGameDetailsModalOpen(open);
          if (!open) setGameDetails(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo">تفاصيل المباراة المحددة</DialogTitle>
            <DialogDescription>
              {gameDetails?.game
                  ? `المباراة #${gameDetails.game.id}`
                  : "اختر مباراة لعرض تفاصيلها"}
            </DialogDescription>
          </DialogHeader>

          {loadingGameDetails ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-40 w-full rounded-md" />
            </div>
          ) : !gameDetails?.game ? (
            <div className="text-muted-foreground">لا توجد مباراة محددة حالياً.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">الأبيض:</span> {gameDetails.game.whitePlayer}</div>
                <div><span className="text-muted-foreground">الأسود:</span> {gameDetails.game.blackPlayer}</div>
                <div><span className="text-muted-foreground">الحالة:</span> {gameDetails.game.status}</div>
                <div><span className="text-muted-foreground">النوع:</span> {gameDetails.game.gameType}</div>
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <select aria-label="قائمة اختيار" title="قائمة اختيار"
                  className="h-10 rounded-md border bg-background px-3"
                  value={gameEdit.status}
                  onChange={e => setGameEdit(prev => ({ ...prev, status: e.target.value as "waiting" | "active" | "ended" }))}
                >
                  <option value="waiting">بانتظار البدء</option>
                  <option value="active">جارية</option>
                  <option value="ended">منتهية</option>
                </select>
                <Input
                  type="number"
                  placeholder="وقت البداية (ثانية)"
                  value={gameEdit.initialTime}
                  onChange={e => setGameEdit(prev => ({ ...prev, initialTime: Number(e.target.value || 0) }))}
                />
                <Input
                  type="number"
                  placeholder="وقت الأبيض"
                  value={gameEdit.whiteTimeLeft}
                  onChange={e => setGameEdit(prev => ({ ...prev, whiteTimeLeft: Number(e.target.value || 0) }))}
                />
                <Input
                  type="number"
                  placeholder="وقت الأسود"
                  value={gameEdit.blackTimeLeft}
                  onChange={e => setGameEdit(prev => ({ ...prev, blackTimeLeft: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="grid md:grid-cols-5 gap-3">
                <select aria-label="قائمة اختيار" title="قائمة اختيار"
                  className="h-10 rounded-md border bg-background px-3"
                  value={gameEdit.currentTurn}
                  onChange={e => setGameEdit(prev => ({ ...prev, currentTurn: e.target.value as "white" | "black" }))}
                >
                  <option value="white">دور الأبيض</option>
                  <option value="black">دور الأسود</option>
                </select>
                <select aria-label="قائمة اختيار" title="قائمة اختيار"
                  className="h-10 rounded-md border bg-background px-3"
                  value={gameEdit.gameType}
                  onChange={e =>
                    setGameEdit(prev => ({
                      ...prev,
                      gameType: e.target.value as "friend" | "ranked" | "ai" | "puzzle",
                    }))
                  }
                >
                  <option value="friend">friend</option>
                  <option value="ranked">ranked</option>
                  <option value="ai">ai</option>
                  <option value="puzzle">puzzle</option>
                </select>
                <select aria-label="قائمة اختيار" title="قائمة اختيار"
                  className="h-10 rounded-md border bg-background px-3"
                  value={gameEdit.whitePlayMethod}
                  onChange={e =>
                    setGameEdit(prev => ({
                      ...prev,
                      whitePlayMethod: e.target.value as "phone" | "physical_board",
                    }))
                  }
                >
                  <option value="phone">طريقة الأبيض: هاتف</option>
                  <option value="physical_board">طريقة الأبيض: لوحة</option>
                </select>
                <select aria-label="قائمة اختيار" title="قائمة اختيار"
                  className="h-10 rounded-md border bg-background px-3"
                  value={gameEdit.blackPlayMethod}
                  onChange={e =>
                    setGameEdit(prev => ({
                      ...prev,
                      blackPlayMethod: e.target.value as "phone" | "physical_board",
                    }))
                  }
                >
                  <option value="phone">طريقة الأسود: هاتف</option>
                  <option value="physical_board">طريقة الأسود: لوحة</option>
                </select>
                <Input
                  placeholder="winner_id (اختياري)"
                  value={gameEdit.winnerId}
                  onChange={e => setGameEdit(prev => ({ ...prev, winnerId: e.target.value }))}
                />
              </div>
              <Textarea
                rows={3}
                value={gameEdit.currentFen}
                onChange={e => setGameEdit(prev => ({ ...prev, currentFen: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button onClick={saveGameEdit} disabled={updatingGame}>حفظ تعديل المباراة</Button>
                <Button variant="outline" onClick={() => openReplayFromAdmin(gameDetails.game)}>مشاهدة كفيديو</Button>
              </div>
              <div>
                <h4 className="font-semibold mb-2">النقلات ({gameDetails.moves.length})</h4>
                <div className="max-h-56 overflow-auto space-y-1">
                  {gameDetails.moves.map(move => (
                    <div key={move.id} className="text-sm border rounded px-2 py-1">
                      #{move.moveNumber} - {move.playerName}: {move.san} ({move.uci})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(puzzleDeleteCandidate)}
        onOpenChange={open => {
          if (!open) setPuzzleDeleteCandidate(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">تأكيد حذف اللغز</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف اللغز
              {puzzleDeleteCandidate ? ` "${puzzleDeleteCandidate.name}"` : ""}؟
              لا يمكن التراجع بعد الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeletePuzzle}>
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(userDeleteCandidate)}
        onOpenChange={open => {
          if (!open) setUserDeleteCandidate(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المستخدم
              {userDeleteCandidate ? ` "${userDeleteCandidate.username}"` : ""}؟
              سيتم تعطيل حسابه وإخفاؤه من النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteUser}
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(inviteDeleteCandidate)}
        onOpenChange={open => {
          if (!open) setInviteDeleteCandidate(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">تأكيد حذف الدعوة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف دعوة
              {inviteDeleteCandidate
                ? ` ${inviteDeleteCandidate.fromUsername} ← ${inviteDeleteCandidate.toUsername}`
                : ""}؟
              لا يمكن التراجع بعد الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteInvite}
            >
              حذف الدعوة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
