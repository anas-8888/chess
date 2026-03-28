import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess, Square, Move } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Flag, 
  RotateCcw,
  Crown,
  User,
  Trophy,
  RefreshCw,
  ArrowRight,
  CircleHelp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getInitialsFromName, hasCustomAvatar } from '@/utils/avatar';
import { ActiveAiGameSession, GameMovePair, userService } from '@/services/userService';

interface GameMove {
  moveNumber: number;
  white?: string;
  black?: string;
  san: string;
  fen: string;
}

interface AIPlayer {
  name: string;
  rating: number;
  color: 'white' | 'black';
  avatar: string;
}

interface ApiConflictError extends Error {
  status?: number;
  code?: string;
  data?: {
    existingGameId?: number;
    gameId?: number;
  };
}

type AIDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const AI_DIFFICULTY_CONFIG: Record<
  AIDifficulty,
  {
    label: string;
    rating: number;
    skillLevel: number;
    depth: number;
    moveTimeMs: number;
  }
> = {
  easy: { label: 'سهل', rating: 900, skillLevel: 2, depth: 5, moveTimeMs: 250 },
  medium: { label: 'متوسط', rating: 1500, skillLevel: 10, depth: 10, moveTimeMs: 900 },
  hard: { label: 'عالي', rating: 2300, skillLevel: 20, depth: 22, moveTimeMs: 3200 },
  impossible: { label: 'الصعوبة المستحيلة', rating: 3500, skillLevel: 20, depth: 64, moveTimeMs: 12000 },
};

const AI_TIME_CONTROL_OPTIONS = ['1', '3', '5', '10', '15', '30'] as const;

const normalizeAiTimeControlOption = (secondsOrMinutes: number): (typeof AI_TIME_CONTROL_OPTIONS)[number] => {
  const minutes = Math.max(1, Math.round(Number(secondsOrMinutes) || 10));
  const exact = AI_TIME_CONTROL_OPTIONS.find(option => Number(option) === minutes);
  if (exact) return exact;

  let nearest = AI_TIME_CONTROL_OPTIONS[0];
  let nearestDiff = Math.abs(Number(nearest) - minutes);
  for (const option of AI_TIME_CONTROL_OPTIONS) {
    const diff = Math.abs(Number(option) - minutes);
    if (diff < nearestDiff) {
      nearest = option;
      nearestDiff = diff;
    }
  }
  return nearest;
};

const getTimeControlFromSearch = (search: string): (typeof AI_TIME_CONTROL_OPTIONS)[number] => {
  try {
    const params = new URLSearchParams(search || '');
    const timeValue = params.get('time');
    if (!timeValue) return '10';
    return normalizeAiTimeControlOption(Number(timeValue));
  } catch (_error) {
    return '10';
  }
};

const getDifficultyFromRating = (rating?: number): AIDifficulty => {
  const safe = Number(rating) || 1500;
  if (safe <= 1250) return 'easy';
  if (safe >= 2600) return 'impossible';
  if (safe >= 1800) return 'hard';
  return 'medium';
};

