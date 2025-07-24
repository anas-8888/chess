import React, { useState, useEffect, useCallback } from 'react';
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

interface Player {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  color: 'white' | 'black';
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
  const [game, setGame] = useState(new Chess());
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
      id: 'user1',
      username: 'أحمد الشطرنجي',
      avatar: '',
      rating: 1450,
      color: 'white'
    },
    black: {
      id: 'user2', 
      username: 'فاطمة الاستراتيجية',
      avatar: '',
      rating: 1380,
      color: 'black'
    }
  });

  const [currentPlayer] = useState<'white' | 'black'>('white'); // Which color the current user is playing
  const [timers, setTimers] = useState({
    white: 600, // 10 minutes in seconds
    black: 600,
    isRunning: true
  });

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

  // Game state recovery on page load
  useEffect(() => {
    const gameId = new URLSearchParams(window.location.search).get('game_id');
    if (gameId) {
      // REST: GET /api/games/:id -> fetch complete game state
      // Expected response: { 
      //   game: { id, status, currentTurn, whiteTime, blackTime },
      //   players: { white: Player, black: Player },
      //   moves: GameMove[],
      //   chat: ChatMessage[]
      // }
      
      // SOCKET: socket.emit('rejoin_game', { gameId, userId })
      // SOCKET: socket.on('game_state', (data) => {
      //   // Restore complete game state including timers
      // })
    }
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

  // Timer countdown
  useEffect(() => {
    if (!timers.isRunning) return;

    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        if (gameState.currentTurn === 'white' && newTimers.white > 0) {
          newTimers.white--;
        } else if (gameState.currentTurn === 'black' && newTimers.black > 0) {
          newTimers.black--;
        }

        // Check for time out
        if (newTimers.white === 0 || newTimers.black === 0) {
          // REST: POST /api/games/:id/timeout
          handleGameEnd('timeout');
        }

        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timers.isRunning, gameState.currentTurn]);

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

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from,
        to,
        promotion: promotion || 'q'
      });

      if (move) {
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

        // Update game state
        setGameState(prev => ({
          ...prev,
          currentTurn: currentPlayer === 'white' ? 'black' : 'white',
          isCheck: gameCopy.inCheck(),
          isCheckmate: gameCopy.isCheckmate(),
          isDraw: gameCopy.isDraw()
        }));

        // Send move to server
        // REST: POST /api/games/:id/move
        // Expected: { from, to, promotion?, san, fen }
        
        // SOCKET: socket.emit('move', {
        //   gameId: gameState.id,
        //   from, to, promotion,
        //   san: move.san,
        //   fen: gameCopy.fen()
        // });

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
    const gameCopy = new Chess(fen);
    setGame(gameCopy);
    
    if (isPhysical) {
      setIsPhysicalMove(true);
      toast({
        title: "حركة من اللوحة المادية",
        description: "تم تحريك القطعة على اللوحة الفعلية",
      });
      setTimeout(() => setIsPhysicalMove(false), 3000);
    }

    // Update moves list and game state...
  };

  const handleGameEnd = (reason: string) => {
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
      // REST: POST /api/games/:id/resign
      // SOCKET: socket.emit('resign', { gameId: gameState.id });
      
      handleGameEnd('resign');
    }
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
      handleGameEnd('draw');
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: players[currentPlayer].id,
      username: players[currentPlayer].username,
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMoveTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
                    <AvatarImage src={players.black.avatar} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {players.black.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{players.black.username}</h3>
                    <Badge variant="outline" className="text-xs">
                      {players.black.rating}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className={`text-2xl font-mono font-bold ${
                    gameState.currentTurn === 'black' ? 'text-primary animate-pulse' : 'text-muted-foreground'
                  }`}>
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(timers.black)}
                  </div>
                  {gameState.currentTurn === 'black' && (
                    <Badge variant="default" className="bg-gradient-primary">
                      دوره
                    </Badge>
                  )}
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
              </CardContent>
            </Card>

            {/* White Player */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={players.white.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {players.white.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-cairo font-medium">{players.white.username}</h3>
                    <Badge variant="outline" className="text-xs">
                      {players.white.rating}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className={`text-2xl font-mono font-bold ${
                    gameState.currentTurn === 'white' ? 'text-primary animate-pulse' : 'text-muted-foreground'
                  }`}>
                    <Clock className="w-4 h-4 inline ml-2" />
                    {formatTime(timers.white)}
                  </div>
                  {gameState.currentTurn === 'white' && (
                    <Badge variant="default" className="bg-gradient-primary">
                      دوره
                    </Badge>
                  )}
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
                          : msg.userId === players[currentPlayer].id 
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
                            ? msg.userId === players[currentPlayer].id 
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