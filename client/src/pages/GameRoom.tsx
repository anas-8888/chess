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
  WifiOff
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
  currentTurn: 'white' | 'black';
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

const GameRoom = () => {
  const { user, token } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [gameState, setGameState] = useState({
    id: 'game_123',
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
  const currentPlayerRef = useRef<'white' | 'black'>('white');
  
  // تحديد اللاعب الحالي بناءً على معرف المستخدم من التوكين
  useEffect(() => {
    if (gameData && user) {
      const currentUserId = parseInt(user.id);
      
      console.log('Setting up player data:', { currentUserId, gameData });
      
      if (gameData.whitePlayer.id === currentUserId) {
        setCurrentPlayer('white');
        currentPlayerRef.current = 'white';
        // تحديث ترتيب اللاعبين للاعب الأبيض
        setPlayers({
          white: gameData.whitePlayer,
          black: gameData.blackPlayer
        });
        // لا نحدث المؤقتات هنا - سيتم تحديثها من خلال clockUpdate فقط
        console.log('Player is white, timers will be updated via clockUpdate only');
      } else if (gameData.blackPlayer.id === currentUserId) {
        setCurrentPlayer('black');
        currentPlayerRef.current = 'black';
        // قلب ترتيب اللاعبين للاعب الأسود
        setPlayers({
          white: gameData.blackPlayer,
          black: gameData.whitePlayer
        });
        // لا نحدث المؤقتات هنا - سيتم تحديثها من خلال clockUpdate فقط
        console.log('Player is black, timers will be updated via clockUpdate only');
      } else {
        console.error('User is not a player in this game');
      }
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
    console.log('=== GAME ROOM: Timers state updated ===');
    console.log('Timers state updated:', timers);
    console.log('=== GAME ROOM: Current game state ===', gameState);
    console.log('=== GAME ROOM: Current player ===', currentPlayer);
    console.log('=== GAME ROOM: Game state currentTurn ===', gameState.currentTurn);
  }, [timers, gameState, currentPlayer]);

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

  const { toast } = useToast();

    // جلب بيانات اللعبة من الـ API
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // الحصول على معرف اللعبة من الـ URL
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game_id') || urlParams.get('id') || '1'; // افتراضياً لعبة رقم 1
        
        console.log('Fetching game data for game ID:', gameId);
        
        const response = await api.get(`/game/${gameId}`);
        
        if (response.data.success) {
          const data = response.data.data;
          console.log('Received game data:', data);
          setGameData(data);
          
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
          
          // جلب الحركات السابقة
          try {
            const movesResponse = await api.get(`/${gameId}/moves`);
            if (movesResponse.data.success) {
              const moves = movesResponse.data.data;
              console.log('Previous moves loaded:', moves);
              
              // تحويل الحركات إلى التنسيق المطلوب
              const formattedMoves: GameMove[] = [];
              let currentMove: GameMove | null = null;
              
              moves.forEach((move: any) => {
                const playerColor = move.playerId === data.whitePlayer.id ? 'white' : 'black';
                
                if (playerColor === 'white') {
                  if (currentMove && currentMove.white) {
                    // إنشاء حركة جديدة للأسود
                    formattedMoves.push({
                      moveNumber: Math.floor(formattedMoves.length / 2) + 1,
                      white: currentMove.white,
                      black: move.san,
                      san: move.san,
                      fen: move.fenAfter
                    });
                    currentMove = null;
                  } else {
                    // بدء حركة جديدة للأبيض
                    currentMove = {
                      moveNumber: Math.floor(formattedMoves.length / 2) + 1,
                      white: move.san,
                      san: move.san,
                      fen: move.fenAfter
                    };
                  }
                } else {
                  if (currentMove && currentMove.white) {
                    // إكمال الحركة الحالية
                    currentMove.black = move.san;
                    formattedMoves.push(currentMove);
                    currentMove = null;
                  } else {
                    // إنشاء حركة جديدة للأبيض والأسود
                    formattedMoves.push({
                      moveNumber: Math.floor(formattedMoves.length / 2) + 1,
                      white: '',
                      black: move.san,
                      san: move.san,
                      fen: move.fenAfter
                    });
                  }
                }
              });
              
              // إضافة الحركة الأخيرة إذا لم تكتمل
              if (currentMove) {
                formattedMoves.push(currentMove);
              }
              
              setMoves(formattedMoves);
              console.log('Formatted moves:', formattedMoves);
            }
          } catch (movesError) {
            console.error('Error loading previous moves:', movesError);
          }
          
          console.log('Setting up player data:', { currentUserId: user.id, gameData });
          console.log('Player is white/black, timers set:', { white: data.whiteTimeLeft, black: data.blackTimeLeft });
          
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
    
    fetchGameData();
  }, []);

  // Real-time socket events
  useEffect(() => {
    // SOCKET: socket.on('moveMade', (data) => {
    //   const { san, fen, movedBy, isPhysicalMove } = data;
    //   handleOpponentMove(san, fen, isPhysicalMove);
    // });

    // SOCKET: socket.on('clock', (data) => {
    //   setTimers(data);
    // });

    // SOCKET: socket.on('chatMessage', (message) => {
    //   setChatMessages(prev => [...prev, message]);
    // });

    // SOCKET: socket.on('drawOffered', (data) => {
    //   toast({
    //     title: "عرض تعادل",
    //     description: `${data.username} عرض التعادل`,
    //     action: (
    //       <div className="flex gap-2">
    //         <Button size="sm" onClick={() => handleDrawResponse(true)}>قبول</Button>
    //         <Button size="sm" variant="outline" onClick={() => handleDrawResponse(false)}>رفض</Button>
    //       </div>
    //     )
    //   });
    // });

    // SOCKET: socket.on('playerLeft', (data) => {
    //   toast({
    //     title: "اللاعب غادر",
    //     description: `${data.username} غادر المباراة`,
    //   });
    // });

    // SOCKET: socket.on('gameEnded', (data) => {
    //   // Handle game end - show result modal
    // });

    return () => {
      // SOCKET: socket.off('moveMade');
      // SOCKET: socket.off('clock');
      // SOCKET: socket.off('chatMessage');
      // etc...
    };
  }, []);

  // WebSocket events for real-time updates
  useEffect(() => {
    // Connect to WebSocket if user is authenticated
    if (user && token) {
      console.log('Connecting to WebSocket with token:', token);
      socketService.connect(token);
      
      // Set connection callback
      socketService.setConnectionCallback((connected) => {
        console.log('WebSocket connection status changed:', connected);
        setIsConnected(connected);
      });
      
      // Set up event listeners FIRST
      socketService.onClockUpdate((data) => {
        console.log('=== GAME ROOM: Received clockUpdate ===');
        console.log('Received clockUpdate:', data);
        const { whiteTimeLeft, blackTimeLeft, currentTurn } = data;
        console.log('Updating timers:', { whiteTimeLeft, blackTimeLeft, currentTurn });
        console.log('=== GAME ROOM: Data validation ===', {
          whiteTimeLeft: typeof whiteTimeLeft,
          blackTimeLeft: typeof blackTimeLeft,
          currentTurn: typeof currentTurn,
          whiteTimeLeftValue: whiteTimeLeft,
          blackTimeLeftValue: blackTimeLeft,
          currentTurnValue: currentTurn
        });
        
        // Validate data
        if (typeof whiteTimeLeft !== 'number' || typeof blackTimeLeft !== 'number') {
          console.error('Invalid time data received:', data);
          return;
        }
        
        console.log('=== GAME ROOM: Setting timers state ===');
        console.log('Current timers state before update:', timers);
        const newTimers = {
          white: whiteTimeLeft,
          black: blackTimeLeft,
          isRunning: currentTurn === currentPlayerRef.current,
          lastUpdate: Date.now()
        };
        console.log('=== GAME ROOM: New timers state ===', newTimers);
        setTimers(newTimers);
        console.log('=== GAME ROOM: Timers state updated ===');
        
        console.log('=== GAME ROOM: Setting game state ===');
        console.log('Current game state before update:', gameState);
        setGameState(prev => {
          const newGameState = {
            ...prev,
            currentTurn
          };
          console.log('=== GAME ROOM: New game state ===', newGameState);
          return newGameState;
        });
        console.log('=== GAME ROOM: Game state updated ===');
        
        console.log('=== GAME ROOM: Timers updated successfully ===');
      });

      socketService.onTurnUpdate((data) => {
        console.log('=== GAME ROOM: Received turnUpdate ===');
        console.log('Received turnUpdate:', data);
        const { currentTurn } = data;
        console.log('Updating currentTurn:', currentTurn);
        
        // تحديث حالة اللعبة
        setGameState(prev => ({
          ...prev,
          currentTurn
        }));
        
        // تحديث حالة المؤقتات
        setTimers(prev => ({
          ...prev,
          isRunning: currentTurn === currentPlayerRef.current
        }));
        
        console.log('=== GAME ROOM: Turn updated successfully ===');
      });

      socketService.onMoveMade((data) => {
        console.log('=== GAME ROOM: Received moveMade ===');
        console.log('Received moveMade:', data);
        const { san, fen, movedBy, isPhysicalMove, from, to, uci } = data;
        console.log('Handling opponent move:', { san, fen, movedBy, isPhysicalMove, from, to, uci });
        
        // التحقق من أن الحركة ليست من اللاعب الحالي
        if (movedBy === currentPlayerRef.current) {
          console.log('=== GAME ROOM: Move is from current player, ignoring ===');
          return;
        }
        
        handleOpponentMove(san, fen, isPhysicalMove);
        console.log('=== GAME ROOM: Opponent move handled successfully ===');
      });

      socketService.onGameTimeout((data) => {
        console.log('=== GAME ROOM: Received gameTimeout ===');
        console.log('Received gameTimeout:', data);
        const { winner } = data;
        console.log('Handling game timeout, winner:', winner);
        handleGameEnd('timeout');
        console.log('=== GAME ROOM: Game timeout handled successfully ===');
      });

      // THEN join game room
      const urlParams = new URLSearchParams(window.location.search);
      const gameId = urlParams.get('game_id') || urlParams.get('id') || '1';
      console.log('Joining game room:', gameId);
      
      // Join the game room
      console.log('=== GAME ROOM: Joining game room ===');
      socketService.joinGameRoom(gameId);
      console.log('=== GAME ROOM: Join game room request sent ===');

      // إضافة health check للمؤقتات
      const healthCheckInterval = setInterval(() => {
        console.log('=== GAME ROOM: Health check for timers ===');
        console.log('Current timers state:', timers);
        console.log('Current game state:', gameState);
        
        // إذا توقف المؤقتات لأكثر من 10 ثوان، إعادة الانضمام للغرفة
        const lastUpdate = timers.lastUpdate || Date.now();
        const timeSinceLastUpdate = Date.now() - lastUpdate;
        
        if (timeSinceLastUpdate > 10000 && gameState.status === 'active') {
          console.log('=== GAME ROOM: Timers seem frozen, rejoining room ===');
          socketService.leaveGameRoom(gameId);
          setTimeout(() => {
            socketService.joinGameRoom(gameId);
          }, 1000);
        }
      }, 5000); // فحص كل 5 ثوان
      
      return () => {
        clearInterval(healthCheckInterval);
      };
    }

    return () => {
      // Clean up event listeners
      console.log('=== GAME ROOM: Cleaning up WebSocket event listeners ===');
      console.log('Cleaning up WebSocket event listeners');
      socketService.offClockUpdate();
      socketService.offTurnUpdate();
      socketService.offMoveMade();
      socketService.offGameTimeout();
      
      // Leave game room and disconnect
      const urlParams = new URLSearchParams(window.location.search);
      const gameId = urlParams.get('game_id') || urlParams.get('id') || '1';
      console.log('=== GAME ROOM: Leaving game room ===');
      console.log('Leaving game room:', gameId);
      socketService.leaveGameRoom(gameId);
      socketService.disconnect();
      console.log('=== GAME ROOM: WebSocket cleanup completed ===');
    };
  }, [user, currentPlayer]); // إضافة currentPlayer كـ dependency

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    console.log('=== GAME ROOM: Handling move ===');
    console.log('Move data:', { from, to, promotion, currentTurn: gameState.currentTurn, currentPlayer });
    
    // Check if it's player's turn
    if (gameState.currentTurn !== currentPlayer) {
      console.log('=== GAME ROOM: Not player turn ===');
      toast({
        title: "ليس دورك",
        description: "انتظر دورك في اللعب",
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
        // إيقاف عداد اللاعب الحالي فوراً
        console.log('=== GAME ROOM: Stopping current player timer ===');
        setTimers(prev => ({ ...prev, isRunning: false }));
        
        // Update local game state
        setGame(gameCopy);
        
        const newMove: GameMove = {
          moveNumber: Math.floor(gameCopy.history().length / 2) + 1,
          san: move.san,
          fen: gameCopy.fen(),
          [currentPlayer]: move.san
        };

        setMoves(prev => {
          const updated = [...prev];
          const lastMove = updated[updated.length - 1];
          
          if (lastMove && (
            (currentPlayer === 'white' && !lastMove.white) ||
            (currentPlayer === 'black' && !lastMove.black)
          )) {
            updated[updated.length - 1] = { ...lastMove, [currentPlayer]: move.san };
          } else {
            updated.push(newMove);
          }
          return updated;
        });

        // Update local game state (turn will be updated by server)
        setGameState(prev => ({
          ...prev,
          isCheck: gameCopy.inCheck(),
          isCheckmate: gameCopy.isCheckmate(),
          isDraw: gameCopy.isDraw()
        }));

        // Send move to server via WebSocket
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game_id') || urlParams.get('id') || '1';
        
        const moveData = {
          gameId,
          from,
          to,
          promotion: promotion || 'q',
          san: move.san,
          fen: gameCopy.fen(),
          movedBy: currentPlayer
        };
        
        console.log('=== GAME ROOM: Sending move to server ===');
        console.log('Sending move to server:', moveData);
        socketService.sendMove(moveData);
        console.log('=== GAME ROOM: Move sent to server ===');

        // Check for game end conditions
        if (gameCopy.isCheckmate()) {
          handleGameEnd('checkmate');
        } else if (gameCopy.isDraw()) {
          handleGameEnd('draw');
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
  }, [game, gameState.currentTurn, currentPlayer]);

  const handleOpponentMove = (san: string, fen: string, isPhysical = false) => {
    console.log('=== GAME ROOM: Handling opponent move ===');
    console.log('Handling opponent move:', { san, fen, isPhysical });
    
    const gameCopy = new Chess(fen);
    setGame(gameCopy);
    
    // تحديث قائمة الحركات
    const newMove: GameMove = {
      moveNumber: Math.floor(gameCopy.history().length / 2) + 1,
      san: san,
      fen: fen,
      [currentPlayerRef.current === 'white' ? 'black' : 'white']: san
    };

    setMoves(prev => {
      const updated = [...prev];
      const lastMove = updated[updated.length - 1];
      
      if (lastMove && (
        (currentPlayerRef.current === 'black' && !lastMove.white) ||
        (currentPlayerRef.current === 'white' && !lastMove.black)
      )) {
        updated[updated.length - 1] = { ...lastMove, [currentPlayerRef.current === 'white' ? 'black' : 'white']: san };
      } else {
        updated.push(newMove);
      }
      return updated;
    });

    // تحديث حالة اللعبة - تحديث الدور فوراً
    setGameState(prev => ({
      ...prev,
      currentTurn: currentPlayerRef.current, // بعد حركة الخصم يصبح دورك أنت
      isCheck: gameCopy.inCheck(),
      isCheckmate: gameCopy.isCheckmate(),
      isDraw: gameCopy.isDraw()
    }));
    
    if (isPhysical) {
      setIsPhysicalMove(true);
      toast({
        title: "حركة من اللوحة المادية",
        description: "تم تحريك القطعة على اللوحة الفعلية",
      });
      setTimeout(() => setIsPhysicalMove(false), 3000);
    }

    // بدء عداد اللاعب الحالي
    console.log('=== GAME ROOM: Starting current player timer ===');
    setTimers(prev => ({ ...prev, isRunning: true }));
  };

  const handleGameEnd = (reason: string) => {
    console.log('=== GAME ROOM: Handling game end ===');
    console.log('Game ended with reason:', reason);
    
    setTimers(prev => ({ ...prev, isRunning: false }));
    
    // REST: POST /api/games/:id/end
    // Expected: { reason, winner? }
    
    let message = '';
    switch (reason) {
      case 'checkmate':
        message = gameState.currentTurn === currentPlayer ? 'للأسف، خسرت المباراة' : 'مبروك! فزت بالمباراة';
        break;
      case 'timeout':
        message = 'انتهى الوقت';
        break;
      case 'resign':
        message = 'استسلم اللاعب';
        break;
      case 'draw':
        message = 'انتهت المباراة بالتعادل';
        break;
    }

    toast({
      title: "انتهت المباراة",
      description: message,
    });
  };

  const handleResign = () => {
    if (window.confirm('هل أنت متأكد من الاستسلام؟')) {
      console.log('=== GAME ROOM: Player resigned ===');
      console.log('Player resigned');
      // REST: POST /api/games/:id/resign
      // SOCKET: socket.emit('resign', { gameId: gameState.id });
      
      handleGameEnd('resign');
    }
  };

  const handleOfferDraw = () => {
    console.log('=== GAME ROOM: Player offered draw ===');
    console.log('Player offered draw');
    // REST: POST /api/games/:id/offer-draw
    // SOCKET: socket.emit('offerDraw', { gameId: gameState.id });
    
    toast({
      title: "تم إرسال عرض التعادل",
      description: "في انتظار رد الخصم",
    });
  };

  const handleDrawResponse = (accept: boolean) => {
    console.log('=== GAME ROOM: Player responded to draw offer ===');
    console.log('Player responded to draw offer:', accept);
    // REST: POST /api/games/:id/draw-response
    // SOCKET: socket.emit('drawResponse', { gameId: gameState.id, accept });
    
    if (accept) {
      handleGameEnd('draw');
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    console.log('=== GAME ROOM: Sending chat message ===');
    console.log('Sending chat message:', chatInput);

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: players[currentPlayer].id.toString(),
      username: players[currentPlayer].name,
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
    console.log('=== GAME ROOM: Formatting time ===');
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
    console.log(`Formatting time: ${seconds}s -> ${formatted}`);
    console.log('=== GAME ROOM: Formatted time ===', formatted);
    return formatted;
  };

  // دالة لتحديد المؤقت الصحيح حسب اللاعب
  const getPlayerTimer = (playerColor: 'white' | 'black') => {
    if (currentPlayer === 'white') {
      // اللاعب الأبيض يرى المؤقتات كما هي
      return playerColor === 'white' ? timers.white : timers.black;
    } else {
      // اللاعب الأسود يرى المؤقتات معكوسة
      return playerColor === 'white' ? timers.black : timers.white;
    }
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
    console.log('=== GAME ROOM: Formatting move time ===');
    const formatted = timestamp.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    console.log(`Formatting move time: ${timestamp} -> ${formatted}`);
    console.log('=== GAME ROOM: Formatted move time ===', formatted);
    return formatted;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-amiri text-xl font-bold">شطرنج العرب</h1>
              <Badge variant={isConnected ? "secondary" : "destructive"} className="flex items-center gap-1">
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'متصل' : 'منقطع'}
              </Badge>
              {process.env.NODE_ENV === 'development' && (
                <Badge variant="outline" className="text-xs">
                  Debug: {gameState.currentTurn} | {timers.white}s/{timers.black}s
                </Badge>
              )}
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
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              >
                {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Players & Game Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Black Player */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                                     <Avatar>
                     <AvatarImage src="" />
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
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                                     <Avatar>
                     <AvatarImage src="" />
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
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleOfferDraw}
                disabled={gameState.status !== 'active'}
              >
                <Handshake className="w-4 h-4 ml-2" />
                طلب تعادل
              </Button>
            </div>
          </div>

          {/* Chess Board */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="mb-4 text-center">
                <Badge variant="outline" className="mb-2">
                  {gameData?.gameType === 'friend' ? 'لعبة مع صديق' : 
                   gameData?.gameType === 'ranked' ? 'لعبة مصنفة' :
                   gameData?.gameType === 'ai' ? 'لعبة ضد الذكاء الاصطناعي' :
                   gameData?.gameType === 'puzzle' ? 'لغز شطرنج' : 'لعبة شطرنج'}
                </Badge>
                {gameData && (
                  <p className="text-sm text-muted-foreground">
                    بدأت بواسطة: {gameData.startedByUser.name}
                  </p>
                )}
              </div>
              <ChessBoard
                game={game}
                onMove={handleMove}
                orientation={currentPlayer}
                allowMoves={gameState.status === 'active' && gameState.currentTurn === currentPlayer}
              />
            </Card>
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
                    {moves.map((move, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/50">
                        <span className="text-muted-foreground w-6">{move.moveNumber}.</span>
                        {move.white && (
                          <span className="font-mono flex-1">{move.white}</span>
                        )}
                        {move.black && (
                          <span className="font-mono flex-1 text-right">{move.black}</span>
                        )}
                      </div>
                    ))}
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
    </div>
  );
};

export default GameRoom;