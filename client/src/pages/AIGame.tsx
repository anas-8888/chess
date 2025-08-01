import React, { useState, useEffect, useCallback } from 'react';
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

const AIGame = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
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
  const [aiThinking, setAiThinking] = useState(false);
  const [gameTime, setGameTime] = useState({
    white: 600, // 10 minutes
    black: 600,
    isRunning: true,
    lastUpdate: Date.now()
  });

  // AI Player configuration
  const [aiPlayer] = useState<AIPlayer>({
    name: 'الذكاء الاصطناعي',
    rating: 1500,
    color: 'black',
    avatar: '/ai-avatar.png'
  });

  // Human Player configuration
  const [humanPlayer] = useState<AIPlayer>({
    name: user?.username || 'اللاعب',
    rating: user?.rating || 1200,
    color: 'white',
    avatar: user?.avatar || ''
  });

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
          
          // Handle timeout directly
          setGameState(prev => ({
            ...prev,
            status: 'finished',
            winner: winner
          }));
          
          toast({
            title: "انتهت المباراة",
            description: `فاز ${winner === playerColor ? 'أنت' : 'الذكاء الاصطناعي'} بالوقت`,
          });
          
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
  }, [gameTime.isRunning, gameState.currentTurn, playerColor, toast]);

  const handleGameEnd = useCallback((data: { reason: string; winner?: string }) => {
    const { reason, winner } = data;
    
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      winner: winner || null
    }));
    
    setGameTime(prev => ({
      ...prev,
      isRunning: false
    }));

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
  }, [playerColor, toast]);

  // Simple AI move generation
  const generateAIMove = useCallback(async () => {
    if (gameState.currentTurn !== aiPlayer.color || gameState.status !== 'active') {
      return;
    }

    setAiThinking(true);
    
    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
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
      const movesToEvaluate = Math.min(10, possibleMoves.length);
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
  }, [game, gameState, aiPlayer.color, playerColor, handleGameEnd, toast]);

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (gameState.currentTurn === aiPlayer.color && gameState.status === 'active' && !aiThinking) {
      generateAIMove();
    }
  }, [gameState.currentTurn, gameState.status, aiThinking, generateAIMove]);

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
  }, [game, gameState, playerColor, aiPlayer.color, handleGameEnd, toast]);

  const handleResign = () => {
    const winner = playerColor === 'white' ? 'black' : 'white';
    handleGameEnd({ reason: 'resign', winner });
  };

  const handleNewGame = () => {
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
      isRunning: true,
      lastUpdate: Date.now()
    });
    setAiThinking(false);
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
              {aiThinking && (
                <Badge variant="outline" className="bg-primary/10 text-primary animate-pulse">
                  <Brain className="w-3 h-3 ml-1" />
                  يفكر...
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
                    <AvatarImage src={aiPlayer.avatar} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      <Brain className="w-4 h-4" />
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
                  <span>دور اللعب:</span>
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
                    <AvatarImage src={humanPlayer.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="w-4 h-4" />
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
                {aiThinking && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    الذكاء الاصطناعي يفكر...
                  </p>
                )}
              </div>
              <ChessBoard
                game={game}
                onMove={handleMove}
                orientation={playerColor}
                allowMoves={gameState.status === 'active' && gameState.currentTurn === playerColor && !aiThinking}
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
                  onClick={handleNewGame}
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
    </div>
  );
};

export default AIGame; 