const AIGame = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const DRAWING_GUIDE_STORAGE_KEY = 'drawing_guide_ai_v1';
  const navigate = useNavigate();
  const location = useLocation();
  const preferredTimeControl = getTimeControlFromSearch(location.search);
  const gameStartTimeRef = useRef<string>(new Date().toISOString());
  const resultSavedRef = useRef(false);
  const clockSyncInFlightRef = useRef(false);
  const startCountdownIntervalRef = useRef<number | null>(null);
  const [persistedGameId, setPersistedGameId] = useState<number | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);
  const [closingConflictingGame, setClosingConflictingGame] = useState(false);
  const [activeGameConflict, setActiveGameConflict] = useState<{
    open: boolean;
    gameId: number | null;
    message: string;
  }>({
    open: false,
    gameId: null,
    message: '',
  });
  const storageSessionKey = useMemo(() => `ai_active_game_id_${user?.id || 'guest'}`, [user?.id]);
  
  const [game, setGame] = useState(new Chess());
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState({
    status: 'active', // 'active', 'finished'
    currentTurn: 'white',
    isCheck: false,
    isCheckmate: false,
    isDraw: false,
    winner: null as string | null
  });
  
  const [moves, setMoves] = useState<GameMove[]>([]);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [aiInitialTimeSeconds, setAiInitialTimeSeconds] = useState(Number(preferredTimeControl) * 60);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupColor, setSetupColor] = useState<'white' | 'black'>('white');
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficulty>('medium');
  const [setupTimeControl, setSetupTimeControl] = useState<(typeof AI_TIME_CONTROL_OPTIONS)[number]>(preferredTimeControl);
  const [startingWithSetup, setStartingWithSetup] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [gameTime, setGameTime] = useState({
    white: 600, // 10 minutes
    black: 600,
    isRunning: false,
    lastUpdate: Date.now()
  });

  const aiConfig = useMemo(() => AI_DIFFICULTY_CONFIG[difficulty], [difficulty]);
  const setupInitialTimeSeconds = useMemo(() => {
    const minutes = Math.max(1, Number(setupTimeControl) || 10);
    return minutes * 60;
  }, [setupTimeControl]);

  const extractMyRatingChange = useCallback(
    (ratingChanges?: {
      white?: { userId: number; delta: number; newRating?: number; isPlacement?: boolean; gamesPlayed?: number };
      black?: { userId: number; delta: number; newRating?: number; isPlacement?: boolean; gamesPlayed?: number };
    } | null) => {
      if (!ratingChanges || !user?.id) return null;
      const myId = Number(user.id);
      if (ratingChanges.white && Number(ratingChanges.white.userId) === myId) return ratingChanges.white;
      if (ratingChanges.black && Number(ratingChanges.black.userId) === myId) return ratingChanges.black;
      return null;
    },
    [user?.id]
  );

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

  const aiPlayer = useMemo<AIPlayer>(() => ({
    name: 'الذكاء الاصطناعي',
    rating: aiConfig.rating,
    color: playerColor === 'white' ? 'black' : 'white',
    avatar: '/placeholder.svg'
  }), [aiConfig.rating, playerColor]);

  const humanPlayer = useMemo<AIPlayer>(() => ({
    name: user?.username || 'اللاعب',
    rating: user?.rating || 1500,
    color: playerColor,
    avatar: user?.avatar || ''
  }), [user?.username, user?.rating, user?.avatar, playerColor]);

  const mapMovePairsToList = useCallback((pairs: GameMovePair[]): GameMove[] => {
    return (pairs || []).map((pair) => ({
      moveNumber: pair.moveNumber,
      white: pair.white?.san || undefined,
      black: pair.black?.san || undefined,
      san: pair.black?.san || pair.white?.san || '',
      fen: pair.fen || '',
    }));
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      showDrawingGuide(false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loading, showSetupModal, showDrawingGuide]);
  const startPreGameCountdown = useCallback(() => {
    if (startCountdownIntervalRef.current !== null) {
      window.clearInterval(startCountdownIntervalRef.current);
      startCountdownIntervalRef.current = null;
    }

    setStartCountdown(3);
    setGameTime(prev => ({
      ...prev,
      isRunning: false,
      lastUpdate: Date.now(),
    }));

    startCountdownIntervalRef.current = window.setInterval(() => {
      setStartCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (startCountdownIntervalRef.current !== null) {
            window.clearInterval(startCountdownIntervalRef.current);
            startCountdownIntervalRef.current = null;
          }
          setGameTime(current => ({
            ...current,
            isRunning: true,
            lastUpdate: Date.now(),
          }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (startCountdownIntervalRef.current !== null) {
        window.clearInterval(startCountdownIntervalRef.current);
        startCountdownIntervalRef.current = null;
      }
    };
  }, []);

  const restoreAiSession = useCallback(async (session: ActiveAiGameSession) => {
    const restoredGame =
      session.currentFen && session.currentFen !== 'startpos'
        ? new Chess(session.currentFen)
        : new Chess();

    const movesPairs = await userService.getGameMoves(session.gameId);

    setPersistedGameId(session.gameId);
    setPlayerColor(session.playerColor);
    const restoredDifficulty = getDifficultyFromRating(session.aiLevel);
    setDifficulty(restoredDifficulty);
    setSetupDifficulty(restoredDifficulty);
    setSetupColor(session.playerColor);
    const restoredInitialTime = Math.max(60, Number(session.initialTime) || 600);
    setAiInitialTimeSeconds(restoredInitialTime);
    setSetupTimeControl(normalizeAiTimeControlOption(restoredInitialTime / 60));
    setGame(restoredGame);
    setMoves(mapMovePairsToList(movesPairs));

    setGameState({
      status: session.status === 'active' ? 'active' : 'finished',
      currentTurn: session.currentTurn,
      isCheck: restoredGame.inCheck(),
      isCheckmate: restoredGame.isCheckmate(),
      isDraw: restoredGame.isDraw(),
      winner: null,
    });

    let restoredWhite = Math.max(0, Number(session.whiteTimeLeft) || 0);
    let restoredBlack = Math.max(0, Number(session.blackTimeLeft) || 0);

    if (session.status === 'active' && session.clockSyncedAt) {
      const syncedAtMs = new Date(session.clockSyncedAt).getTime();
      if (!Number.isNaN(syncedAtMs)) {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - syncedAtMs) / 1000));
        if (session.currentTurn === 'white') {
          restoredWhite = Math.max(0, restoredWhite - elapsedSeconds);
        } else {
          restoredBlack = Math.max(0, restoredBlack - elapsedSeconds);
        }
      }
    }

    setGameTime({
      white: restoredWhite,
      black: restoredBlack,
      isRunning: session.status === 'active',
      lastUpdate: Date.now(),
    });
    setStartCountdown(null);

    gameStartTimeRef.current = session.startedAt || new Date().toISOString();
    resultSavedRef.current = session.status !== 'active';
    localStorage.setItem(storageSessionKey, String(session.gameId));
  }, [mapMovePairsToList, storageSessionKey]);

  const syncClockToServer = useCallback(async () => {
    if (!persistedGameId || loading || gameState.status !== 'active') return;
    if (clockSyncInFlightRef.current) return;

    clockSyncInFlightRef.current = true;
    try {
      await userService.syncGameClock(persistedGameId, {
        whiteTimeLeft: Math.max(0, Math.floor(gameTime.white)),
        blackTimeLeft: Math.max(0, Math.floor(gameTime.black)),
        currentTurn: (gameState.currentTurn as 'white' | 'black') || 'white',
      });
    } catch (error) {
      console.error('Failed to sync AI game clock:', error);
    } finally {
      clockSyncInFlightRef.current = false;
    }
  }, [persistedGameId, loading, gameState.status, gameState.currentTurn, gameTime.white, gameTime.black]);

  const initializeAiPersistence = useCallback(async (options?: { color?: 'white' | 'black'; aiDifficulty?: AIDifficulty; initialTimeSeconds?: number }) => {
    const selectedColor = options?.color || playerColor;
    const selectedDifficulty = options?.aiDifficulty || difficulty;
    const selectedInitialTime = Math.max(60, Number(options?.initialTimeSeconds || aiInitialTimeSeconds) || 600);
    const selectedConfig = AI_DIFFICULTY_CONFIG[selectedDifficulty];

    try {
      const session = await userService.createAiGameSession({
        playerColor: selectedColor,
        aiLevel: selectedConfig.rating,
        difficulty: selectedDifficulty,
        initialTime: selectedInitialTime,
      });
      setActiveGameConflict({ open: false, gameId: null, message: '' });
      setPlayerColor(selectedColor);
      setDifficulty(selectedDifficulty);
      setAiInitialTimeSeconds(selectedInitialTime);
      setSetupColor(selectedColor);
      setSetupDifficulty(selectedDifficulty);
      setSetupTimeControl(normalizeAiTimeControlOption(selectedInitialTime / 60));
      setPersistedGameId(session.gameId);
      localStorage.setItem(storageSessionKey, String(session.gameId));
      gameStartTimeRef.current = new Date().toISOString();
      resultSavedRef.current = false;
      startPreGameCountdown();
    } catch (error) {
      const conflictError = error as ApiConflictError;
      console.error('Failed to create AI game session:', error);
      setPersistedGameId(null);

      if (conflictError.status === 409 || conflictError.code === 'ACTIVE_GAME_EXISTS') {
        const existingGameId = Number(conflictError.data?.existingGameId || conflictError.data?.gameId || 0) || null;
        setActiveGameConflict({
          open: true,
          gameId: existingGameId,
          message: conflictError.message || 'يوجد لديك مباراة غير مغلقة. يرجى إغلاقها أولاً.',
        });
        return;
      }

      toast({
        title: 'تحذير',
        description: 'تعذر تهيئة حفظ المباراة على الخادم',
        variant: 'destructive',
      });
    }
  }, [playerColor, difficulty, aiInitialTimeSeconds, storageSessionKey, toast, startPreGameCountdown]);

  const handleCloseConflictingGame = useCallback(async () => {
    if (!activeGameConflict.gameId) {
      setActiveGameConflict({ open: false, gameId: null, message: '' });
      return;
    }

    setClosingConflictingGame(true);
    try {
      await userService.endCurrentGame(activeGameConflict.gameId);
      setActiveGameConflict({ open: false, gameId: null, message: '' });
      toast({
        title: 'تم إغلاق المباراة',
        description: 'تم إغلاق المباراة غير المغلقة. يمكنك الآن بدء مباراة جديدة.',
      });
      await initializeAiPersistence({ color: setupColor, aiDifficulty: setupDifficulty });
    } catch (error) {
      const typedError = error as Error;
      toast({
        title: 'تعذر إغلاق المباراة',
        description: typedError.message || 'فشل إغلاق المباراة الجارية.',
        variant: 'destructive',
      });
    } finally {
      setClosingConflictingGame(false);
    }
  }, [activeGameConflict.gameId, initializeAiPersistence, setupColor, setupDifficulty, toast]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAiGame = async () => {
      setLoading(true);
      try {
        const activeSession = await userService.getActiveAiGameSession();
        if (cancelled) return;

        if (activeSession) {
          await restoreAiSession(activeSession);
          return;
        }

        setShowSetupModal(true);
      } catch (error) {
        console.error('Failed to bootstrap AI game session:', error);
        if (!cancelled) {
          setShowSetupModal(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrapAiGame();
    return () => {
      cancelled = true;
    };
  }, [restoreAiSession]);

  useEffect(() => {
    if (!showSetupModal || persistedGameId) return;
    const fromQuery = getTimeControlFromSearch(location.search);
    setSetupTimeControl(fromQuery);
    setAiInitialTimeSeconds(Number(fromQuery) * 60);
  }, [showSetupModal, persistedGameId, location.search]);

  useEffect(() => {
    if (!persistedGameId || loading || gameState.status !== 'active') return;
    const interval = window.setInterval(() => {
      syncClockToServer();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [persistedGameId, loading, gameState.status, syncClockToServer]);

  useEffect(() => {
    const flushClock = () => {
      syncClockToServer();
    };

    const onVisibilityChange = () => {
      if (document.hidden) flushClock();
    };

    window.addEventListener('beforeunload', flushClock);
    window.addEventListener('pagehide', flushClock);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushClock);
      window.removeEventListener('pagehide', flushClock);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [syncClockToServer]);

  // Timer countdown effect
  useEffect(() => {
    if (!gameTime.isRunning || gameState.status !== 'active') return;

    const interval = setInterval(() => {
      setGameTime(prev => {
        const now = Date.now();
        const timeDiff = (now - prev.lastUpdate) / 1000;
        
        let newWhiteTime = prev.white;
        let newBlackTime = prev.black;
        
        if (gameState.currentTurn === 'white') {
          newWhiteTime = Math.max(0, Math.floor(prev.white - timeDiff));
        } else if (gameState.currentTurn === 'black') {
          newBlackTime = Math.max(0, Math.floor(prev.black - timeDiff));
        }
        
        // Check for timeout
        if (newWhiteTime <= 0 || newBlackTime <= 0) {
          const timeoutPlayer = newWhiteTime <= 0 ? 'white' : 'black';
          const winner = timeoutPlayer === 'white' ? 'black' : 'white';

          setTimeout(() => {
            handleGameEnd({ reason: 'timeout', winner });
          }, 0);
          
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
    }, 1000);

    return () => clearInterval(interval);
  }, [gameTime.isRunning, gameState.currentTurn, gameState.status, playerColor]);

  const handleGameEnd = useCallback((data: { reason: string; winner?: string }) => {
    const { reason, winner } = data;

    if (!resultSavedRef.current) {
      resultSavedRef.current = true;
      const aiResult: 'win' | 'loss' | 'draw' =
        reason === 'draw' ||
        reason === 'stalemate' ||
        reason === 'threefold_repetition' ||
        reason === 'insufficient_material'
          ? 'draw'
          : winner === playerColor
            ? 'win'
            : 'loss';

      if (persistedGameId) {
        userService
          .finalizeAiGame(persistedGameId, {
            result: aiResult,
            finalFen: game.fen(),
            whiteTimeLeft: gameTime.white,
            blackTimeLeft: gameTime.black,
          })
          .then((response) => {
            const change = extractMyRatingChange(response?.ratingChanges);
            const delta = Number(change?.delta) || 0;
            const isPlacementChange = Boolean(change?.isPlacement);
            const gamesPlayedAfter = Number(change?.gamesPlayed || 0) + 1;
            if (delta !== 0) {
              toast({
                title: delta > 0 ? `🎉 +${delta} نقطة` : `❌ ${delta} نقطة`,
                description: isPlacementChange
                  ? `تم تحديث تقييمك بعد المباراة (Placement ${gamesPlayedAfter}/10)`
                  : 'تم تحديث تقييمك بعد المباراة',
              });
            }
            if (isPlacementChange && gamesPlayedAfter >= 10) {
              const finalRating = Number(change?.newRating || 0);
              toast({
                title: '🎯 تم تحديد مستواك',
                description: finalRating > 0 ? `تم تثبيت تقييمك على ${finalRating}` : 'اكتملت مرحلة تحديد المستوى',
              });
            }
          })
          .catch(error => {
            console.error('Failed to finalize AI game:', error);
          });
      }

      localStorage.removeItem(storageSessionKey);
    }
    
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      winner: winner || null
    }));
    
    setGameTime(prev => ({
      ...prev,
      isRunning: false
    }));
    setStartCountdown(null);

    let message = '';
    switch (reason) {
      case 'checkmate':
        message = winner === playerColor ? 'مبروك! فزت بالمباراة' : 'للأسف، خسرت المباراة';
        break;
      case 'timeout':
        message = `فاز ${winner === playerColor ? 'أنت' : 'الذكاء الاصطناعي'} بالوقت`;
        break;
      case 'resign':
        message = winner === playerColor ? 'فزت بالاستسلام' : 'خسرت بالاستسلام';
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
  }, [playerColor, toast, gameTime.white, gameTime.black, game, persistedGameId, storageSessionKey, extractMyRatingChange]);

  // Simple AI move generation
  const generateAIMove = useCallback(async () => {
    if (startCountdown !== null || gameState.currentTurn !== aiPlayer.color || gameState.status !== 'active') {
      return;
    }

    setAiThinking(true);

    try {
      const gameCopy = new Chess(game.fen());
      const possibleMoves = gameCopy.moves({ verbose: true });

      if (possibleMoves.length === 0) {
        if (gameCopy.isCheckmate()) {
          handleGameEnd({ reason: 'checkmate', winner: playerColor });
        } else if (gameCopy.isDraw()) {
          handleGameEnd({ reason: 'draw' });
        }
        return;
      }

      const bestMoveResult = await userService.getAiBestMove({
        fen: gameCopy.fen(),
        difficulty,
      });
      const bestMoveUci = bestMoveResult?.bestMove || null;

      let aiMove: Move | null = null;

      if (bestMoveUci && bestMoveUci.length >= 4) {
        const from = bestMoveUci.slice(0, 2) as Square;
        const to = bestMoveUci.slice(2, 4) as Square;
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;

        aiMove = gameCopy.move({ from, to, promotion: promotion || undefined }) || null;
      }

      if (!aiMove) {
        const fallbackMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        aiMove = gameCopy.move(fallbackMove) || null;
      }

      if (!aiMove) {
        return;
      }

      if (persistedGameId) {
        try {
          await userService.recordAiGameMove(persistedGameId, {
            from: aiMove.from,
            to: aiMove.to,
            promotion: aiMove.promotion || '',
            san: aiMove.san,
            fenAfter: gameCopy.fen(),
            movedBy: 'ai',
            nextTurn: playerColor,
          });
        } catch (error) {
          console.error('Failed to persist AI move:', error);
        }
      }

      setGame(gameCopy);

      setMoves(prev => {
        const newMoves = [...prev];
        if (aiPlayer.color === 'white') {
          const moveNumber = newMoves.length + 1;
          newMoves.push({
            moveNumber,
            white: aiMove.san,
            black: null,
            san: aiMove.san,
            fen: gameCopy.fen()
          });
        } else {
          if (newMoves.length === 0) {
            newMoves.push({
              moveNumber: 1,
              white: null,
              black: aiMove.san,
              san: aiMove.san,
              fen: gameCopy.fen()
            });
          } else {
            const lastMove = newMoves[newMoves.length - 1];
            lastMove.black = aiMove.san;
            lastMove.san = aiMove.san;
            lastMove.fen = gameCopy.fen();
          }
        }
        return newMoves;
      });

      setGameState(prev => ({
        ...prev,
        currentTurn: playerColor,
        isCheck: gameCopy.inCheck(),
        isCheckmate: gameCopy.isCheckmate(),
        isDraw: gameCopy.isDraw()
      }));

      setGameTime(prev => ({
        ...prev,
        lastUpdate: Date.now()
      }));

      if (gameCopy.isCheckmate()) {
        handleGameEnd({ reason: 'checkmate', winner: playerColor });
      } else if (gameCopy.isDraw()) {
        handleGameEnd({ reason: 'draw' });
      } else if (gameCopy.isStalemate()) {
        handleGameEnd({ reason: 'stalemate' });
      }
    } catch (error) {
      console.error('AI move generation error:', error);
      toast({
        title: 'خطأ في الذكاء الاصطناعي',
        description: 'حدث خطأ أثناء توليد حركة الذكاء الاصطناعي',
        variant: 'destructive'
      });
    } finally {
      setAiThinking(false);
    }
  }, [
    game,
    gameState.currentTurn,
    gameState.status,
    aiPlayer.color,
    playerColor,
    handleGameEnd,
    toast,
    persistedGameId,
    startCountdown,
    difficulty,
  ]);

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (startCountdown === null && gameState.currentTurn === aiPlayer.color && gameState.status === 'active' && !aiThinking) {
      generateAIMove();
    }
  }, [gameState.currentTurn, gameState.status, aiThinking, generateAIMove, startCountdown]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    // Check if it's player's turn
    if (gameState.currentTurn !== playerColor) {
      toast({
        title: "ليس دورك",
        description: "انتظر دور الذكاء الاصطناعي",
        variant: "destructive"
      });
      return false;
    }

    // Check if AI is thinking
    if (aiThinking) {
      toast({
        title: "الذكاء الاصطناعي يفكر",
        description: "يرجى الانتظار حتى ينتهي من التفكير",
        variant: "destructive"
      });
      return false;
    }

    // Check if game is active
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
        if (persistedGameId) {
          userService
            .recordAiGameMove(persistedGameId, {
              from: move.from,
              to: move.to,
              promotion: move.promotion || '',
              san: move.san,
              fenAfter: gameCopy.fen(),
              movedBy: 'human',
              nextTurn: aiPlayer.color,
            })
            .catch(error => {
              console.error('Failed to persist player move:', error);
            });
        }

        setGame(gameCopy);
        
        // Update moves list
        setMoves(prev => {
          const newMoves = [...prev];
          if (playerColor === 'white') {
            const moveNumber = newMoves.length + 1;
            newMoves.push({
              moveNumber,
              white: move.san,
              black: null,
              san: move.san,
              fen: gameCopy.fen()
            });
          } else {
            if (newMoves.length === 0) {
              newMoves.push({
                moveNumber: 1,
                white: null,
                black: move.san,
                san: move.san,
                fen: gameCopy.fen()
              });
            } else {
              const lastMove = newMoves[newMoves.length - 1];
              lastMove.black = move.san;
              lastMove.san = move.san;
              lastMove.fen = gameCopy.fen();
            }
          }
          return newMoves;
        });

        // Update game state
        setGameState(prev => ({
          ...prev,
          currentTurn: aiPlayer.color,
          isCheck: gameCopy.inCheck(),
          isCheckmate: gameCopy.isCheckmate(),
          isDraw: gameCopy.isDraw()
        }));

        // Update timers
        setGameTime(prev => ({
          ...prev,
          lastUpdate: Date.now()
        }));

        // Check for game end
        if (gameCopy.isCheckmate()) {
          handleGameEnd({ reason: 'checkmate', winner: playerColor });
          return true;
        } else if (gameCopy.isDraw()) {
          handleGameEnd({ reason: 'draw' });
          return true;
        } else if (gameCopy.isStalemate()) {
          handleGameEnd({ reason: 'stalemate' });
          return true;
        }

        return true;
      }
    } catch (error) {
      toast({
        title: "حركة غير صحيحة",
        description: "يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    }

    return false;
  }, [game, gameState, playerColor, aiPlayer.color, handleGameEnd, toast, persistedGameId]);

  const handleResign = () => {
    setShowResignConfirm(true);
  };

  const handleConfirmResign = () => {
    setShowResignConfirm(false);
    syncClockToServer();
    const winner = playerColor === 'white' ? 'black' : 'white';
    handleGameEnd({ reason: 'resign', winner });
  };

  const boardResultSticker = useMemo<'win' | 'loss' | 'draw' | null>(() => {
    if (gameState.status !== 'finished') return null;
    if (gameState.isDraw || !gameState.winner) return 'draw';
    return gameState.winner === playerColor ? 'win' : 'loss';
  }, [gameState.status, gameState.isDraw, gameState.winner, playerColor]);
  const getFinalizeResultForCurrentGame = useCallback((): 'win' | 'loss' | 'draw' => {
    if (gameState.status === 'active') {
      // Starting a new game while active is treated as resignation/forfeit.
      return 'loss';
    }

    if (!gameState.winner) return 'draw';
    return gameState.winner === playerColor ? 'win' : 'loss';
  }, [gameState.status, gameState.winner, playerColor]);

  const resetForNewGame = useCallback((initialTimeOverride?: number) => {
    const resolvedInitialTime = Math.max(
      60,
      Number(initialTimeOverride ?? aiInitialTimeSeconds) || 600
    );
    localStorage.removeItem(storageSessionKey);
    setGame(new Chess());
    setMoves([]);
    setGameState({
      status: 'active',
      currentTurn: 'white',
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      winner: null
    });
    setGameTime({
      white: resolvedInitialTime,
      black: resolvedInitialTime,
      isRunning: false,
      lastUpdate: Date.now()
    });
    setAiInitialTimeSeconds(resolvedInitialTime);
    setAiThinking(false);
    setPersistedGameId(null);
    setLoading(false);
    setShowNewGameConfirm(false);
  }, [storageSessionKey, aiInitialTimeSeconds]);

  const openSetupModalForNewGame = useCallback(() => {
    setSetupColor(playerColor);
    setSetupDifficulty(difficulty);
    setSetupTimeControl(normalizeAiTimeControlOption(aiInitialTimeSeconds / 60));
    setShowSetupModal(true);
  }, [playerColor, difficulty, aiInitialTimeSeconds]);

  const handleConfirmNewGame = useCallback(async () => {
    setRestartingGame(true);
    try {
      if (persistedGameId && !resultSavedRef.current) {
        await syncClockToServer();
        const finalizeResult = getFinalizeResultForCurrentGame();
        await userService.finalizeAiGame(persistedGameId, {
          result: finalizeResult,
          finalFen: game.fen(),
          whiteTimeLeft: Math.max(0, Math.floor(gameTime.white)),
          blackTimeLeft: Math.max(0, Math.floor(gameTime.black)),
        });
        resultSavedRef.current = true;
      }

      resetForNewGame();
      openSetupModalForNewGame();
    } catch (error) {
      console.error('Failed to restart AI game:', error);
      toast({
        title: 'تعذر بدء لعبة جديدة',
        description: 'حدث خطأ أثناء إنهاء اللعبة الحالية. حاول مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setRestartingGame(false);
    }
  }, [
    persistedGameId,
    syncClockToServer,
    getFinalizeResultForCurrentGame,
    game,
    gameTime.white,
    gameTime.black,
    resetForNewGame,
    openSetupModalForNewGame,
    toast,
  ]);

  const handleNewGame = () => {
    if (gameState.status === 'active' && persistedGameId) {
      setShowNewGameConfirm(true);
      return;
    }

    openSetupModalForNewGame();
  };

  const handleStartWithSetup = useCallback(async () => {
    setStartingWithSetup(true);
    try {
      setShowSetupModal(false);
      const chosenInitial = setupInitialTimeSeconds;
      resetForNewGame(chosenInitial);
      await initializeAiPersistence({
        color: setupColor,
        aiDifficulty: setupDifficulty,
        initialTimeSeconds: chosenInitial,
      });
    } finally {
      setStartingWithSetup(false);
    }
  }, [setupInitialTimeSeconds, resetForNewGame, initializeAiPersistence, setupColor, setupDifficulty]);

  const getPendingNewGameResultText = () => {
    const result = getFinalizeResultForCurrentGame();
    if (result === 'win') return 'فوز';
    if (result === 'draw') return 'تعادل';
    return 'خسارة (انسحاب)';
  };

  const getPendingNewGameDescription = () => {
    if (gameState.status === 'active') {
      return 'سيتم إنهاء المباراة الحالية فورًا وتسجيلها كخسارة بالانسحاب، ثم إنشاء مباراة جديدة من البداية.';
    }
    return 'سيتم حفظ النتيجة الحالية كما هي، ثم بدء مباراة جديدة من الصفر.';
  };

  const legacyReset = () => {
    resetForNewGame();
    openSetupModalForNewGame();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlayerTimer = (playerColor: 'white' | 'black') => {
    return playerColor === 'white' ? gameTime.white : gameTime.black;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <h1 className="font-amiri text-xl font-bold">اللعب ضد الذكاء الاصطناعي</h1>
              {loading && (
                <Badge variant="outline" className="bg-secondary/10">
                  جاري استعادة المباراة...
                </Badge>
              )}
</div>

            <div className="flex items-center gap-2">
              {!isMobileDevice() && (
                <Button variant="ghost" size="icon" onClick={() => showDrawingGuide(true)} aria-label="شرح الرسم" title="شرح الرسم">
                  <CircleHelp className="w-5 h-5" />
                </Button>
              )}
              <Button variant="outline" onClick={handleNewGame}>
                <RefreshCw className="w-4 h-4 ml-2" />
                لعبة جديدة
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
                        <AvatarImage src={hasCustomAvatar(aiPlayer.avatar) ? aiPlayer.avatar : undefined} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                          {getInitialsFromName(aiPlayer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{aiPlayer.name}</span>
                    </div>
                    <div className={`mt-1 text-right text-sm font-mono ${gameState.currentTurn === aiPlayer.color ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {formatTime(getPlayerTimer(aiPlayer.color))}
                    </div>
                  </div>

                  <Badge
                    variant={
                      gameState.status !== 'active'
                        ? 'destructive'
                        : gameState.currentTurn === playerColor
                          ? 'default'
                          : 'outline'
                    }
                    className="shrink-0"
                  >
                    {gameState.status !== 'active'
                      ? 'المباراة منتهية'
                      : gameState.currentTurn === playerColor
                        ? 'دورك'
                        : 'دور الذكاء'}
                  </Badge>

                  <div className="min-w-0 flex-1 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="flex items-center justify-start gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={hasCustomAvatar(humanPlayer.avatar) ? humanPlayer.avatar : undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitialsFromName(humanPlayer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-cairo font-semibold">{humanPlayer.name}</span>
                    </div>
                    <div className={`mt-1 text-right text-sm font-mono ${gameState.currentTurn === humanPlayer.color ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {formatTime(getPlayerTimer(humanPlayer.color))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Player */}
            <Card className="hidden md:block">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={hasCustomAvatar(aiPlayer.avatar) ? aiPlayer.avatar : undefined} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {getInitialsFromName(aiPlayer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{aiPlayer.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      <Trophy className="w-3 h-3 ml-1" />
                      {aiPlayer.rating}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold text-primary">
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(getPlayerTimer(aiPlayer.color))}
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
                  <Badge variant={gameState.currentTurn === playerColor ? "default" : "outline"}>
                    {gameState.currentTurn === playerColor ? 'دورك' : 'دور الذكاء الاصطناعي'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Human Player */}
            <Card className="hidden md:block">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={hasCustomAvatar(humanPlayer.avatar) ? humanPlayer.avatar : undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitialsFromName(humanPlayer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{humanPlayer.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      <Trophy className="w-3 h-3 ml-1" />
                      {humanPlayer.rating}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold text-primary">
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(getPlayerTimer(humanPlayer.color))}
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
                disabled={gameState.status !== 'active'}
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
                orientation={playerColor}
                allowMoves={!loading && startCountdown === null && gameState.status === 'active' && gameState.currentTurn === playerColor && !aiThinking}
                resultSticker={boardResultSticker}
              />
            </Card>

            {/* Mobile Secondary Info */}
            <Card className="mt-4 md:hidden">
              <CardContent className="p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع المباراة</span>
                  <Badge variant="outline">لعبة ضد الذكاء الاصطناعي</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الصعوبة</span>
                  <Badge variant="outline">{aiConfig.label}</Badge>
                </div>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">دور اللعب</span>
                  <Badge variant={gameState.currentTurn === playerColor ? "default" : "outline"}>
                    {gameState.currentTurn === playerColor ? 'دورك' : 'دور الذكاء'}
                  </Badge>
                </div>
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

          {/* Moves List */}
          <div className="lg:col-span-1">
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
          </div>
        </div>
      </div>

      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-bold">إعداد مباراة الذكاء الاصطناعي</h2>
            <p className="mb-4 text-sm text-muted-foreground">حدد اللون ومستوى الصعوبة قبل بدء المباراة.</p>

            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold">اختر لونك</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={setupColor === 'white' ? 'default' : 'outline'} onClick={() => setSetupColor('white')}>
                  ألعب بالأبيض
                </Button>
                <Button type="button" variant={setupColor === 'black' ? 'default' : 'outline'} onClick={() => setSetupColor('black')}>
                  ألعب بالأسود
                </Button>
              </div>
            </div>

            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold">اختر مستوى الصعوبة</p>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard', 'impossible'] as const).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={setupDifficulty === level ? 'default' : 'outline'}
                    onClick={() => setSetupDifficulty(level)}
                    className="flex flex-col gap-1 h-auto py-3"
                  >
                    <span>{AI_DIFFICULTY_CONFIG[level].label}</span>
                    <span className="text-xs opacity-80">{AI_DIFFICULTY_CONFIG[level].rating}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold">اختر مدة المباراة</p>
              <Select value={setupTimeControl} onValueChange={(value) => setSetupTimeControl(value as (typeof AI_TIME_CONTROL_OPTIONS)[number])}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مدة المباراة" />
                </SelectTrigger>
                <SelectContent>
                  {AI_TIME_CONTROL_OPTIONS.map((minutes) => (
                    <SelectItem key={minutes} value={minutes}>
                      {minutes} دقيقة
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/dashboard')}
                disabled={startingWithSetup}
              >
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleStartWithSetup} disabled={startingWithSetup}>
                {startingWithSetup ? 'جارٍ البدء...' : 'ابدأ المباراة'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
      {gameState.status === 'finished' && gameState.winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                {gameState.winner === playerColor ? (
                  <div className="text-4xl mb-2">👑</div>
                ) : (
                  <div className="text-4xl mb-2">🤖</div>
                )}
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                {gameState.winner === playerColor ? 'مبروك! فزت!' : 'خسرت المباراة'}
              </h2>
              
              <p className="text-muted-foreground mb-6">
                {gameState.winner === playerColor 
                  ? 'لقد فزت ضد الذكاء الاصطناعي!' 
                  : 'الذكاء الاصطناعي فاز هذه المرة. حاول مرة أخرى!'}
              </p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={legacyReset}
                  className="flex-1"
                >
                  لعبة جديدة
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                >
                  العودة للوحة التحكم
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeGameConflict.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-bold">يوجد مباراة غير مغلقة</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {activeGameConflict.message || 'يوجد لديك مباراة غير مغلقة. يرجى إغلاقها أولاً.'}
            </p>

            {activeGameConflict.gameId && (
              <div className="mb-5 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">رقم المباراة:</span>
                  <span className="font-semibold text-primary">#{activeGameConflict.gameId}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActiveGameConflict({ open: false, gameId: null, message: '' })}
                disabled={closingConflictingGame}
              >
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleCloseConflictingGame} disabled={closingConflictingGame}>
                {closingConflictingGame ? 'جارٍ الإغلاق...' : 'إغلاق المباراة الجارية'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showResignConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg text-center">
            <h2 className="mb-2 text-xl font-bold">تأكيد الاستسلام</h2>
            <p className="mb-4 text-sm text-muted-foreground">هل أنت متأكد أنك تريد الاستسلام؟ سيتم احتساب المباراة كخسارة.</p>

            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                className="min-w-24"
                onClick={() => setShowResignConfirm(false)}
              >
                إلغاء
              </Button>
              <Button variant="destructive" className="min-w-32" onClick={handleConfirmResign}>
                تأكيد الاستسلام
              </Button>
            </div>
          </div>
        </div>
      )}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-bold">تأكيد بدء لعبة جديدة</h2>
            <p className="mb-4 text-sm text-muted-foreground">{getPendingNewGameDescription()}</p>

            <div className="mb-5 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">النتيجة التي ستُسجل:</span>
                <span className="font-semibold text-primary">{getPendingNewGameResultText()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNewGameConfirm(false)}
                disabled={restartingGame}
              >
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleConfirmNewGame} disabled={restartingGame}>
                {restartingGame ? 'جارٍ التنفيذ...' : 'تأكيد وبدء لعبة جديدة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGame; 















