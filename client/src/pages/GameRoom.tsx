import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Clock, 
  Flag, 
  Handshake, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Send,
  RotateCcw,
  Crown,
  Wifi,
  WifiOff,
  Minimize2,
  ArrowLeft,
  CircleHelp,
  MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/services/socketService';
import { friendService } from '@/services/friendService';

interface Player {
  id: number;
  name: string;
  rank: number;
  color: 'white' | 'black';
  thumbnail?: string;
}

interface GameData {
  whitePlayer: Player;
  blackPlayer: Player;
  startedByUser: {
    id: number;
    name: string;
  };
  gameType: string;
  initialTime: number;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  whitePlayMethod: string;
  blackPlayMethod: string;
  currentFen: string;
  status: string;
  currentTurn: string;
  startedAt: string; // Added for game duration
  duration?: string; // Added for game duration
  endedAt?: string | null;
  winnerId?: number | null;
}

interface ChatMessage {
  id: string | number;
  userId: string | number;
  username: string;
  message: string;
  type: 'text' | 'emoji' | 'system';
  timestamp: Date | string;
  thumbnail?: string | null;
}

interface GameMove {
  moveNumber: number;
  white?: string;
  black?: string;
  san: string;
  fen: string;
}

const appendMoveWithDedup = (
  previousMoves: GameMove[],
  movedBy: 'white' | 'black',
  san: string,
  fen: string
): GameMove[] => {
  if (!san || !fen) {
    return previousMoves;
  }

  const lastMove = previousMoves[previousMoves.length - 1];

  // Prevent duplicate appends from local optimistic update + socket echo.
  if (lastMove && lastMove.san === san && lastMove.fen === fen) {
    return previousMoves;
  }

  if (movedBy === 'white') {
    const nextMoveNumber = (lastMove?.moveNumber || 0) + 1;
    return [
      ...previousMoves,
      {
        moveNumber: nextMoveNumber,
        white: san,
        black: null,
        san,
        fen
      }
    ];
  }

  if (!lastMove) {
    return [
      {
        moveNumber: 1,
        white: null,
        black: san,
        san,
        fen
      }
    ];
  }

  if (lastMove.black) {
    return [
      ...previousMoves,
      {
        moveNumber: lastMove.moveNumber + 1,
        white: null,
        black: san,
        san,
        fen
      }
    ];
  }

  const updatedMoves = [...previousMoves];
  updatedMoves[updatedMoves.length - 1] = {
    ...lastMove,
    black: san,
    san,
    fen
  };

  return updatedMoves;
};

