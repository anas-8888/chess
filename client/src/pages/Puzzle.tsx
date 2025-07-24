import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ChessBoard from "@/components/ChessBoard";
import { Chess, Square } from "chess.js";
import { 
  Home, 
  Lightbulb, 
  Eye, 
  SkipForward, 
  RotateCcw, 
  Clock, 
  Trophy, 
  Target,
  Star,
  Crown,
  Map,
  Lock,
  CheckCircle2,
  Zap
} from "lucide-react";

const Puzzle = () => {
  const { toast } = useToast();
  const [currentPuzzle, setCurrentPuzzle] = useState<any>(null);
  const [difficulty, setDifficulty] = useState("متوسط");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [showLevelMap, setShowLevelMap] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(new Set([1, 2, 3]));
  const [currentLevel, setCurrentLevel] = useState(1);

  // Mock puzzle data
  const mockPuzzles = [
    {
      id: 1,
      title: "تكتيك الدبوس الأساسي",
      difficulty: "سهل",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: ["e2e4", "e7e5", "Nf3"],
      targetSquare: "e4",
      description: "احم الملكة وهاجم في نفس الوقت",
      points: 5,
      category: "تكتيك",
      stars: 3
    },
    {
      id: 2,
      title: "شوكة الفارس",
      difficulty: "سهل",
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      solution: ["Nf3", "Nc6", "Nxe5"],
      targetSquare: "e5",
      description: "استخدم الفارس لمهاجمة قطعتين",
      points: 5,
      category: "تكتيك",
      stars: 2
    },
    {
      id: 3,
      title: "تكتيك الكشف",
      difficulty: "متوسط",
      fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 3 4",
      solution: ["Ng5", "d6", "Nxf7"],
      targetSquare: "f7",
      description: "اكشف الملك واهاجم نقطة ضعف",
      points: 8,
      category: "تكتيك",
      stars: 3
    },
    {
      id: 4,
      title: "تكتيك الطعم",
      difficulty: "متوسط",
      fen: "rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",
      solution: ["Ng5", "d6", "Nxf7"],
      targetSquare: "f7",
      description: "اطعم قطعة صغيرة لتكسب أكبر",
      points: 10,
      category: "تكتيك",
      stars: 0
    },
    {
      id: 5,
      title: "مات في حركتين",
      difficulty: "صعب",
      fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
      solution: ["Qd8+", "Rxd8", "Nxf7#"],
      targetSquare: "f7",
      description: "مات سريع في حركتين",
      points: 15,
      category: "مات",
      stars: 0
    }
  ];

  const currentPuzzleData = mockPuzzles.find(p => p.id === currentLevel) || mockPuzzles[0];

  useEffect(() => {
    loadPuzzle(currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    if (currentPuzzleData) {
      const chess = new Chess(currentPuzzleData.fen);
      setGame(chess);
    }
  }, [currentPuzzleData]);

  useEffect(() => {
    if (timeLeft > 0 && currentPuzzleData && !showSolution) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentPuzzleData, showSolution]);

  const loadPuzzle = async (level: number) => {
    setIsLoading(true);
    try {
      // REST: GET /api/puzzles/${level} -> fetch puzzle by level
      const puzzle = mockPuzzles.find(p => p.id === level);
      if (puzzle) {
        setCurrentPuzzle(puzzle);
        setTimeLeft(300);
        setShowHint(false);
        setShowSolution(false);
        setHintsUsed(0);
        
        const chess = new Chess(puzzle.fen);
        setGame(chess);
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من تحميل اللغز. حاول مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPuzzleByDifficulty = async (diff: string) => {
    setDifficulty(diff);
    const filteredPuzzles = mockPuzzles.filter(p => p.difficulty === diff);
    if (filteredPuzzles.length > 0) {
      setCurrentLevel(filteredPuzzles[0].id);
    }
  };

  const showHintAction = () => {
    setShowHint(true);
    setHintsUsed(hintsUsed + 1);
    toast({
      title: "تلميح",
      description: "انظر إلى المربع المضيء - هناك تكتيك قوي!"
    });
  };

  const revealSolution = () => {
    setShowSolution(true);
    toast({
      title: "الحل",
      description: "تم عرض الحل. ادرس الحركات بعناية!"
    });
  };

  const submitSolution = async (from: Square, to: Square) => {
    // REST: POST /api/puzzles/${currentPuzzleData.id}/solve -> submit solution
    const timeUsed = 300 - timeLeft;
    const pointsEarned = Math.max(1, currentPuzzleData.points - hintsUsed * 2);
    
    // Mark level as completed
    setCompletedLevels(prev => new Set([...prev, currentLevel]));
    setScore(score + pointsEarned);
    
    toast({
      title: "أحسنت!",
      description: `حصلت على ${pointsEarned} نقطة في ${timeUsed} ثانية`
    });
    
    // Unlock next level if not already unlocked
    if (!completedLevels.has(currentLevel + 1) && currentLevel < mockPuzzles.length) {
      toast({
        title: "مستوى جديد!",
        description: `تم فتح المستوى ${currentLevel + 1}`
      });
    }
  };

  const nextPuzzle = () => {
    if (currentLevel < mockPuzzles.length) {
      setCurrentLevel(currentLevel + 1);
    }
  };

  const selectLevel = (level: number) => {
    if (level === 1 || completedLevels.has(level - 1)) {
      setCurrentLevel(level);
      setShowLevelMap(false);
    } else {
      toast({
        title: "مستوى مقفل",
        description: `أكمل المستوى ${level - 1} لفتح هذا المستوى`,
        variant: "destructive"
      });
    }
  };

  const onMove = (from: Square, to: Square): boolean => {
    try {
      const move = game.move({ from, to });
      if (move) {
        setGame(new Chess(game.fen()));
        // For demo purposes, any valid move "solves" the puzzle
        submitSolution(from, to);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "سهل": return "text-green-500";
      case "صعب": return "text-red-500";
      default: return "text-yellow-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      {/* Header */}
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
                <Target className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">الألغاز التكتيكية</h1>
              </div>
              
              <Button
                onClick={() => setShowLevelMap(true)}
                variant="ghost"
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                خريطة المستويات
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-medium">{score} نقطة</span>
              </div>
              <Select value={difficulty} onValueChange={loadPuzzleByDifficulty}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="سهل">سهل</SelectItem>
                  <SelectItem value="متوسط">متوسط</SelectItem>
                  <SelectItem value="صعب">صعب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground">جاري تحميل اللغز...</p>
            </div>
          </div>
        ) : currentPuzzleData ? (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Puzzle Board */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="aspect-square max-w-lg mx-auto">
                  <ChessBoard
                    game={game}
                    onMove={onMove}
                    orientation="white"
                    allowMoves={true}
                  />
                  
                  {showHint && currentPuzzleData.targetSquare && (
                    <div className="mt-2 text-center text-sm text-muted-foreground">
                      تلميح: انظر إلى المربع {currentPuzzleData.targetSquare}
                    </div>
                  )}
                </div>

                {/* Solution Moves */}
                {showSolution && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 font-cairo">الحل:</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentPuzzleData.solution.map((move: string, index: number) => (
                        <Badge key={index} variant="outline">
                          {index + 1}. {move}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Info Panel */}
            <div className="space-y-6">
              {/* Puzzle Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-cairo">{currentPuzzleData.title}</CardTitle>
                    <Badge className={getDifficultyColor(currentPuzzleData.difficulty)}>
                      {currentPuzzleData.difficulty}
                    </Badge>
                  </div>
                  <CardDescription>{currentPuzzleData.description}</CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground">المستوى {currentLevel}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((star) => (
                        <Star 
                          key={star}
                          className={`h-4 w-4 ${
                            star <= (completedLevels.has(currentLevel) ? currentPuzzleData.stars : 0)
                              ? 'text-yellow-500 fill-yellow-500' 
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الوقت المتبقي</span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-mono">{formatTime(timeLeft)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">النقاط</span>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{currentPuzzleData.points - hintsUsed * 2}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">التلميحات المستخدمة</span>
                    <span>{hintsUsed}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Button 
                    onClick={showHintAction}
                    disabled={showHint}
                    variant="elegant"
                    className="w-full"
                  >
                    <Lightbulb className="ml-2 h-4 w-4" />
                    {showHint ? "تم عرض التلميح" : "تلميح"}
                  </Button>

                  <Button 
                    onClick={revealSolution}
                    disabled={showSolution}
                    variant="outline"
                    className="w-full"
                  >
                    <Eye className="ml-2 h-4 w-4" />
                    {showSolution ? "تم عرض الحل" : "عرض الحل"}
                  </Button>

                  <Separator />

                  <Button onClick={nextPuzzle} variant="chess" className="w-full">
                    <SkipForward className="ml-2 h-4 w-4" />
                    اللغز التالي
                  </Button>

                  <Button onClick={() => loadPuzzle(currentLevel)} variant="ghost" className="w-full">
                    <RotateCcw className="ml-2 h-4 w-4" />
                    إعادة تحميل
                  </Button>
                </CardContent>
              </Card>

              {/* Daily Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo text-lg">إحصائيات اليوم</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">الألغاز المحلولة</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">نسبة النجاح</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">أفضل وقت</span>
                    <span className="font-medium">1:23</span>
                  </div>
                </CardContent>
              </Card>

              {/* Leaderboard Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo text-lg">المتصدرون اليوم</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { name: "أحمد محمد", score: 150, rank: 1 },
                    { name: "سارة أحمد", score: 120, rank: 2 },
                    { name: "محمد علي", score: 95, rank: 3 }
                  ].map((player) => (
                    <div key={player.rank} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        <span className="text-sm">{player.name}</span>
                      </div>
                      <span className="text-sm font-medium">{player.score}</span>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full mt-3">
                    عرض الترتيب الكامل
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 font-cairo">لا توجد ألغاز متاحة</h3>
            <p className="text-muted-foreground mb-4">حاول تحديث الصفحة أو اختر صعوبة مختلفة</p>
            <Button onClick={() => loadPuzzle(1)} variant="chess">
              تحميل لغز جديد
            </Button>
          </div>
        )}
        
        {/* Level Map Dialog */}
        <Dialog open={showLevelMap} onOpenChange={setShowLevelMap}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-cairo">خريطة المستويات</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 p-4">
              {/* S-shaped level path */}
              <div className="relative">
                <svg className="w-full h-96" viewBox="0 0 800 300" fill="none">
                  {/* Path line */}
                  <path
                    d="M 50 250 Q 150 250 200 200 Q 250 150 350 150 Q 450 150 500 100 Q 550 50 650 50 Q 700 50 750 100"
                    stroke="hsl(var(--border))"
                    strokeWidth="3"
                    fill="none"
                    className="opacity-30"
                  />
                  
                  {/* Completed path */}
                  <path
                    d="M 50 250 Q 150 250 200 200 Q 250 150 350 150 Q 450 150 500 100 Q 550 50 650 50 Q 700 50 750 100"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    fill="none"
                    className="opacity-60"
                    strokeDasharray="1200"
                    strokeDashoffset={1200 - (completedLevels.size / mockPuzzles.length) * 1200}
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                  />
                </svg>
                
                {/* Level nodes */}
                {mockPuzzles.map((puzzle, index) => {
                  const positions = [
                    { x: 50, y: 250 },   // Level 1
                    { x: 200, y: 200 },  // Level 2  
                    { x: 350, y: 150 },  // Level 3
                    { x: 500, y: 100 },  // Level 4
                    { x: 650, y: 50 }    // Level 5
                  ];
                  
                  const position = positions[index] || { x: 50, y: 250 };
                  const isUnlocked = puzzle.id === 1 || completedLevels.has(puzzle.id - 1);
                  const isCompleted = completedLevels.has(puzzle.id);
                  const isCurrent = currentLevel === puzzle.id;
                  
                  return (
                    <div
                      key={puzzle.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: position.x, top: position.y }}
                    >
                      <Button
                        onClick={() => selectLevel(puzzle.id)}
                        disabled={!isUnlocked}
                        className={`relative w-16 h-16 rounded-full p-0 ${
                          isCurrent 
                            ? 'bg-primary text-primary-foreground animate-pulse ring-4 ring-primary/30' 
                            : isCompleted 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : isUnlocked 
                            ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : !isUnlocked ? (
                          <Lock className="h-6 w-6" />
                        ) : (
                          <span className="text-lg font-bold">{puzzle.id}</span>
                        )}
                        
                        {/* Stars for completed levels */}
                        {isCompleted && (
                          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {[1, 2, 3].map((star) => (
                              <Star 
                                key={star}
                                className={`h-2 w-2 ${
                                  star <= puzzle.stars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Level info tooltip */}
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center">
                          <div className="bg-card border rounded-lg p-2 shadow-lg min-w-max">
                            <div className="text-xs font-medium">{puzzle.title}</div>
                            <div className="text-xs text-muted-foreground">{puzzle.difficulty}</div>
                            <div className="text-xs text-primary">{puzzle.points} نقطة</div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>مكتمل</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
                  <span>حالي</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-secondary rounded-full"></div>
                  <span>متاح</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted rounded-full"></div>
                  <span>مقفل</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Puzzle;