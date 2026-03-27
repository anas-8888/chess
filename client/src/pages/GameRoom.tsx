import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  ArrowRight,
  CircleHelp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/services/socketService';

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
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  type: 'text' | 'emoji' | 'system';
  timestamp: Date;
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
        isRunning: true,
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
        isRunning: true,
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
    isRunning: true,
    lastUpdate: Date.now()
  });

  // Update timers display when timers state changes
  useEffect(() => {
  }, [timers, gameState, currentPlayer]);

  // Timer countdown effect
  useEffect(() => {
    if (!timers.isRunning) return;

    const interval = setInterval(() => {
      setTimers(prev => {
        const now = Date.now();
        const timeDiff = (now - prev.lastUpdate) / 1000; // Convert to seconds
        
        let newWhiteTime = prev.white;
        let newBlackTime = prev.black;
        
        // Only decrease time for the current player
        if (gameState.currentTurn === 'white') {
          newWhiteTime = Math.max(0, Math.floor(prev.white - timeDiff));
        } else if (gameState.currentTurn === 'black') {
          newBlackTime = Math.max(0, Math.floor(prev.black - timeDiff));
        }
        
        // Check for timeout
        if (newWhiteTime <= 0 || newBlackTime <= 0) {
          const timeoutPlayer = newWhiteTime <= 0 ? 'white' : 'black';
          const winner = timeoutPlayer === 'white' ? 'black' : 'white';
          
          // معالجة انتهاء الوقت
          handleGameEnd({ 
            reason: 'timeout', 
            winner: winner 
          });
          
          // Stop the timer
          return {
            ...prev,
            white: newWhiteTime,
            black: newBlackTime,
            isRunning: false,
            lastUpdate: now
          };
        }
        
        return {
          ...prev,
          white: newWhiteTime,
          black: newBlackTime,
          lastUpdate: now
        };
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [timers.isRunning, gameState.currentTurn]);

  const [moves, setMoves] = useState<GameMove[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      userId: 'system',
      username: 'النظام',
      message: 'بدأت المباراة! حظاً موفقاً للاعبين',
      type: 'system',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isPhysicalMove, setIsPhysicalMove] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [showGameEndModalState, setShowGameEndModalState] = useState(false);
  const [gameEndData, setGameEndData] = useState<{ reason: string; winner?: string } | null>(null);
  const [showResignConfirmModal, setShowResignConfirmModal] = useState(false);
  const gamePageRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  const { toast } = useToast();
  const DRAWING_GUIDE_STORAGE_KEY = 'drawing_guide_friend_v1';

  const isMobileDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }, []);

  const showDrawingGuide = useCallback((force = false) => {
    if (typeof window === 'undefined') return;
    if (!force && localStorage.getItem(DRAWING_GUIDE_STORAGE_KEY) === '1') return;

    const mobile = isMobileDevice();
    const description = mobile
      ? 'اضغط مطوّلًا ثم اسحب لرسم سهم، واضغط مطوّلًا دون سحب لتحديد مربع. يمكن رسم عدة أسهم، وإزالتها بإعادة الضغط. هذه الرسومات للتوضيح فقط ولا تؤثر على اللعب.'
      : 'استخدم زر الفأرة الأيمن: سحب لرسم سهم، ونقرة واحدة لتحديد مربع. يمكنك رسم عدة أسهم وإزالتها بالنقر مرة أخرى. هذه الرسومات للتوضيح فقط ولا تؤثر على اللعب.';

    toast({
      title: 'دليل الرسم التوضيحي',
      description,
    });

    if (!force) {
      localStorage.setItem(DRAWING_GUIDE_STORAGE_KEY, '1');
    }
  }, [isMobileDevice, toast]);

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

  // دالة لعرض مودال انتهاء اللعبة
  const boardResultSticker = React.useMemo<'win' | 'loss' | 'draw' | null>(() => {
    if (gameState.status !== 'finished') return null;

    const winnerFromEnd = gameEndData?.winner;
    const winnerFromState = (gameState as any).winner as string | null | undefined;
    const winner = winnerFromEnd || winnerFromState;

    if (!winner) return 'draw';
    return winner === currentPlayer ? 'win' : 'loss';
  }, [gameState.status, gameEndData?.winner, currentPlayer, gameState]);
  const showGameEndModal = useCallback((reason: string, winner?: string) => {
    setGameEndData({ reason, winner });
    setShowGameEndModalState(true);
  }, []);

  // دالة للعودة إلى dashboard
  const goToDashboard = useCallback(() => {
    window.location.href = '/dashboard';
  }, []);

    // جلب بيانات اللعبة من الـ API
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // الحصول على معرف اللعبة من الـ URL
        const gameId = getValidGameIdFromUrl();
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
            isRunning: true,
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

  // Handler functions using useCallback to maintain stable references
  const handleClockUpdate = useCallback((data: { whiteTimeLeft: number; blackTimeLeft: number; currentTurn: string }) => {
                    const { whiteTimeLeft, blackTimeLeft, currentTurn } = data;
                    
                    // Validate data
                    if (typeof whiteTimeLeft !== 'number' || typeof blackTimeLeft !== 'number') {
                      console.error('Invalid time data received:', data);
                      return;
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
    
  }, []); // Remove timers dependency

  const handleTurnUpdate = useCallback((data: { currentTurn: string }) => {
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
  }, []);

  const handleGameEnd = useCallback((data: { reason: string; winner?: string; winnerId?: number; loserId?: number }) => {
    
    const { reason, winner, winnerId, loserId } = data;
    
    
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

    // Show game end modal
    showGameEndModal(reason, winner);
    
  }, [currentPlayer, showGameEndModal]);

  const handleOpponentMove = useCallback((data: any) => {
    
    const { move: san, fen, movedBy, currentTurn, isPhysical = false } = data;
    
    // Ignore moves from current player
    if (movedBy === currentPlayer) {
      return;
    }
    
    
    // Handle physical move notification
    if (isPhysical) {
      setIsPhysicalMove(true);
      toast({
        title: "حركة من اللوحة المادية",
        description: "تم تحريك القطعة على اللوحة الفعلية",
      });
      setTimeout(() => setIsPhysicalMove(false), 3000);
    }

    // Update game with new FEN
    if (game && fen) {
      game.load(fen);
      setGame(game);
    }

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
  }, [currentPlayer, handleGameEnd, playSoundEffect]);

  const handleGameTimeout = useCallback((data: { winner: string; reason?: string }) => {
    
    const { winner, reason } = data;
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      winner: winner
    }));
    
    // Show timeout notification
    toast({
      title: "انتهت المباراة",
      description: reason || `فاز ${winner === currentPlayer ? 'أنت' : 'الخصم'} بالوقت`,
    });
    
    // Stop timers
    setTimers(prev => ({
      ...prev,
      isRunning: false
    }));

    // Show game end modal
    showGameEndModal('timeout', winner);
  }, [currentPlayer, showGameEndModal]);

  const handleMoveConfirmed = useCallback((data: { gameId: string; move: string }) => {
    

    // Reset processing state to allow new moves
    setIsProcessingMove(false);
  }, []);

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

    socketService.joinGameRoom(gameId);

    return () => {
      socketService.leaveGameRoom(gameId);
      socketService.offClockUpdate();
      socketService.offTurnUpdate();
      socketService.offMoveMade();
      socketService.offGameTimeout();
      socketService.offGameEnd();
      socketService.offMoveConfirmed();
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
    getValidGameIdFromUrl,
  ]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    
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
  }, [game, gameState.currentTurn, gameState.status, currentPlayer, isProcessingMove, handleGameEnd, getValidGameIdFromUrl, playSoundEffect, toast]);

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

  const handleSendMessage = () => {
    if (!chatInput.trim() || !players[currentPlayer]) return;


    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: players[currentPlayer]?.id?.toString() || 'unknown',
      username: players[currentPlayer]?.name || 'Unknown',
      message: chatInput,
      type: 'text',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, message]);
    setChatInput('');

    // REST: POST /api/games/:id/chat
    // SOCKET: socket.emit('chatMessage', {
    //   gameId: gameState.id,
    //   message: chatInput
    // });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
    return formatted;
  };

  // دالة لتحديد المؤقت الصحيح حسب اللاعب
  const getPlayerTimer = (playerColor: 'white' | 'black') => {
    
    let result;
    if (currentPlayer === 'white') {
      // اللاعب الأبيض يرى المؤقتات كما هي
      result = playerColor === 'white' ? timers.white : timers.black;
    } else {
      // اللاعب الأسود يرى المؤقتات معكوسة
      result = playerColor === 'white' ? timers.black : timers.white;
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

  const formatMoveTime = (timestamp: Date) => {
    const formatted = timestamp.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return formatted;
  };

  return (
    <div className="min-h-screen bg-background" ref={gamePageRef}>
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="رجوع"
                onClick={() => window.history.back()}
              >
                <ArrowRight className="w-5 h-5" />
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => showDrawingGuide(true)}
                aria-label="شرح الرسم"
                title="شرح الرسم"
              >
                <CircleHelp className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                aria-label={isSoundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
              >
                {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
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
                <div className="flex items-center justify-between gap-2 [direction:ltr]">
                  <div className="min-w-0 flex-1 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={players.black.thumbnail || ''} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                          {players.black.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{players.black.name}</span>
                    </div>
                    <div className={`mt-1 text-sm font-mono ${getPlayerTurn('black') ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {formatTime(getPlayerTimer('black'))}
                    </div>
                  </div>

                  <Badge variant={gameState.currentTurn === currentPlayer ? 'default' : 'outline'} className="shrink-0">
                    {gameState.currentTurn === currentPlayer ? 'دورك' : 'دور الخصم'}
                  </Badge>

                  <div className="min-w-0 flex-1 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={players.white.thumbnail || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {players.white.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{players.white.name}</span>
                    </div>
                    <div className={`mt-1 text-sm font-mono ${getPlayerTurn('white') ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
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
                  <Badge variant={gameState.currentTurn === currentPlayer ? 'default' : 'outline'}>
                    {gameState.currentTurn === currentPlayer ? 'دورك' : 'دور الخصم'}
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
                disabled={gameState.status !== 'active' ? true : false}
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
                orientation={currentPlayer}
                allowMoves={gameState.status === 'active' && gameState.currentTurn === currentPlayer && !isProcessingMove}
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
                disabled={gameState.status !== 'active'}
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
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {moves.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        لا توجد نقلات بعد
                      </div>
                    ) : (
                      moves.map((move, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/50 border border-transparent hover:border-border">
                          <span className="text-muted-foreground w-8 text-xs font-mono">{move.moveNumber}.</span>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">أبيض:</span>
                              {move.white ? (
                                <span className="font-mono text-sm bg-primary/10 px-2 py-1 rounded">
                                  {move.white}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri">المحادثة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64 px-4">
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`${
                        msg.type === 'system' 
                          ? 'text-center text-muted-foreground text-sm bg-muted/50 rounded p-2' 
                          : msg.userId === players[currentPlayer].id.toString() 
                            ? 'text-right' 
                            : 'text-left'
                      }`}>
                        {msg.type !== 'system' && (
                          <div className="text-xs text-muted-foreground mb-1">
                            {msg.username} • {formatMoveTime(msg.timestamp)}
                          </div>
                        )}
                        <div className={`${
                          msg.type !== 'system' 
                            ? msg.userId === players[currentPlayer].id.toString() 
                              ? 'bg-primary text-primary-foreground p-2 rounded-r-lg rounded-bl-lg inline-block max-w-[80%]'
                              : 'bg-muted p-2 rounded-l-lg rounded-br-lg inline-block max-w-[80%]'
                            : ''
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <Separator className="my-3" />
                
                <div className="px-4 pb-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="اكتب رسالة..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="text-right"
                    />
                    <Button size="icon" onClick={handleSendMessage}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <Flag className="w-12 h-12 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-2">تأكيد الاستسلام</h2>
              <p className="text-muted-foreground mb-6">
                هل أنت متأكد من الاستسلام؟ سيتم إعلام الخصم وإغلاق المباراة.
              </p>
              <div className="flex gap-2">
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