const GameRoom = () => {
  const { user, token } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [gameState, setGameState] = useState({
    id: '',
    status: 'active', // 'waiting', 'active', 'finished'
    currentTurn: 'white',
    isCheck: false,
    isCheckmate: false,
    isDraw: false
  });
  
  const [players, setPlayers] = useState<{ white: Player; black: Player }>({
    white: {
      id: 0,
      name: 'جاري التحميل...',
      rank: 0,
      color: 'white'
    },
    black: {
      id: 0,
      name: 'جاري التحميل...',
      rank: 0,
      color: 'black'
    }
  });

  // تحديد اللاعب الحالي بناءً على معرف المستخدم
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const isSpectatorMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('spectator') === '1';
  }, []);
  
  // إعداد بيانات اللاعبين
  useEffect(() => {
    if (!gameData || !user) return;
      
    const currentUserId = user.id;
      
      if (gameData.whitePlayer.id === parseInt(currentUserId)) {
        setCurrentPlayer('white');
        // تحديث ترتيب اللاعبين للاعب الأبيض
        setPlayers({
          white: gameData.whitePlayer,
          black: gameData.blackPlayer
        });
      // تحديث المؤقتات من بيانات اللعبة
      setTimers({
        white: gameData.whiteTimeLeft || 600,
        black: gameData.blackTimeLeft || 600,
        isRunning: gameData.status === 'active',
        lastUpdate: Date.now()
      });
      // تحديث دور اللعب من بيانات اللعبة
      setGameState(prev => ({
        ...prev,
        currentTurn: gameData.currentTurn || 'white'
      }));
      } else if (gameData.blackPlayer.id === parseInt(currentUserId)) {
        setCurrentPlayer('black');
        // قلب ترتيب اللاعبين للاعب الأسود
        setPlayers({
          white: gameData.blackPlayer,
          black: gameData.whitePlayer
        });
      // تحديث المؤقتات من بيانات اللعبة
      setTimers({
        white: gameData.whiteTimeLeft || 600,
        black: gameData.blackTimeLeft || 600,
        isRunning: gameData.status === 'active',
        lastUpdate: Date.now()
      });
      // تحديث دور اللعب من بيانات اللعبة
      setGameState(prev => ({
        ...prev,
        currentTurn: gameData.currentTurn || 'black'
      }));
      } else {
        console.error('User is not a player in this game');
    }
  }, [gameData, user]);
  
  const [timers, setTimers] = useState<{
    white: number;
    black: number;
    isRunning: boolean;
    lastUpdate: number;
  }>({
    white: 600,
    black: 600,
    isRunning: false,
    lastUpdate: Date.now()
  });

  const [, setRenderTick] = useState(0); // لإعادة التصيير بسلاسة

  // Update timers display when timers state changes
  useEffect(() => {
  }, [timers, gameState, currentPlayer]);

  // Timer countdown effect - فقط لإعادة تصيير العرض بسلاسة
  useEffect(() => {
    if (!timers.isRunning || gameState.status !== 'active') return;

    const interval = setInterval(() => {
      // Force re-render to update displayed time
      setRenderTick(prev => prev + 1);
      
      // Check for timeout based on calculated times
      const now = Date.now();
      const timeSinceUpdate = (now - timers.lastUpdate) / 1000;
      
      let whiteRemaining = Math.max(0, timers.white - (gameState.currentTurn === 'white' ? timeSinceUpdate : 0));
      let blackRemaining = Math.max(0, timers.black - (gameState.currentTurn === 'black' ? timeSinceUpdate : 0));
      
      if (whiteRemaining <= 0 || blackRemaining <= 0) {
        const timeoutPlayer = whiteRemaining <= 0 ? 'white' : 'black';
        const winner = timeoutPlayer === 'white' ? 'black' : 'white';
        
        handleGameEnd({ 
          reason: 'timeout', 
          winner: winner 
        });
      }
    }, 100); // Update frequently for smooth display

    return () => clearInterval(interval);
  }, [timers.isRunning, gameState.currentTurn, gameState.status, timers.lastUpdate]);

  const [moves, setMoves] = useState<GameMove[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isMobileChatModalOpen, setIsMobileChatModalOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isPhysicalMove, setIsPhysicalMove] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [showGameEndModalState, setShowGameEndModalState] = useState(false);
  const [gameEndData, setGameEndData] = useState<{
    reason: string;
    winner?: string;
    ratingDelta?: number;
    isPlacement?: boolean;
  } | null>(null);
  const [showResignConfirmModal, setShowResignConfirmModal] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const gamePageRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const startCountdownIntervalRef = useRef<number | null>(null);
  const countdownInitializedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();
  const DRAWING_GUIDE_STORAGE_KEY = 'drawing_guide_friend_v1';

  const isMobileDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }, []);

  const showDrawingGuide = useCallback((force = false) => {
    if (typeof window === 'undefined') return;
    if (isMobileDevice()) return;
    if (!force && localStorage.getItem(DRAWING_GUIDE_STORAGE_KEY) === '1') return;

    const description = 'استخدم زر الفأرة الأيمن: سحب لرسم سهم، ونقرة واحدة لتحديد مربع. يمكنك رسم عدة أسهم وإزالتها بالنقر مرة أخرى. هذه الرسومات للتوضيح فقط ولا تؤثر على اللعب.';

    toast({
      title: 'دليل الرسم التوضيحي',
      description,
    });

    if (!force) {
      localStorage.setItem(DRAWING_GUIDE_STORAGE_KEY, '1');
    }
  }, [isMobileDevice, toast]);

  const clearStartCountdownInterval = useCallback(() => {
    if (startCountdownIntervalRef.current !== null) {
      window.clearInterval(startCountdownIntervalRef.current);
      startCountdownIntervalRef.current = null;
    }
  }, []);

  const startPreGameCountdown = useCallback(() => {
    clearStartCountdownInterval();
    setStartCountdown(3);
    setTimers((prev) => ({
      ...prev,
      isRunning: false,
      lastUpdate: Date.now(),
    }));

    startCountdownIntervalRef.current = window.setInterval(() => {
      setStartCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearStartCountdownInterval();
          setTimers((current) => ({
            ...current,
            isRunning: gameState.status === 'active',
            lastUpdate: Date.now(),
          }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearStartCountdownInterval, gameState.status]);

  const applySoundPreference = useCallback((enabled: boolean) => {
    const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    mediaElements.forEach((media) => {
      media.muted = !enabled;
      media.volume = enabled ? 1 : 0;
    });
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioContextRef.current = new Ctx();
    }
    return audioContextRef.current;
  }, []);

  const playSoundEffect = useCallback((kind: 'move' | 'capture' | 'check' | 'toggle', force = false) => {
    if (!force && !isSoundEnabled) return;

    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      const settings = {
        move: { freq: 520, type: 'sine' as OscillatorType, attack: 0.003, release: 0.08, volume: 0.11 },
        capture: { freq: 390, type: 'triangle' as OscillatorType, attack: 0.003, release: 0.14, volume: 0.14 },
        check: { freq: 740, type: 'square' as OscillatorType, attack: 0.003, release: 0.18, volume: 0.18 },
        toggle: { freq: 620, type: 'sine' as OscillatorType, attack: 0.002, release: 0.10, volume: 0.16 },
      }[kind];

      oscillator.type = settings.type;
      oscillator.frequency.setValueAtTime(settings.freq, context.currentTime);

      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(settings.volume, context.currentTime + settings.attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + settings.release);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + settings.release + 0.01);
    };

    if (context.state === 'suspended') {
      context.resume().then(play).catch(() => {});
      return;
    }

    play();
  }, [getAudioContext, isSoundEnabled]);

  const toggleSound = useCallback(async () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    localStorage.setItem('game_sound_enabled', next ? '1' : '0');
    applySoundPreference(next);
    if (next) {
      const context = getAudioContext();
      if (context && context.state === 'suspended') {
        try {
          await context.resume();
          audioUnlockedRef.current = true;
        } catch {
          // Ignore; we'll still try to play.
        }
      }
      playSoundEffect('toggle', true);
    }
    toast({
      title: next ? 'تم تشغيل الصوت' : 'تم كتم الصوت',
    });
  }, [applySoundPreference, getAudioContext, isSoundEnabled, playSoundEffect, toast]);

  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return;
      const context = getAudioContext();
      if (!context) return;
      try {
        if (context.state === 'suspended') {
          await context.resume();
        }
        audioUnlockedRef.current = true;
      } catch {
        // Ignore; next user interaction will retry.
      }
    };

    const events: (keyof WindowEventMap)[] = ['touchstart', 'pointerdown', 'click'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, unlockAudio, { passive: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, unlockAudio);
      });
    };
  }, [getAudioContext]);

  const toggleFullscreen = useCallback(async () => {
    const rootElement = gamePageRef.current || document.documentElement;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const target = rootElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    try {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      if (isCurrentlyFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return;
        }
        if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
          return;
        }
      } else {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
          return;
        }
        if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
          return;
        }
      }

      toast({
        title: 'غير مدعوم',
        description: 'وضع ملء الشاشة غير مدعوم على هذا الجهاز.',
      });
    } catch (error) {
      toast({
        title: 'تعذر تغيير وضع الشاشة',
        description: error instanceof Error ? error.message : 'حاول مرة أخرى.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    const saved = localStorage.getItem('game_sound_enabled');
    const enabled = saved !== '0';
    setIsSoundEnabled(enabled);
    applySoundPreference(enabled);
  }, [applySoundPreference]);

  useEffect(() => {
    showDrawingGuide(false);
  }, [showDrawingGuide]);

  useEffect(() => {
    const updateFullscreenState = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState as EventListener);
    updateFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState as EventListener);
    };
  }, []);

  const getValidGameIdFromUrl = useCallback((): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawGameId = urlParams.get('game_id') || urlParams.get('id');
    if (!rawGameId) return null;
    return /^\d+$/.test(rawGameId) ? rawGameId : null;
  }, []);

  const shouldSkipPreGameCountdown = useCallback((): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('skip_countdown') === '1';
  }, []);

  // دالة لعرض مودال انتهاء اللعبة
  const boardResultSticker = React.useMemo<'win' | 'loss' | 'draw' | null>(() => {
    const normalizedStatus = (gameState.status || '').toLowerCase();
    const isEnded = normalizedStatus === 'finished' || normalizedStatus === 'ended';
    if (!isEnded) return null;

    const winnerFromEnd = gameEndData?.winner;
    const winnerFromState = (gameState as any).winner as string | null | undefined;
    let winner = winnerFromEnd || winnerFromState;

    // fallback عند فتح مباراة منتهية مباشرة بدون event gameEnd عبر socket
    if (!winner && gameData?.winnerId) {
      const winnerId = Number(gameData.winnerId);
      if (winnerId === Number(gameData.whitePlayer?.id)) winner = 'white';
      if (winnerId === Number(gameData.blackPlayer?.id)) winner = 'black';
    }

    if (!winner) return 'draw';
    return winner === currentPlayer ? 'win' : 'loss';
  }, [gameState.status, gameEndData?.winner, currentPlayer, gameState, gameData]);

  const isGameEndedForUi = React.useMemo(() => {
    const normalized = (gameState.status || '').toLowerCase();
    return normalized === 'ended' || normalized === 'finished';
  }, [gameState.status]);
  const showGameEndModal = useCallback((reason: string, winner?: string, ratingDelta?: number, isPlacement?: boolean) => {
    setGameEndData({ reason, winner, ratingDelta, isPlacement });
    setShowGameEndModalState(true);
  }, []);

  // دالة للعودة إلى dashboard
  const goToDashboard = useCallback(() => {
    window.location.href = '/dashboard';
  }, []);

  const quickMatchOpponent = useMemo(() => {
    if (!gameData || !user) return null;

    const currentUserId = Number(user.id);
    if (!Number.isFinite(currentUserId)) return null;

    if (Number(gameData.whitePlayer.id) === currentUserId) {
      return gameData.blackPlayer;
    }
    if (Number(gameData.blackPlayer.id) === currentUserId) {
      return gameData.whitePlayer;
    }

    return null;
  }, [gameData, user]);

  const isCurrentUserPlayer = useMemo(() => {
    if (!gameData || !user) return false;
    const currentUserId = Number(user.id);
    if (!Number.isFinite(currentUserId)) return false;
    return (
      Number(gameData.whitePlayer.id) === currentUserId ||
      Number(gameData.blackPlayer.id) === currentUserId
    );
  }, [gameData, user]);

  const currentUserNumericId = useMemo(() => {
    const parsed = Number(user?.id || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [user?.id]);

  const handleQuickRematch = useCallback(() => {
    window.location.href = '/dashboard';
  }, []);

  const handleAddOpponentAsFriend = useCallback(async () => {
    if (!quickMatchOpponent) return;
    try {
      await friendService.sendFriendRequest(String(quickMatchOpponent.id));
      toast({
        title: 'تم إرسال الطلب',
        description: `تم إرسال طلب صداقة إلى ${quickMatchOpponent.name}`,
      });
    } catch (error) {
      toast({
        title: 'تعذر إرسال طلب الصداقة',
        description: error instanceof Error ? error.message : 'حاول مرة أخرى.',
        variant: 'destructive',
      });
    }
  }, [quickMatchOpponent, toast]);

    // جلب بيانات اللعبة من الـ API
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // الحصول على معرف اللعبة من الـ URL
        let gameId = getValidGameIdFromUrl();
        if (!gameId) {
          try {
            const activeGameResponse = await api.get('/api/users/games/active');
            const activeGameId = activeGameResponse?.data?.data?.id;
            if (activeGameId) {
              gameId = String(activeGameId);
              const url = new URL(window.location.href);
              url.searchParams.set('id', gameId);
              window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
            }
          } catch (_fallbackError) {
            // no active game fallback found
          }
        }

        if (!gameId) {
          setError('Invalid or missing game ID in URL');
          return;
        }
        
        
        const response = await api.get(`/api/game/${gameId}`);
        
        if (response.data.success) {
          const data = response.data.data;
          
          // جلب مدة اللعبة
          try {
            const durationResponse = await api.get(`/api/game/${gameId}/duration`);
            if (durationResponse.data.success) {
              data.duration = durationResponse.data.data.formattedDuration;
            }
          } catch (durationErr) {
            console.error('خطأ في جلب مدة اللعبة:', durationErr);
            data.duration = 'غير متوفر';
          }
          
          setGameData(data);
          
          // تحديث معرف اللعبة في gameState
          setGameState(prev => ({
            ...prev,
            id: gameId
          }));
          
          // تحديث حالة اللعبة والدور
          setGameState(prev => ({
            ...prev,
            status: data.status,
            currentTurn: data.currentTurn || 'white'
          }));
          
          // تحديث الرقعة باستخدام FEN
          if (data.currentFen && data.currentFen !== 'startpos') {
            const newGame = new Chess(data.currentFen);
            setGame(newGame);
          }
          
          // تحديث المؤقتات من بيانات اللعبة
          setTimers({
            white: data.whiteTimeLeft || 600,
            black: data.blackTimeLeft || 600,
            isRunning: data.status === 'active',
            lastUpdate: Date.now()
          });
          
          
        } else {
          setError('فشل في جلب بيانات اللعبة');
        }
      } catch (err) {
        console.error('خطأ في جلب بيانات اللعبة:', err);
        setError('حدث خطأ في الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    };
    
    // جلب النقلات من الباك إند
    const fetchGameMoves = async () => {
      try {
        const gameId = getValidGameIdFromUrl();
        if (!gameId) {
          return;
        }
        
        
        const response = await api.get(`/api/game/${gameId}/moves`);
        
        if (response.data.success) {
          const movesData = response.data.data.moves;
          
          // تحويل البيانات إلى التنسيق المطلوب
          const formattedMoves = movesData.map((movePair: any) => ({
            moveNumber: movePair.moveNumber,
            white: movePair.white?.san || null,
            black: movePair.black?.san || null,
            san: movePair.white?.san || movePair.black?.san,
            fen: movePair.fen
          }));
          
          setMoves(formattedMoves);
        } else {
          console.error('فشل في جلب النقلات');
        }
      } catch (err) {
        console.error('خطأ في جلب النقلات:', err);
      }
    };
    
    fetchGameData();
    fetchGameMoves();
  }, [getValidGameIdFromUrl]);

  useEffect(() => {
    const fetchGameChat = async () => {
      try {
        const gameId = getValidGameIdFromUrl();
        if (!gameId) return;

        const response = await api.get(`/api/game/${gameId}/chat`);
        if (!response?.data?.success) return;

        const messages = Array.isArray(response.data.data?.messages) ? response.data.data.messages : [];
        setChatMessages(
          messages.map((msg: any) => ({
            id: msg.id,
            userId: msg.userId,
            username: msg.username || 'مستخدم',
            thumbnail: msg.thumbnail || null,
            message: msg.message || '',
            type: 'text',
            timestamp: msg.createdAt || new Date().toISOString(),
          }))
        );
      } catch (chatError) {
        console.error('Failed to fetch game chat:', chatError);
      }
    };

    fetchGameChat();
  }, [getValidGameIdFromUrl]);

  useEffect(() => {
    const el = chatEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages]);

  useEffect(() => {
    if (loading) return;
    if (!gameData) return;
    if (countdownInitializedRef.current) return;
    if (gameState.status !== 'active') return;
    if (shouldSkipPreGameCountdown()) {
      countdownInitializedRef.current = true;
      setStartCountdown(null);
      clearStartCountdownInterval();
      return;
    }

    const hasNoMoves = moves.length === 0;
    const isInitialBoard = game.history().length === 0;
    const initialTime = Number(gameData.initialTime || 600);
    const clockAlreadyRunning = Boolean(timers.isRunning);
    const hasClockMoved =
      Number(gameData.whiteTimeLeft || timers.white) < initialTime ||
      Number(gameData.blackTimeLeft || timers.black) < initialTime;
    const startedAtMs = new Date(gameData.startedAt || Date.now()).getTime();
    const gameAgeSeconds = Number.isNaN(startedAtMs)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const isFreshStartWindow = gameAgeSeconds <= 4;

    countdownInitializedRef.current = true;
    if (hasNoMoves && isInitialBoard && !clockAlreadyRunning && !hasClockMoved && isFreshStartWindow) {
      startPreGameCountdown();
    } else {
      setStartCountdown(null);
      clearStartCountdownInterval();
    }
  }, [loading, gameData, gameState.status, moves.length, game, timers.isRunning, timers.white, timers.black, startPreGameCountdown, clearStartCountdownInterval, shouldSkipPreGameCountdown]);

  useEffect(() => {
    return () => {
      clearStartCountdownInterval();
    };
  }, [clearStartCountdownInterval]);

  // Handler functions using useCallback to maintain stable references
  const handleClockUpdate = useCallback((data: { whiteTimeLeft: number; blackTimeLeft: number; currentTurn: string }) => {
                    if (gameState.status !== 'active') {
                      return;
                    }
                    const { whiteTimeLeft, blackTimeLeft, currentTurn } = data;
                    
                    // Validate data
    if (typeof whiteTimeLeft !== 'number' || typeof blackTimeLeft !== 'number') {
                      console.error('Invalid time data received:', data);
                      return;
                    }

    const initialTime = Number(gameData?.initialTime || 600);
    const serverClockAdvanced =
      Number(whiteTimeLeft) < initialTime || Number(blackTimeLeft) < initialTime;
    const startedAtMs = new Date(gameData?.startedAt || Date.now()).getTime();
    const gameAgeSeconds = Number.isNaN(startedAtMs)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const isFreshStartWindow = gameAgeSeconds <= 4;

    // While 3-2-1 is visible, keep timers frozen only in very fresh brand-new games.
    if (startCountdown !== null && !serverClockAdvanced && isFreshStartWindow) {
      setTimers({
        white: whiteTimeLeft,
        black: blackTimeLeft,
        isRunning: false,
        lastUpdate: Date.now()
      });

      setGameState(prev => ({
        ...prev,
        currentTurn
      }));
      return;
    }

    // If not a fresh start (or clock already progressed), remove 3-2-1 immediately.
    if (startCountdown !== null && (serverClockAdvanced || !isFreshStartWindow)) {
      setStartCountdown(null);
      clearStartCountdownInterval();
    }

    // Update timers with server data (this overrides local countdown)
    setTimers({
                      white: whiteTimeLeft,
                      black: blackTimeLeft,
                      isRunning: true,
                      lastUpdate: Date.now()
    });
                    
    setGameState(prev => ({
                        ...prev,
                        currentTurn
    }));
    
  }, [gameState.status, startCountdown, gameData?.initialTime, gameData?.startedAt, clearStartCountdownInterval]); // Keep timers frozen once game is finished

  const handleTurnUpdate = useCallback((data: { currentTurn: string }) => {
                    if (gameState.status !== 'active') {
                      return;
                    }
                    const { currentTurn } = data;

                    setGameState(prev => ({
                      ...prev,
                      currentTurn
                    }));

    // Update timers to switch active timer when turn changes
    setTimers(prev => ({
      ...prev,
      lastUpdate: Date.now() // Reset timer to prevent double counting
    }));
  }, [gameState.status]);

  const handleGameEnd = useCallback((data: {
    reason: string;
    winner?: string;
    ratingChanges?: {
      white?: { userId: number; delta: number; newRating?: number; isPlacement?: boolean; gamesPlayed?: number };
      black?: { userId: number; delta: number; newRating?: number; isPlacement?: boolean; gamesPlayed?: number };
    } | null;
  }) => {
    
    const { reason, winner, ratingChanges } = data;
    
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      winner: winner
    }));
    
    
    // Stop timers
    setTimers(prev => ({
      ...prev,
      isRunning: false
    }));
    setStartCountdown(null);
    clearStartCountdownInterval();


    // Show appropriate message
    let message = '';
    switch (reason) {
      case 'checkmate':
        message = winner === currentPlayer ? 'مبروك! فزت بالمباراة' : 'للأسف، خسرت المباراة';
        break;
      case 'timeout':
        message = `فاز ${winner === currentPlayer ? 'أنت' : 'الخصم'} بالوقت`;
        break;
      case 'resign':
        message = winner === currentPlayer ? 'فزت بالاستسلام' : 'خسرت بالاستسلام';
        break;
      case 'draw':
      case 'stalemate':
      case 'threefold_repetition':
      case 'insufficient_material':
        message = 'انتهت المباراة بالتعادل';
        break;
      default:
        message = 'انتهت المباراة';
    }
    
    
    toast({
      title: "انتهت المباراة",
      description: message,
    });

    const myUserId = Number(user?.id || 0);
    const myRatingChange =
      ratingChanges?.white && Number(ratingChanges.white.userId) === myUserId
        ? ratingChanges.white
        : ratingChanges?.black && Number(ratingChanges.black.userId) === myUserId
          ? ratingChanges.black
          : null;
    const myRatingDelta = Number(myRatingChange?.delta) || 0;
    const isPlacementChange = Boolean(myRatingChange?.isPlacement);
    const gamesPlayedBefore = Number(myRatingChange?.gamesPlayed || 0);
    const gamesPlayedAfter = gamesPlayedBefore + 1;
    const placementJustCompleted = isPlacementChange && gamesPlayedAfter >= 10;

    if (myRatingDelta !== 0) {
      toast({
        title: myRatingDelta > 0 ? `🎉 +${myRatingDelta} نقطة` : `❌ ${myRatingDelta} نقطة`,
        description: isPlacementChange
          ? `تم تحديث تقييمك بعد المباراة (Placement ${gamesPlayedAfter}/10)`
          : 'تم تحديث تقييمك بعد المباراة',
      });
    }

    if (placementJustCompleted) {
      const finalRating = Number(myRatingChange?.newRating || 0);
      toast({
        title: '🎯 تم تحديد مستواك',
        description: finalRating > 0 ? `تم تثبيت تقييمك على ${finalRating}` : 'اكتملت مرحلة تحديد المستوى',
      });
    }

    // Show game end modal
    showGameEndModal(reason, winner, myRatingDelta, isPlacementChange);
    
  }, [currentPlayer, showGameEndModal, clearStartCountdownInterval, toast, user?.id]);

  const handleOpponentMove = useCallback((data: any) => {
    
    const { move: san, fen, movedBy, currentTurn, isPhysical = false } = data;
    if (!fen) return;
    
    // Handle physical move notification
    if (isPhysical) {
      setIsPhysicalMove(true);
      toast({
        title: "حركة من اللوحة المادية",
        description: "تم تحريك القطعة على اللوحة الفعلية",
      });
      setTimeout(() => setIsPhysicalMove(false), 3000);
    }

    // Update game with new FEN (immutable instance to ensure UI/effects update consistently)
    const syncedGame = new Chess(fen);
    setGame(syncedGame);

    // Update game state
    setGameState(prev => ({
      ...prev,
      fen: fen,
      currentTurn: currentTurn || (movedBy === 'white' ? 'black' : 'white')
    }));

    // Check for game end conditions
    const gameCopy = new Chess(fen);
    const isCaptureMove = typeof san === 'string' && san.includes('x');
    if (gameCopy.isCheckmate() || gameCopy.inCheck()) {
      playSoundEffect('check');
    } else if (isCaptureMove) {
      playSoundEffect('capture');
    } else {
      playSoundEffect('move');
    }

    if (gameCopy.isCheckmate()) {
      handleGameEnd({ reason: 'checkmate', winner: movedBy === 'white' ? 'black' : 'white' });
    } else if (gameCopy.isDraw()) {
      handleGameEnd({ reason: 'draw' });
    } else if (gameCopy.isStalemate()) {
      handleGameEnd({ reason: 'stalemate' });
    } else if (gameCopy.isThreefoldRepetition()) {
      handleGameEnd({ reason: 'threefold_repetition' });
    } else if (gameCopy.isInsufficientMaterial()) {
      handleGameEnd({ reason: 'insufficient_material' });
    }

    // Update moves list
    if (movedBy === 'white' || movedBy === 'black') {
      setMoves(prev => appendMoveWithDedup(prev, movedBy, san, fen));
    }

    setIsProcessingMove(false);
  }, [handleGameEnd, playSoundEffect, toast]);

  const handleGameTimeout = useCallback((data: { winner: string; reason?: string }) => {
    
    const { winner, reason } = data;
    const getArabicTimeoutReason = (rawReason?: string) => {
      if (!rawReason) return null;
      const normalized = rawReason.toLowerCase().trim();
      if (normalized === 'timeout') return 'انتهى الوقت';
      if (normalized === 'checkmate') return 'كش مات';
      if (normalized === 'resign') return 'استسلام';
      if (normalized === 'draw') return 'تعادل';
      if (normalized === 'stalemate') return 'تعادل (جمود)';
      if (normalized === 'threefold_repetition') return 'تعادل (تكرار النقلات)';
      if (normalized === 'insufficient_material') return 'تعادل (قطع غير كافية)';
      return 'انتهت المباراة';
    };
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      winner: winner
    }));
    
    // Show timeout notification
    toast({
      title: "انتهت المباراة",
      description: getArabicTimeoutReason(reason) || `فاز ${winner === currentPlayer ? 'أنت' : 'الخصم'} بالوقت`,
    });
    
    // Stop timers
    setTimers(prev => ({
      ...prev,
      isRunning: false
    }));
    setStartCountdown(null);
    clearStartCountdownInterval();

    // Show game end modal
    showGameEndModal('timeout', winner);
  }, [currentPlayer, showGameEndModal, clearStartCountdownInterval]);

  const handleMoveConfirmed = useCallback((data: { gameId: string; move: string }) => {
    

    // Reset processing state to allow new moves
    setIsProcessingMove(false);
  }, []);

  const handleIncomingGameChat = useCallback((data: any) => {
    const incomingId = String(data?.id || '');
    if (!incomingId) return;

    let isNewMessage = false;
    setChatMessages((prev) => {
      if (prev.some((msg) => String(msg.id) === incomingId)) {
        return prev;
      }
      isNewMessage = true;
      return [
        ...prev,
        {
          id: data.id,
          userId: data.userId,
          username: data.username || 'مستخدم',
          thumbnail: data.thumbnail || null,
          message: data.message || '',
          type: 'text',
          timestamp: data.createdAt || new Date().toISOString(),
        },
      ];
    });

    const incomingUserId = Number(data?.userId);
    const isFromOtherUser =
      Number.isFinite(incomingUserId) &&
      incomingUserId !== Number(currentUserNumericId);

    if (isNewMessage && isFromOtherUser && isMobileDevice() && !isMobileChatModalOpen) {
      setUnreadChatCount((prev) => prev + 1);
    }
  }, [currentUserNumericId, isMobileChatModalOpen, isMobileDevice]);

  useEffect(() => {
    if (isMobileChatModalOpen) {
      setUnreadChatCount(0);
    }
  }, [isMobileChatModalOpen]);

  // WebSocket events for real-time updates
  useEffect(() => {
    if (!user || !token) return;

    const gameId = getValidGameIdFromUrl();
    if (!gameId) {
      setError('Invalid or missing game ID in URL');
      return;
    }

    socketService.connect(token);
    const removeConnectionCallback = socketService.setConnectionCallback(setIsConnected);

    socketService.onClockUpdate(handleClockUpdate);
    socketService.onTurnUpdate(handleTurnUpdate);
    socketService.onMoveMade(handleOpponentMove);
    socketService.onGameTimeout(handleGameTimeout);
    socketService.onGameEnd(handleGameEnd);
    socketService.onMoveConfirmed(handleMoveConfirmed);
    socketService.onGameChatMessage(handleIncomingGameChat);

    socketService.joinGameRoom(gameId);

    return () => {
      socketService.leaveGameRoom(gameId);
      socketService.offClockUpdate();
      socketService.offTurnUpdate();
      socketService.offMoveMade();
      socketService.offGameTimeout();
      socketService.offGameEnd();
      socketService.offMoveConfirmed();
      socketService.offGameChatMessage();
      removeConnectionCallback();
    };
  }, [
    user,
    token,
    handleClockUpdate,
    handleTurnUpdate,
    handleOpponentMove,
    handleGameTimeout,
    handleGameEnd,
    handleMoveConfirmed,
    handleIncomingGameChat,
    getValidGameIdFromUrl,
  ]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    if (isSpectatorMode || !isCurrentUserPlayer) {
      toast({
        title: "وضع المشاهدة المباشرة",
        description: "لا يمكن تحريك القطع أثناء المشاهدة",
        variant: "destructive"
      });
      return false;
    }
    
    // Check if it's player's turn
    if (gameState.currentTurn !== currentPlayer) {
      toast({
        title: "ليس دورك",
        description: "انتظر دورك في اللعب",
        variant: "destructive"
      });
      return false;
    }

    // Check if already processing a move
    if (isProcessingMove) {
      return false;
    }

    // التحقق من أن اللعبة نشطة
    if (gameState.status !== 'active') {
      toast({
        title: "اللعبة منتهية",
        description: "لا يمكن إجراء حركة في لعبة منتهية",
        variant: "destructive"
      });
      return false;
    }

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from,
        to,
        promotion: promotion || 'q'
      });

      if (move) {
        // Set processing state to prevent duplicate moves
        setIsProcessingMove(true);
        
        // Update local game state
        setGame(gameCopy);
        
        // Update timers to switch active timer
        setTimers(prev => ({
          ...prev,
          lastUpdate: Date.now() // Reset timer to prevent double counting
        }));
        
        setMoves(prev => appendMoveWithDedup(prev, currentPlayer, move.san, gameCopy.fen()));

        // Update local game state (turn will be updated by server)
        setGameState(prev => ({
          ...prev,
          currentTurn: currentPlayer === 'white' ? 'black' : 'white', // Switch turn immediately
          isCheck: gameCopy.inCheck(),
          isCheckmate: gameCopy.isCheckmate(),
          isDraw: gameCopy.isDraw()
        }));

        const isCaptureMove = typeof move.san === 'string' && move.san.includes('x');
        if (gameCopy.isCheckmate() || gameCopy.inCheck()) {
          playSoundEffect('check');
        } else if (isCaptureMove) {
          playSoundEffect('capture');
        } else {
          playSoundEffect('move');
        }

        // Send move to server via WebSocket
        const gameId = getValidGameIdFromUrl();
        if (!gameId) {
          toast({
            title: "معرف مباراة غير صالح",
            description: "لا يمكن إرسال الحركة بدون معرف مباراة صالح",
            variant: "destructive"
          });
          setIsProcessingMove(false);
          return false;
        }
        
        const moveData = {
          gameId,
          from,
          to,
          promotion: promotion || 'q',
          san: move.san,
          fen: gameCopy.fen(),
          movedBy: currentPlayer,
          currentTurn: currentPlayer === 'white' ? 'black' : 'white' // Use new turn value
        };
        
        socketService.sendMove(moveData);

        // Check for game end conditions
        if (gameCopy.isCheckmate()) {
          handleGameEnd({ reason: 'checkmate', winner: currentPlayer === 'white' ? 'black' : 'white' });
          return true;
        } else if (gameCopy.isDraw()) {
          handleGameEnd({ reason: 'draw' });
          return true;
        } else if (gameCopy.isStalemate()) {
          handleGameEnd({ reason: 'stalemate' });
          return true;
        } else if (gameCopy.isThreefoldRepetition()) {
          handleGameEnd({ reason: 'threefold_repetition' });
          return true;
        } else if (gameCopy.isInsufficientMaterial()) {
          handleGameEnd({ reason: 'insufficient_material' });
          return true;
        }

        return true;
      }
    } catch (error) {
      // Reset processing state on error
      setIsProcessingMove(false);
      toast({
        title: "حركة غير صحيحة",
        description: "يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    }

    return false;
  }, [game, gameState.currentTurn, gameState.status, currentPlayer, isProcessingMove, handleGameEnd, getValidGameIdFromUrl, playSoundEffect, toast, isSpectatorMode, isCurrentUserPlayer]);

  const handleResign = () => {
    setShowResignConfirmModal(true);
  };

  const confirmResign = async () => {
    const gameId = gameState.id || getValidGameIdFromUrl();
    if (!gameId) {
      toast({
        title: 'خطأ',
        description: 'لا يمكن تنفيذ الاستسلام بدون معرف مباراة صالح',
        variant: 'destructive',
      });
      return;
    }

    try {
      const socketAck = await socketService.sendResign(gameId);

      if (!socketAck.success) {
        await api.post(`/api/game/${gameId}/resign`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر تنفيذ الاستسلام حالياً. حاول مرة أخرى.';
      toast({
        title: 'فشل الاستسلام',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    setShowResignConfirmModal(false);
  };

  const cancelResign = () => {
    setShowResignConfirmModal(false);
  };

  const handleOfferDraw = () => {
    // REST: POST /api/games/:id/offer-draw
    // SOCKET: socket.emit('offerDraw', { gameId: gameState.id });
    
    toast({
      title: "تم إرسال عرض التعادل",
      description: "في انتظار رد الخصم",
    });
  };

  const handleDrawResponse = (accept: boolean) => {
    // REST: POST /api/games/:id/draw-response
    // SOCKET: socket.emit('drawResponse', { gameId: gameState.id, accept });
    
    if (accept) {
      handleGameEnd({ reason: 'draw' });
    }
  };

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    if (isSpectatorMode || !isCurrentUserPlayer) {
      toast({
        title: 'وضع المشاهدة المباشرة',
        description: 'لا يمكنك إرسال رسائل في وضع المشاهدة',
        variant: 'destructive',
      });
      return;
    }

    const gameId = getValidGameIdFromUrl();
    if (!gameId) return;

    setChatInput('');

    const socketAck = await socketService.sendGameChatMessage({
      gameId,
      message: trimmed,
    });

    if (socketAck.success) {
      return;
    }

    try {
      const response = await api.post(`/api/game/${gameId}/chat`, { message: trimmed });
      const msg = response?.data?.data;
      if (response?.data?.success && msg) {
        setChatMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(msg.id))) {
            return prev;
          }
          return [
            ...prev,
            {
              id: msg.id,
              userId: msg.userId,
              username: msg.username || 'مستخدم',
              thumbnail: msg.thumbnail || null,
              message: msg.message || trimmed,
              type: 'text',
              timestamp: msg.createdAt || new Date().toISOString(),
            },
          ];
        });
      }
    } catch (error) {
      toast({
        title: 'فشل إرسال الرسالة',
        description: error instanceof Error ? error.message : 'تعذر إرسال الرسالة حالياً',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
    return formatted;
  };

  // دالة لتحديد المؤقت الصحيح حسب اللاعب
  const getPlayerTimer = (playerColor: 'white' | 'black') => {
    // حساب الوقت المتبقي بناءً على الوقت المنقضي منذ آخر تحديث
    const now = Date.now();
    const timeSinceUpdate = (now - timers.lastUpdate) / 1000; // بالثواني
    
    let whiteRemaining = Math.max(0, Math.floor(timers.white - (gameState.currentTurn === 'white' && timers.isRunning ? timeSinceUpdate : 0)));
    let blackRemaining = Math.max(0, Math.floor(timers.black - (gameState.currentTurn === 'black' && timers.isRunning ? timeSinceUpdate : 0)));
    
    let result;
    if (currentPlayer === 'white') {
      // اللاعب الأبيض يرى المؤقتات كما هي
      result = playerColor === 'white' ? whiteRemaining : blackRemaining;
    } else {
      // اللاعب الأسود يرى المؤقتات معكوسة
      result = playerColor === 'white' ? blackRemaining : whiteRemaining;
    }
    
    return result;
  };

  // دالة لتحديد الدور الصحيح حسب اللاعب
  const getPlayerTurn = (playerColor: 'white' | 'black') => {
    if (currentPlayer === 'white') {
      // اللاعب الأبيض يرى الدور كما هو
      return gameState.currentTurn === playerColor;
    } else {
      // اللاعب الأسود يرى الدور معكوس
      return gameState.currentTurn === (playerColor === 'white' ? 'black' : 'white');
    }
  };

  // عرض حالة التحميل
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات اللعبة...</p>
        </div>
      </div>
    );
  }

  // عرض الخطأ
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const formatMoveTime = (timestamp: Date | string) => {
    const dateValue = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const formatted = dateValue.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return formatted;
  };

  return (
    <div className="min-h-screen bg-background" ref={gamePageRef}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="رجوع"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-amiri text-xl font-bold">شطرنج العرب</h1>
              <Badge variant={isConnected ? "secondary" : "destructive"} className="flex items-center gap-1">
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'متصل' : 'منقطع'}
              </Badge>
              {isPhysicalMove && (
                <Badge variant="outline" className="bg-primary/10 text-primary animate-pulse">
                  <Crown className="w-3 h-3 ml-1" />
                  لوحة مادية
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isMobileDevice() && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => showDrawingGuide(true)}
                  aria-label="شرح الرسم"
                  title="شرح الرسم"
                >
                  <CircleHelp className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                aria-label={isSoundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
              >
                {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              {isMobileDevice() && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileChatModalOpen(true)}
                  aria-label="فتح المحادثة"
                  className="relative md:hidden"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-5 text-center font-semibold">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                className="hidden md:inline-flex"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Players & Game Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Mobile Compact Header */}
            <Card className="md:hidden">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2" dir="rtl">
                  <div className="min-w-0 flex-1 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="flex items-center justify-start gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={players.black.thumbnail || ''} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                          {players.black.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{players.black.name}</span>
                    </div>
                    <div className={`mt-1 text-right text-sm font-mono ${getPlayerTurn('black') ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {formatTime(getPlayerTimer('black'))}
                    </div>
                  </div>

                  <Badge
                    variant={
                      isGameEndedForUi
                        ? 'destructive'
                        : isSpectatorMode || !isCurrentUserPlayer
                          ? 'secondary'
                          : gameState.currentTurn === currentPlayer
                            ? 'default'
                            : 'outline'
                    }
                    className="shrink-0"
                  >
                    {isGameEndedForUi
                      ? 'المباراة منتهية'
                      : isSpectatorMode || !isCurrentUserPlayer
                        ? 'مشاهدة مباشرة'
                        : gameState.currentTurn === currentPlayer
                          ? 'دورك'
                          : 'دور الخصم'}
                  </Badge>

                  <div className="min-w-0 flex-1 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="flex items-center justify-start gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={players.white.thumbnail || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {players.white.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{players.white.name}</span>
                    </div>
                    <div className={`mt-1 text-right text-sm font-mono ${getPlayerTurn('white') ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {formatTime(getPlayerTimer('white'))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Black Player */}
            <Card className="hidden md:block">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                                     <Avatar>
                     <AvatarImage src={players.black.thumbnail || ''} />
                     <AvatarFallback className="bg-secondary text-secondary-foreground">
                       {players.black.name.charAt(0)}
                     </AvatarFallback>
                   </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{players.black.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {players.black.rank}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold text-primary">
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(getPlayerTimer('black'))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Game Status */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri">حالة المباراة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gameState.isCheck && (
                  <div className="flex items-center gap-2 text-destructive">
                    <RotateCcw className="w-4 h-4" />
                    <span className="font-medium">كش!</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span>عدد النقلات:</span>
                  <span>{game.history().length}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>حالة اللعبة:</span>
                  <Badge variant="secondary">
                    {gameState.status === 'active' ? 'نشطة' : 'منتهية'}
                  </Badge>
                </div>

                <div className="flex justify-between text-sm">
                  <span>دور اللعب الآن:</span>
                  <Badge
                    variant={
                      isGameEndedForUi
                        ? 'destructive'
                        : isSpectatorMode || !isCurrentUserPlayer
                          ? 'secondary'
                          : gameState.currentTurn === currentPlayer
                            ? 'default'
                            : 'outline'
                    }
                  >
                    {isGameEndedForUi
                      ? 'المباراة منتهية'
                      : isSpectatorMode || !isCurrentUserPlayer
                        ? 'مشاهدة مباشرة'
                        : gameState.currentTurn === currentPlayer
                          ? 'دورك'
                          : 'دور الخصم'}
                  </Badge>
                </div>

                {gameData && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>طريقة اللعب الأبيض:</span>
                      <Badge variant="outline">
                        {gameData.whitePlayMethod === 'phone' ? 'هاتف' : 'لوحة مادية'}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>طريقة اللعب الأسود:</span>
                      <Badge variant="outline">
                        {gameData.blackPlayMethod === 'phone' ? 'هاتف' : 'لوحة مادية'}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* White Player */}
            <Card className="hidden md:block">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                                     <Avatar>
                     <AvatarImage src={players.white.thumbnail || ''} />
                     <AvatarFallback className="bg-primary text-primary-foreground">
                       {players.white.name.charAt(0)}
                     </AvatarFallback>
                   </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{players.white.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {players.white.rank}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold text-primary">
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(getPlayerTimer('white'))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Game Controls */}
            <div className="space-y-2 hidden md:block">
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={handleResign}
                disabled={gameState.status !== 'active' || isSpectatorMode || !isCurrentUserPlayer}
              >
                <Flag className="w-4 h-4 ml-2" />
                استسلام
              </Button>
            </div>
          </div>

          {/* Chess Board */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <ChessBoard
                game={game}
                onMove={handleMove}
                orientation={isCurrentUserPlayer ? currentPlayer : 'white'}
                allowMoves={
                  !isSpectatorMode &&
                  isCurrentUserPlayer &&
                  startCountdown === null &&
                  gameState.status === 'active' &&
                  gameState.currentTurn === currentPlayer &&
                  !isProcessingMove
                }
                resultSticker={boardResultSticker}
              />
            </Card>

            {/* Mobile Secondary Info */}
            <Card className="mt-4 md:hidden">
              <CardContent className="p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع المباراة</span>
                  <Badge variant="outline">
                    {gameData?.gameType === 'friend' ? 'لعبة مع صديق' :
                     gameData?.gameType === 'ranked' ? 'لعبة مصنفة' :
                     gameData?.gameType === 'ai' ? 'لعبة ضد الذكاء الاصطناعي' :
                     gameData?.gameType === 'puzzle' ? 'لغز شطرنج' : 'لعبة شطرنج'}
                  </Badge>
                </div>
                {gameData?.startedByUser?.name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">بدأت بواسطة</span>
                    <span>{gameData.startedByUser.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد النقلات</span>
                  <span>{game.history().length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">حالة اللعبة</span>
                  <Badge variant="secondary">
                    {gameState.status === 'active' ? 'نشطة' : 'منتهية'}
                  </Badge>
                </div>
                {gameData && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">طريقة الأبيض</span>
                      <Badge variant="outline">
                        {gameData.whitePlayMethod === 'phone' ? 'هاتف' : 'لوحة مادية'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">طريقة الأسود</span>
                      <Badge variant="outline">
                        {gameData.blackPlayMethod === 'phone' ? 'هاتف' : 'لوحة مادية'}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="mt-4 md:hidden">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleResign}
                disabled={gameState.status !== 'active' || isSpectatorMode || !isCurrentUserPlayer}
              >
                <Flag className="w-4 h-4 ml-2" />
                استسلام
              </Button>
            </div>
          </div>

          {/* Moves & Chat */}
          <div className="lg:col-span-1 space-y-4">
            {/* Moves List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri">النقلات</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48" dir="rtl">
                  <div className="space-y-1 text-right">
                    {moves.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        لا توجد نقلات بعد
                      </div>
                    ) : (
                      moves.map((move, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/50 border border-transparent hover:border-border">
                          <span className="text-muted-foreground w-8 text-right text-xs font-mono">{move.moveNumber}.</span>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-muted-foreground">أبيض:</span>
                              {move.white ? (
                                <span className="font-mono text-sm bg-primary/10 px-2 py-1 rounded">
                                  {move.white}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-muted-foreground">أسود:</span>
                              {move.black ? (
                                <span className="font-mono text-sm bg-secondary/10 px-2 py-1 rounded">
                                  {move.black}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri">المحادثة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea dir="rtl" className="h-64 px-3 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[length:16px_16px]">
                  <div className="space-y-2 py-3">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${Number(msg.userId) === Number(currentUserNumericId) ? 'justify-start' : 'justify-end'}`}
                      >
                        {msg.type !== 'system' ? (
                          <div
                            className={`max-w-[84%] rounded-2xl px-3 py-2 shadow-sm text-right ${
                              Number(msg.userId) === Number(currentUserNumericId)
                                ? 'bg-emerald-600 text-white rounded-br-md'
                                : 'bg-slate-700 text-slate-100 rounded-bl-md'
                            }`}
                          >
                            <div className="text-sm leading-relaxed break-words">{msg.message}</div>
                            <div className="text-[10px] opacity-70 mt-1 text-right">
                              {formatMoveTime(msg.timestamp)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground text-xs bg-muted/60 rounded px-3 py-1">
                            {msg.message}
                          </div>
                        )}
                      </div>
                    ))}
                    {chatMessages.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        لا توجد رسائل بعد
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                
                <Separator className="my-2" />
                
                <div className="px-3 pb-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder={isSpectatorMode || !isCurrentUserPlayer ? 'وضع مشاهدة فقط' : 'اكتب رسالة...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleSendMessage()}
                      className="text-right"
                      disabled={isSpectatorMode || !isCurrentUserPlayer}
                    />
                    <Button
                      size="icon"
                      onClick={() => void handleSendMessage()}
                      disabled={isSpectatorMode || !isCurrentUserPlayer || !chatInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isMobileChatModalOpen} onOpenChange={setIsMobileChatModalOpen}>
        <DialogContent className="w-[96vw] max-w-[96vw] p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4 pb-1">
            <DialogTitle className="font-amiri text-lg">المحادثة</DialogTitle>
          </DialogHeader>
          <div className="px-3 pb-3">
            <ScrollArea dir="rtl" className="h-[56vh] px-2 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[length:16px_16px] rounded-md">
              <div className="space-y-2 py-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${Number(msg.userId) === Number(currentUserNumericId) ? 'justify-start' : 'justify-end'}`}
                  >
                    {msg.type !== 'system' ? (
                      <div
                        className={`max-w-[84%] rounded-2xl px-3 py-2 shadow-sm text-right ${
                          Number(msg.userId) === Number(currentUserNumericId)
                            ? 'bg-emerald-600 text-white rounded-br-md'
                            : 'bg-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <div className="text-sm leading-relaxed break-words">{msg.message}</div>
                        <div className="text-[10px] opacity-70 mt-1 text-right">
                          {formatMoveTime(msg.timestamp)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs bg-muted/60 rounded px-3 py-1">
                        {msg.message}
                      </div>
                    )}
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    لا توجد رسائل بعد
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <Separator className="my-2" />

            <div className="flex gap-2">
              <Input
                placeholder={isSpectatorMode || !isCurrentUserPlayer ? 'وضع مشاهدة فقط' : 'اكتب رسالة...'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSendMessage()}
                className="text-right text-[16px]"
                style={{ fontSize: 16 }}
                disabled={isSpectatorMode || !isCurrentUserPlayer}
              />
              <Button
                size="icon"
                onClick={() => void handleSendMessage()}
                disabled={isSpectatorMode || !isCurrentUserPlayer || !chatInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {startCountdown !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-[11rem] leading-none font-black text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.5)]">
              {startCountdown}
            </div>
          </div>
        </div>
      )}

      {/* Game End Modal */}
      {showGameEndModalState && gameEndData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                {gameEndData.reason === 'checkmate' && (
                  <div className="text-4xl mb-2">👑</div>
                )}
                {gameEndData.reason === 'timeout' && (
                  <div className="text-4xl mb-2">⏰</div>
                )}
                {gameEndData.reason === 'draw' && (
                  <div className="text-4xl mb-2">🤝</div>
                )}
                {gameEndData.reason === 'resign' && (
                  <div className="text-4xl mb-2">🏳️</div>
                )}
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                {gameEndData.reason === 'checkmate' && 'كش مات!'}
                {gameEndData.reason === 'timeout' && 'انتهى الوقت!'}
                {gameEndData.reason === 'draw' && 'تعادل!'}
                {gameEndData.reason === 'resign' && 'استسلام!'}
                {gameEndData.reason === 'stalemate' && 'تعادل!'}
                {gameEndData.reason === 'threefold_repetition' && 'تعادل!'}
                {gameEndData.reason === 'insufficient_material' && 'تعادل!'}
              </h2>
              
              <p className="text-muted-foreground mb-6">
                {gameEndData.reason === 'checkmate' && (gameEndData.winner === currentPlayer ? 'مبروك! فزت بالمباراة' : 'للأسف، خسرت المباراة')}
                {gameEndData.reason === 'timeout' && `فاز ${gameEndData.winner === currentPlayer ? 'أنت' : 'الخصم'} بالوقت`}
                {gameEndData.reason === 'draw' && 'انتهت المباراة بالتعادل'}
                {gameEndData.reason === 'resign' && (gameEndData.winner === currentPlayer ? 'فزت بالاستسلام' : 'خسرت بالاستسلام')}
                {gameEndData.reason === 'stalemate' && 'انتهت المباراة بالتعادل (جمود)'}
                {gameEndData.reason === 'threefold_repetition' && 'انتهت المباراة بالتعادل (تكرار الحركة)'}
                {gameEndData.reason === 'insufficient_material' && 'انتهت المباراة بالتعادل (قطع غير كافية)'}
              </p>

              {typeof gameEndData.ratingDelta === 'number' && gameEndData.ratingDelta !== 0 && (
                <div className={`mb-4 text-2xl font-bold ${gameEndData.ratingDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {gameEndData.ratingDelta > 0 ? `+${gameEndData.ratingDelta}` : gameEndData.ratingDelta} نقطة تقييم
                  {gameEndData.isPlacement ? ' (Placement)' : ''}
                </div>
              )}
              
              {/* معلومات إضافية عن اللعبة */}
              <div className="bg-muted/50 p-4 rounded-lg mb-6 text-sm">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="font-semibold text-primary">عدد النقلات</p>
                    <p className="text-2xl font-bold">{moves.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-primary">مدة اللعبة</p>
                    <p className="text-2xl font-bold">
                      {gameData?.duration || 'جاري التحميل...'}
                    </p>
                  </div>
                </div>
                
                {gameData && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">اللاعب الأبيض:</span>
                      <span className="font-semibold">{gameData.whitePlayer?.name || 'غير معروف'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">اللاعب الأسود:</span>
                      <span className="font-semibold">{gameData.blackPlayer?.name || 'غير معروف'}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                {gameData?.gameType === 'ranked' && quickMatchOpponent && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleQuickRematch}
                      className="flex-1"
                    >
                      إعادة اللعب
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAddOpponentAsFriend}
                      className="flex-1"
                    >
                      إضافة صديق
                    </Button>
                  </>
                )}
                <Button 
                  onClick={goToDashboard}
                  className="flex-1"
                >
                  العودة إلى لوحة التحكم
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowGameEndModalState(false)}
                  className="flex-1"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {showResignConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4 text-center">
            <div className="text-center">
              <div className="mb-4">
                <Flag className="w-12 h-12 text-destructive mx-auto" />
              </div>
              <h2 className="text-2xl font-bold mb-2">تأكيد الاستسلام</h2>
              <p className="text-muted-foreground mb-6">
                هل أنت متأكد من الاستسلام؟ سيتم إعلام الخصم وإغلاق المباراة.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={cancelResign}>
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={confirmResign}>
                  تأكيد الاستسلام
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;



