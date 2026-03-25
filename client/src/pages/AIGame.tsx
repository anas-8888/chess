import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess, Square, Move } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Flag, 
  RotateCcw,
  Crown,
  Brain,
  User,
  Trophy,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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

type AIDifficulty = 'easy' | 'medium' | 'hard';

const AI_DIFFICULTY_CONFIG: Record<AIDifficulty, { label: string; rating: number; searchBreadth: number; thinkDelayMs: [number, number] }> = {
  easy: { label: 'سهل', rating: 1100, searchBreadth: 4, thinkDelayMs: [500, 1000] },
  medium: { label: 'متوسط', rating: 1500, searchBreadth: 10, thinkDelayMs: [900, 1600] },
  hard: { label: 'عالي', rating: 1900, searchBreadth: 18, thinkDelayMs: [1300, 2200] },
};

const getDifficultyFromRating = (rating?: number): AIDifficulty => {
  const safe = Number(rating) || 1500;
  if (safe <= 1250) return 'easy';
  if (safe >= 1800) return 'hard';
  return 'medium';
};

const AIGame = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupColor, setSetupColor] = useState<'white' | 'black'>('white');
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficulty>('medium');
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

  const aiPlayer = useMemo<AIPlayer>(() => ({
    name: 'الذكاء الاصطناعي',
    rating: aiConfig.rating,
    color: playerColor === 'white' ? 'black' : 'white',
    avatar: '/placeholder.svg'
  }), [aiConfig.rating, playerColor]);

  const humanPlayer = useMemo<AIPlayer>(() => ({
    name: user?.username || 'اللاعب',
    rating: user?.rating || 1200,
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

  const initializeAiPersistence = useCallback(async (options?: { color?: 'white' | 'black'; aiDifficulty?: AIDifficulty }) => {
    const selectedColor = options?.color || playerColor;
    const selectedDifficulty = options?.aiDifficulty || difficulty;
    const selectedConfig = AI_DIFFICULTY_CONFIG[selectedDifficulty];

    try {
      const session = await userService.createAiGameSession({
        playerColor: selectedColor,
        aiLevel: selectedConfig.rating,
        difficulty: selectedDifficulty,
        initialTime: 600,
      });
      setActiveGameConflict({ open: false, gameId: null, message: '' });
      setPlayerColor(selectedColor);
      setDifficulty(selectedDifficulty);
      setSetupColor(selectedColor);
      setSetupDifficulty(selectedDifficulty);
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
  }, [playerColor, difficulty, storageSessionKey, toast, startPreGameCountdown]);

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
    if (!gameTime.isRunning) return;

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
  }, [gameTime.isRunning, gameState.currentTurn, playerColor]);

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
  }, [playerColor, toast, gameTime.white, gameTime.black, game, persistedGameId, storageSessionKey]);

  // Simple AI move generation
  const generateAIMove = useCallback(async () => {
    if (startCountdown !== null || gameState.currentTurn !== aiPlayer.color || gameState.status !== 'active') {
      return;
    }

    setAiThinking(true);
    
    const [minDelay, maxDelay] = aiConfig.thinkDelayMs;
    await new Promise(resolve => setTimeout(resolve, minDelay + Math.random() * (maxDelay - minDelay)));
    
    try {
      const gameCopy = new Chess(game.fen());
      const possibleMoves = gameCopy.moves({ verbose: true });
      
      if (possibleMoves.length === 0) {
        // No moves available
        if (gameCopy.isCheckmate()) {
          handleGameEnd({ reason: 'checkmate', winner: playerColor });
        } else if (gameCopy.isDraw()) {
          handleGameEnd({ reason: 'draw' });
        }
        return;
      }

      // Simple AI: Choose a random move with some basic evaluation
      let bestMove = possibleMoves[0];
      let bestScore = -Infinity;

      // Evaluate a few random moves
      const movesToEvaluate = Math.min(aiConfig.searchBreadth, possibleMoves.length);
      const randomMoves = possibleMoves
        .sort(() => Math.random() - 0.5)
        .slice(0, movesToEvaluate);

      for (const move of randomMoves) {
        const tempGame = new Chess(gameCopy.fen());
        tempGame.move(move);
        
        // Simple evaluation: piece values + position
        let score = 0;
        const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        
        // Count material
        for (const square of tempGame.board().flat()) {
          if (square) {
            const piece = square.type;
            const color = square.color;
            const value = pieceValues[piece as keyof typeof pieceValues] || 0;
            score += (color === 'w' ? 1 : -1) * value;
          }
        }
        
        // Bonus for captures
        if (move.captured) {
          score += pieceValues[move.captured as keyof typeof pieceValues] * 2;
        }
        
        // Bonus for check
        if (tempGame.isCheck()) {
          score += 5;
        }
        
        // Bonus for checkmate
        if (tempGame.isCheckmate()) {
          score += 1000;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      // Make the AI move
      const aiMove = gameCopy.move(bestMove);
      if (aiMove) {
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
        
        // Update moves list
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

        // Update game state
        setGameState(prev => ({
          ...prev,
          currentTurn: playerColor,
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
        } else if (gameCopy.isDraw()) {
          handleGameEnd({ reason: 'draw' });
        } else if (gameCopy.isStalemate()) {
          handleGameEnd({ reason: 'stalemate' });
        }
      }
    } catch (error) {
      console.error('AI move generation error:', error);
      toast({
        title: "خطأ في الذكاء الاصطناعي",
        description: "حدث خطأ أثناء توليد حركة الذكاء الاصطناعي",
        variant: "destructive"
      });
    } finally {
      setAiThinking(false);
    }
  }, [game, gameState, aiPlayer.color, playerColor, handleGameEnd, toast, persistedGameId, startCountdown, aiConfig]);

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

  const getFinalizeResultForCurrentGame = useCallback((): 'win' | 'loss' | 'draw' => {
    if (gameState.status === 'active') {
      // Starting a new game while active is treated as resignation/forfeit.
      return 'loss';
    }

    if (!gameState.winner) return 'draw';
    return gameState.winner === playerColor ? 'win' : 'loss';
  }, [gameState.status, gameState.winner, playerColor]);

  const resetForNewGame = useCallback(() => {
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
      white: 600,
      black: 600,
      isRunning: false,
      lastUpdate: Date.now()
    });
    setAiThinking(false);
    setPersistedGameId(null);
    setLoading(false);
    setShowNewGameConfirm(false);
  }, [storageSessionKey]);

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
      resetForNewGame();
      await initializeAiPersistence({ color: setupColor, aiDifficulty: setupDifficulty });
    } finally {
      setStartingWithSetup(false);
    }
  }, [resetForNewGame, initializeAiPersistence, setupColor, setupDifficulty]);

  const openSetupModalForNewGame = () => {
    setSetupColor(playerColor);
    setSetupDifficulty(difficulty);
    setShowSetupModal(true);
  };

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
      <header className="bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-amiri text-xl font-bold">اللعب ضد الذكاء الاصطناعي</h1>
              {loading && (
                <Badge variant="outline" className="bg-secondary/10">
                  جاري استعادة المباراة...
                </Badge>
              )}
</div>

            <div className="flex items-center gap-2">
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
            {/* AI Player */}
            <Card>
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
                    {formatTime(getPlayerTimer('black'))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Game Status */}
            <Card>
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
            <Card>
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
                    {formatTime(getPlayerTimer('white'))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Game Controls */}
            <div className="space-y-2">
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
              <div className="mb-4 text-center">
                <Badge variant="outline" className="mb-2">
                  <Brain className="w-4 h-4 ml-1" />
                  ضد الذكاء الاصطناعي
                </Badge>
</div>
              <ChessBoard
                game={game}
                onMove={handleMove}
                orientation={playerColor}
                allowMoves={!loading && startCountdown === null && gameState.status === 'active' && gameState.currentTurn === playerColor && !aiThinking}
              />
            </Card>
          </div>

          {/* Moves List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri">النقلات</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
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
                {(['easy', 'medium', 'hard'] as const).map((level) => (
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
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-bold">تأكيد الاستسلام</h2>
            <p className="mb-4 text-sm text-muted-foreground">هل أنت متأكد أنك تريد الاستسلام؟ سيتم احتساب المباراة كخسارة.</p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowResignConfirm(false)}
              >
                إلغاء
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleConfirmResign}>
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









