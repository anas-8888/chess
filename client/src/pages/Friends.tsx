import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/userService";
import { friendService } from "@/services/friendService";
import { inviteService, type Invite } from "@/services/inviteService";
import { authService } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL, SOCKET_BASE_URL } from "@/config/urls";
import { getInitialsFromName, hasCustomAvatar } from "@/utils/avatar";
import {
  ArrowRight,
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

const FRIENDS_TAB_STORAGE_KEY = "friends_active_tab_v1";
const TAB_VALUES = ["friends", "myfriends", "invites", "pending"] as const;
type FriendsTabValue = (typeof TAB_VALUES)[number];

const Friends = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTime, setSelectedTime] = useState("10");
  const [friends, setFriends] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [friendToDelete, setFriendToDelete] = useState<any>(null);
  const { user } = useAuth();
  // مودال دعوة اللعب
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<any>(null);
  const [playMethod, setPlayMethod] = useState<'phone' | 'physical_board' | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // متغيرات مودال قبول الدعوة
  const [showAcceptInviteModal, setShowAcceptInviteModal] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [acceptPlayMethod, setAcceptPlayMethod] = useState<'phone' | 'physical_board' | null>(null);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<FriendsTabValue>(() => {
    if (typeof window === "undefined") return "friends";
    const saved = localStorage.getItem(FRIENDS_TAB_STORAGE_KEY);
    if (saved && (TAB_VALUES as readonly string[]).includes(saved)) {
      return saved as FriendsTabValue;
    }
    return "friends";
  });

  const isGameStatusActiveForResume = (status?: string) => status === 'waiting' || status === 'active';
  const timeControlOptions = ["1", "3", "5", "10", "15", "30"];
  const formatTimeControl = (value?: string | number) => {
    const parsed = Number(value || 10);
    const safe = Number.isFinite(parsed) ? parsed : 10;
    return `${safe} دقيقة`;
  };

  const isInviteGameStillActive = (invite: Invite | any) => {
    if (invite?.status !== 'game_started') {
      return true;
    }

    if (invite?.game?.status) {
      return isGameStatusActiveForResume(invite.game.status);
    }

    return Boolean(invite?.game_id);
  };

  const getFilteredReceivedInvites = () => {
    return invites.filter((invite) => {
      if (invite.status === 'pending' || invite.status === 'accepted') {
        return true;
      }

      if (invite.status === 'game_started') {
        return isInviteGameStillActive(invite);
      }

      return false;
    });
  };

  
  useEffect(() => {
    loadFriendsData();
    loadInvites();
    loadIncomingRequests();
    
    if (user?.id) {
      const cleanup = setupSocketListeners();
      return cleanup;
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(FRIENDS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchUsers(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadFriendsData = async () => {
    try {
      // REST: GET /api/friends -> fetch user's friends list
      const friendsData = await friendService.getFriends();
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل قائمة الأصدقاء",
        variant: "destructive"
      });
    }
  };

  const loadInvites = async () => {
    try {
      const invitesData = await inviteService.getReceivedInvites();
      setInvites(invitesData);
      // تحميل الدعوات المرسلة
      const sentInvitesData = await inviteService.getSentInvites();
      setPendingInvites(sentInvitesData);
    } catch (error) {
      console.error('Error loading invites:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل الدعوات",
        variant: "destructive"
      });
    }
  };

  const loadIncomingRequests = async () => {
    try {
      setIsLoadingIncoming(true);
      const requests = await friendService.getIncomingRequests();
      setIncomingRequests(requests);
    } catch (error) {
      console.error('Error loading incoming requests:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل طلبات الصداقة الواردة",
        variant: "destructive"
      });
    } finally {
      setIsLoadingIncoming(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = io(`${SOCKET_BASE_URL}/friends`, {
      auth: {
        token: authService.getToken(),
      },
      query: {
        userId: user?.id || '',
        token: authService.getToken() || '',
      },
      path: '/socket.io',
      transports: ['polling'],
      upgrade: false,
      withCredentials: true,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
    });



    socket.on('game_created', (gameData) => {
      window.location.href = `/game?id=${gameData.gameId}`;
    });

    socket.on('friendStatusChanged', (friendData) => {
      setFriends((prev) =>
        prev.map((friend) => {
          const friendId = Number(friend.user_id ?? friend.id);
          const changedUserId = Number(friendData.userId ?? friendData.id);
          if (friendId !== changedUserId) {
            return friend;
          }

          return {
            ...friend,
            state: friendData.status || friend.state,
            is_online: friendData.status === 'online',
          };
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await userService.searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من البحث عن المستخدمين",
        variant: "destructive"
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      await friendService.sendFriendRequest(userId);
      toast({
        title: "تم إرسال طلب الصداقة",
        description: "تم إرسال طلب الصداقة بنجاح"
      });
      setSearchTerm("");
      setSearchResults([]);
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "لم نتمكن من إرسال طلب الصداقة",
        variant: "destructive"
      });
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      await friendService.acceptFriendRequest(requestId);
      toast({
        title: "تم قبول طلب الصداقة",
        description: "تم قبول طلب الصداقة بنجاح"
      });
      // Reload incoming requests and friends list
      loadIncomingRequests();
      loadFriendsData();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من قبول طلب الصداقة",
        variant: "destructive"
      });
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    try {
      await friendService.rejectFriendRequest(requestId);
      toast({
        title: "تم رفض طلب الصداقة",
        description: "تم رفض طلب الصداقة بنجاح"
      });
      // Reload incoming requests
      loadIncomingRequests();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من رفض طلب الصداقة",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (friend: any) => {
    setFriendToDelete(friend);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!friendToDelete) return;
    
    try {
      await friendService.removeFriend(friendToDelete.user_id.toString());
      toast({
        title: "تم إلغاء الصداقة",
        description: `تم إلغاء الصداقة مع ${friendToDelete.username} بنجاح`
      });
      // Reload friends list
      loadFriendsData();
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من إلغاء الصداقة",
        variant: "destructive"
      });
    } finally {
      setShowDeleteConfirm(false);
      setFriendToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setFriendToDelete(null);
  };

  // دالة فتح المودال مع التحقق من حالة المستخدم الحالي
  const handleOpenInviteModal = async (friend: any) => {
    try {
      // جلب حالة المستخدم الحالي من الباك اند
      const userStatus = await userService.getCurrentUserStatus();
      if (userStatus.state === 'in-game') {
        toast({
          title: 'المستخدم مشغول',
          description: 'لا يمكنك إرسال دعوة أثناء وجودك في مباراة جارية',
          variant: 'destructive',
        });
        return;
      }
      setInviteTarget(friend);
      setPlayMethod(null);
      setShowInviteModal(true);
    } catch (error) {
      console.error('Error checking user status:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في التحقق من حالة الاتصال',
        variant: 'destructive',
      });
    }
  };

  // دالة إرسال الدعوة
  const sendGameInviteToBackend = async () => {
    if (!inviteTarget || !playMethod) return;
    setIsSendingInvite(true);
    try {
      const body: any = {
        to_user_id: inviteTarget.user_id.toString(), // تأكد أنه نص
        game_type: 'friendly',
        play_method: playMethod === 'physical_board' ? 'physical_board' : 'phone',
        time_control: Number(selectedTime || 10),
      };
      const response = await fetch(`${API_BASE_URL}/api/invites/game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إرسال الدعوة');
      }
      toast({
        title: 'تم إرسال الدعوة',
        description: `تم إرسال دعوة لعب إلى ${inviteTarget.username}`,
      });
      setShowInviteModal(false);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إرسال الدعوة',
        variant: 'destructive',
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      // البحث عن الدعوة في القائمة
      const invite = invites.find(inv => inv.id === inviteId);
      if (!invite) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على الدعوة",
          variant: "destructive"
        });
        return;
      }

      // التحقق من الشروط
      const validationResult = await validateInviteAcceptance(invite);
      if (!validationResult.isValid) {
        toast({
          title: "لا يمكن قبول الدعوة",
          description: validationResult.message,
          variant: "destructive"
        });
        return;
      }

      // فتح مودال اختيار طريقة اللعب
      setSelectedInvite(invite);
      setAcceptPlayMethod(null);
      setShowAcceptInviteModal(true);

    } catch (error) {
      console.error('Error preparing to accept invite:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من معالجة الدعوة",
        variant: "destructive"
      });
    }
  };

  // دالة التحقق من شروط قبول الدعوة
  const validateInviteAcceptance = async (invite: any) => {
    try {
      // 3. التحقق من أن الدعوة لم تنتهي صلاحيتها
      const now = new Date();
      const expiresAt = new Date(invite.expires_at);
      if (now > expiresAt) {
        return {
          isValid: false,
          message: 'انتهت صلاحية الدعوة'
        };
      }

      // 4. التحقق من أن الطرفان أصدقاء
      const friends = await friendService.getFriends();
      const isFriend = friends.some(friend => 
        friend.user_id.toString() === invite.fromUser?.user_id?.toString()
      );
      
      if (!isFriend) {
        return {
          isValid: false,
          message: 'يجب أن تكون صديقاً لمرسل الدعوة'
        };
      }

      return {
        isValid: true,
        message: ''
      };

    } catch (error) {
      console.error('Error validating invite acceptance:', error);
      return {
        isValid: false,
        message: 'فشل في التحقق من شروط الدعوة'
      };
    }
  };

  const declineInvite = async (inviteId: string) => {
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

  // دالة حذف الدعوة المرسلة
  const cancelInvite = async (inviteId: string) => {
    try {
      await inviteService.cancelInvite(inviteId);
      toast({
        title: 'تم إلغاء الدعوة',
        description: 'تم حذف الدعوة بنجاح',
      });
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في إلغاء الدعوة',
        variant: 'destructive',
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

  // Function to calculate “time ago” in Arabic, adjusting for UTC‑based DB datetimes and local Syria time
  const arabicPlural = (value: number, forms: [string, string, string, string]): string => {
    if (value === 1) return forms[0];
    if (value === 2) return forms[1];
    if (value >= 3 && value <= 10) return forms[2];
    return forms[3];
  };

  const parseUTCDateString = (dateString: string): Date => {
    // تحويل "YYYY-MM-DD HH:mm:ss" إلى ISO +Z كي تُعامل كـ UTC
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

  // دالة معالجة أزرار الدعوة بناءً على الحالة
  const renderInviteButtons = (invite: any) => {
    const status = invite.status;
    
    switch (status) {
      case 'pending':
        return (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              onClick={() => acceptInvite(invite.id)}
              variant="chess"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Check className="h-4 w-4 ml-1" />
              قبول
            </Button>
            <Button
              onClick={() => declineInvite(invite.id)}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 ml-1" />
              رفض
            </Button>
          </div>
        );
      
      case 'accepted':
        return (
          <Button
            onClick={() => startGame(invite)}
            variant="chess"
            size="sm"
            className="w-full sm:w-auto"
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
            onClick={() => joinGame(invite)}
            variant="chess"
            size="sm"
            className="w-full sm:w-auto"
          >
            <MessageCircle className="h-4 w-4 ml-1" />
            دخول المباراة
          </Button>
        );
      
      default:
        return null;
    }
  };

  // دالة بدء المباراة
  const startGame = async (invite: Invite | any) => {
    try {
      if (invite?.status === 'game_started' && (invite?.game_id || invite?.game?.id)) {
        await joinGame(invite);
        return;
      }

      const result = await inviteService.startGame(invite.id, 'phone');
      const gameId = result?.data?.gameId || result?.gameId;

      if (!gameId) {
        throw new Error('لم يتم إرجاع معرف المباراة');
      }

      toast({
        title: 'تم بدء المباراة',
        description: 'جاري الانتقال إلى المباراة...',
      });

      navigate(`/game?id=${gameId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      const message = error instanceof Error ? error.message : 'فشل في بدء المباراة';
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });

      await loadInvites();
    }
  };

  // دالة دخول/استئناف المباراة مع التحقق من حالتها الفعلية
  const joinGame = async (invite: Invite | any) => {
    const gameId = invite?.game_id || invite?.game?.id;
    if (!gameId) {
      toast({
        title: 'لا توجد مباراة صالحة',
        description: 'هذه الدعوة لا تحتوي على مباراة قابلة للاستئناف',
        variant: 'destructive',
      });
      await loadInvites();
      return;
    }

    try {
      const gameResponse = await inviteService.getGameDetails(gameId);
      const gameStatus = gameResponse?.data?.status;

      if (!isGameStatusActiveForResume(gameStatus)) {
        toast({
          title: 'المباراة منتهية',
          description: 'تم إنهاء هذه المباراة، سيتم تحديث قائمة الدعوات.',
        });
        await loadInvites();
        return;
      }

      navigate(`/game?id=${gameId}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: 'تعذر استئناف المباراة',
        description: 'قد تكون المباراة منتهية أو غير متاحة حالياً',
        variant: 'destructive',
      });
      await loadInvites();
    }
  };

  // دالة قبول الدعوة بعد اختيار طريقة اللعب
  const confirmAcceptInvite = async () => {
    if (!selectedInvite || !acceptPlayMethod) return;
    
    setIsAcceptingInvite(true);
    try {
      // تحديد طريقة اللعب - دائماً إرسال physical_board إذا تم اختيار الرقعة المادية
      const playMethod = acceptPlayMethod === 'physical_board' ? 'physical_board' : 'phone';
      
      // قبول الدعوة وإنشاء اللعبة
      const result = await inviteService.acceptInvite(selectedInvite.id, playMethod);
      
      toast({
        title: "تم قبول الدعوة",
        description: "تم قبول الدعوة وإنشاء اللعبة بنجاح"
      });

      // إزالة الدعوة من القائمة
      setInvites(prev => prev.filter(inv => inv.id !== selectedInvite.id));
      
      // إغلاق المودال
      setShowAcceptInviteModal(false);
      setSelectedInvite(null);
      setAcceptPlayMethod(null);

    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من قبول الدعوة",
        variant: "destructive"
      });
    } finally {
      setIsAcceptingInvite(false);
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

  // دالة تصفية الدعوات المرسلة (فقط الحالات القابلة للإجراء)
  const getFilteredSentInvites = () => {
    return pendingInvites.filter((invite) => {
      if (invite.status === 'pending' || invite.status === 'accepted') {
        return true;
      }

      if (invite.status === 'game_started') {
        return isInviteGameStillActive(invite);
      }

      return false;
    });
  };

  // دالة معالجة أزرار الدعوات المرسلة
  const renderSentInviteButtons = (invite: any) => {
    const status = invite.status;
    
    switch (status) {
      case 'pending':
        return (
          <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => cancelInvite(invite.id)}>
            <X className="h-4 w-4 ml-1" />
            إلغاء
          </Button>
        );
      
      case 'accepted':
        return (
          <Button
            onClick={() => startGame(invite)}
            variant="chess"
            size="sm"
            className="w-full sm:w-auto"
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
            onClick={() => joinGame(invite)}
            variant="chess"
            size="sm"
            className="w-full sm:w-auto"
          >
            <MessageCircle className="h-4 w-4 ml-1" />
            دخول المباراة
          </Button>
        );
      
      default:
        return null;
    }
  };


  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                <h1 className="text-lg sm:text-xl font-bold text-foreground font-cairo truncate">الأصدقاء والدعوات</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FriendsTabValue)} className="space-y-6">
                   <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1">
           <TabsTrigger className="h-auto min-h-10 px-2 py-2 text-xs sm:text-sm leading-tight whitespace-normal" value="friends">إضافة أصدقاء</TabsTrigger>
           <TabsTrigger className="h-auto min-h-10 px-2 py-2 text-xs sm:text-sm leading-tight whitespace-normal" value="myfriends">
             أصدقائي ({friends.length})
           </TabsTrigger>
           <TabsTrigger className="h-auto min-h-10 px-2 py-2 text-xs sm:text-sm leading-tight whitespace-normal" value="invites">
             الدعوات الواردة ({getFilteredReceivedInvites().length})
           </TabsTrigger>
           <TabsTrigger className="h-auto min-h-10 px-2 py-2 text-xs sm:text-sm leading-tight whitespace-normal" value="pending">
              الدعوات المرسلة ({getFilteredSentInvites().length})
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
                <div className="flex gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="ابحث باسم المستخدم أو الإيميل"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searchTerm.length >= 2 && (
                  <div className="mt-4 space-y-2">
                    {isSearching ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground mt-2">جاري البحث...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">نتائج البحث:</h4>
                        {searchResults.map((user) => (
                          <div key={user.user_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={hasCustomAvatar(user.thumbnail) ? user.thumbnail : undefined} />
                                <AvatarFallback>{getInitialsFromName(user.username)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <h4 className="font-medium truncate">{user.username}</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Crown className="h-3 w-3" />
                                  <span>{user.rank || 1500}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => sendFriendRequest(user.user_id.toString())}
                            >
                              إرسال طلب صداقة
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : searchTerm.length >= 2 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Incoming Friend Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  طلبات الصداقة الواردة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingIncoming ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">جاري التحميل...</p>
                  </div>
                ) : incomingRequests.length > 0 ? (
                  <div className="space-y-3">
                    {incomingRequests.map((request) => (
                      <div key={request.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={
                                hasCustomAvatar(request.from_user?.thumbnail)
                                  ? request.from_user?.thumbnail
                                  : undefined
                              }
                            />
                            <AvatarFallback>{getInitialsFromName(request.from_user?.username)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">{request.from_user?.username}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{getTimeAgo(request.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="chess"
                            className="w-full"
                            onClick={() => acceptFriendRequest(request.id.toString())}
                          >
                            <Check className="h-3 w-3 ml-1" />
                            قبول
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => rejectFriendRequest(request.id.toString())}
                          >
                            <X className="h-3 w-3 ml-1" />
                            رفض
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <UserPlus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لا توجد طلبات صداقة واردة</p>
                  </div>
                )}
              </CardContent>
                         </Card>
           </TabsContent>

           <TabsContent value="myfriends" className="space-y-4">
             {friends.length > 0 ? (
               friends.map((friend) => (
                 <Card key={friend.user_id}>
                   <CardContent className="p-3 sm:p-6">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                       <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                         <Avatar className="h-10 w-10 shrink-0">
                           <AvatarImage src={hasCustomAvatar(friend.thumbnail) ? friend.thumbnail : undefined} />
                           <AvatarFallback>{getInitialsFromName(friend.username)}</AvatarFallback>
                         </Avatar>
                         <div className="space-y-1 min-w-0">
                           <h3 className="font-semibold font-cairo truncate">{friend.username}</h3>
                           <div className="flex items-center gap-2">
                             {getStatusBadge(friend.state, false)}
                             <div className="flex items-center gap-1 text-sm text-muted-foreground">
                               <Crown className="h-3 w-3" />
                               <span>{friend.rank}</span>
                             </div>
                           </div>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto">
                         {friend.state === 'online' && (
                           <Button
                             variant="chess"
                             size="sm"
                             className="w-full sm:w-auto"
                             onClick={() => handleOpenInviteModal(friend)}
                           >
                             <MessageCircle className="h-4 w-4 ml-1" />
                             دعوة إلى اللعب
                           </Button>
                         )}
                         <Button 
                           variant="outline"
                           size="sm"
                           className="w-full sm:w-auto"
                           onClick={() => handleDeleteClick(friend)}
                         >
                           <X className="h-4 w-4 ml-1" />
                           إلغاء الصداقة
                         </Button>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               ))
             ) : (
               <Card>
                 <CardContent className="text-center py-12">
                   <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                   <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد أصدقاء</h3>
                   <p className="text-muted-foreground">لم تقم بإضافة أصدقاء بعد. ابحث عن أصدقاء جدد!</p>
                 </CardContent>
               </Card>
             )}
           </TabsContent>

           <TabsContent value="invites" className="space-y-4">
            {getFilteredReceivedInvites().map((invite) => (
              <Card key={invite.id} className="border-primary/20">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={hasCustomAvatar(invite.fromUser?.thumbnail) ? invite.fromUser?.thumbnail : undefined}
                        />
                        <AvatarFallback>{getInitialsFromName(invite.fromUser?.username)}</AvatarFallback>
                      </Avatar>
                                             <div className="space-y-1 min-w-0">
                         <h3 className="font-semibold font-cairo truncate">{invite.fromUser?.username || 'مستخدم غير معروف'}</h3>
                         <div className="flex items-center gap-2">
                           {getStatusBadge(invite.fromUser?.state, false)}
                           <div className="flex items-center gap-1 text-sm text-muted-foreground">
                             <Crown className="h-3 w-3" />
                             <span>{invite.fromUser?.rank || 1500}</span>
                           </div>
                         </div>
                         <div className="text-sm text-muted-foreground">
                           {getTimeAgo(invite.date_time)}
                         </div>
                         <div className="text-sm text-muted-foreground flex items-center gap-1">
                           <Clock className="h-3 w-3" />
                           <span>المدة: {formatTimeControl(invite.time_control)}</span>
                         </div>
                       </div>
                    </div>

                    <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Badge variant="default" className={getStatusColor(invite.status)}>
                        {getStatusText(invite.status)}
                      </Badge>
                      {renderInviteButtons(invite)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {getFilteredReceivedInvites().length === 0 && (
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
            {getFilteredSentInvites().map((invite) => (
              <Card key={invite.id}>
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={hasCustomAvatar(invite.toUser?.thumbnail) ? invite.toUser?.thumbnail : undefined}
                        />
                        <AvatarFallback>{getInitialsFromName(invite.toUser?.username)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0">
                        <h3 className="font-semibold font-cairo truncate">{invite.toUser?.username}</h3>
                        <div className="text-sm text-muted-foreground">
                          {getTimeAgo(invite.date_time)}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>المدة: {formatTimeControl(invite.time_control)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Badge variant="default" className={getStatusColor(invite.status)}>
                        {getStatusText(invite.status)}
                      </Badge>
                      {renderSentInviteButtons(invite)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {getFilteredSentInvites().length === 0 && (
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

       {/* Delete Confirmation Dialog */}
       <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="font-cairo">تأكيد إلغاء الصداقة</DialogTitle>
             <DialogDescription className="font-cairo">
               هل أنت متأكد من إلغاء الصداقة مع {friendToDelete?.username}؟
               <br />
               <span className="text-sm text-muted-foreground">
                 لن تتمكن من التراجع عن هذا الإجراء.
               </span>
             </DialogDescription>
           </DialogHeader>
           <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
             <Button variant="outline" onClick={cancelDelete}>
               إلغاء
             </Button>
             <Button variant="destructive" onClick={confirmDelete}>
               <X className="h-4 w-4 ml-1" />
               إلغاء الصداقة
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Invite Modal */}
       <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="font-cairo">إرسال دعوة لعب</DialogTitle>
             <DialogDescription className="font-cairo">
               اختر طريقة اللعب ومدة المباراة:
             </DialogDescription>
           </DialogHeader>
           <div className="flex flex-col gap-4">
             <div className="space-y-2">
               <span className="text-sm font-medium font-cairo">مدة المباراة</span>
               <Select value={selectedTime} onValueChange={setSelectedTime}>
                 <SelectTrigger>
                   <SelectValue placeholder="اختر مدة المباراة" />
                 </SelectTrigger>
                 <SelectContent>
                   {timeControlOptions.map((minutes) => (
                     <SelectItem key={minutes} value={minutes}>
                       {formatTimeControl(minutes)}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <Button
               variant={playMethod === 'phone' ? 'chess' : 'outline'}
               onClick={() => setPlayMethod('phone')}
             >
               الهاتف
             </Button>
             <Button
               variant={playMethod === 'physical_board' ? 'chess' : 'outline'}
               onClick={() => setPlayMethod('physical_board')}
             >
               رقعة مادية
             </Button>
           </div>
           <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
             <Button variant="outline" onClick={() => setShowInviteModal(false)} disabled={isSendingInvite}>
               إلغاء
             </Button>
             <Button
               variant="chess"
               onClick={sendGameInviteToBackend}
               disabled={!playMethod || isSendingInvite}
             >
               {isSendingInvite ? 'جاري الإرسال...' : 'إرسال الدعوة'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Accept Invite Modal */}
       <Dialog open={showAcceptInviteModal} onOpenChange={setShowAcceptInviteModal}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="font-cairo">قبول دعوة اللعب</DialogTitle>
             <DialogDescription className="font-cairo">
               مدة المباراة: {formatTimeControl(selectedInvite?.time_control)}. اختر طريقة اللعب التي تفضلها:
             </DialogDescription>
           </DialogHeader>
           <div className="flex flex-col gap-4">
             <Button
               variant={acceptPlayMethod === 'phone' ? 'chess' : 'outline'}
               onClick={() => setAcceptPlayMethod('phone')}
             >
               الهاتف
             </Button>
             <Button
               variant={acceptPlayMethod === 'physical_board' ? 'chess' : 'outline'}
               onClick={() => setAcceptPlayMethod('physical_board')}
             >
               رقعة مادية
             </Button>
           </div>
           <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
             <Button variant="outline" onClick={() => setShowAcceptInviteModal(false)} disabled={isAcceptingInvite}>
               إلغاء
             </Button>
             <Button
               variant="chess"
               onClick={confirmAcceptInvite}
               disabled={!acceptPlayMethod || isAcceptingInvite}
             >
               {isAcceptingInvite ? 'جاري القبول...' : 'قبول الدعوة'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };

export default Friends;

