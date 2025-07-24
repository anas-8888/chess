import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Home, 
  Users, 
  Zap, 
  Bot, 
  Settings, 
  Clock, 
  Play,
  Crown,
  Globe
} from "lucide-react";

const PlayPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedTime, setSelectedTime] = useState("10");
  const [isSearching, setIsSearching] = useState(false);
  const [physicalBoard, setPhysicalBoard] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pendingGameMode, setPendingGameMode] = useState<string | null>(null);

  const timeControls = [
    { value: "1", label: "1 دقيقة", icon: "⚡" },
    { value: "3", label: "3 دقائق", icon: "🔥" },
    { value: "5", label: "5 دقائق", icon: "⭐" },
    { value: "10", label: "10 دقائق", icon: "🎯" },
    { value: "15", label: "15 دقيقة", icon: "👑" },
    { value: "30", label: "30 دقيقة", icon: "🧠" }
  ];

  const playModes = [
    {
      id: "friend",
      title: "العب مع صديق",
      description: "ادع أصدقاءك للعب معك",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      action: () => navigate("/friends")
    },
    {
      id: "random",
      title: "خصم عشوائي",
      description: "ابحث عن خصم في نفس مستواك",
      icon: Zap,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      action: () => startGameMode("random")
    },
    {
      id: "ai",
      title: "ضد الذكاء الاصطناعي",
      description: "تحدى الكمبيوتر",
      icon: Bot,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      action: () => startGameMode("ai")
    }
  ];

  const recentGameSettings = [
    { opponent: "أحمد محمد", time: "10", result: "فوز", rating: "+12" },
    { opponent: "سارة أحمد", time: "5", result: "تعادل", rating: "+3" },
    { opponent: "محمد علي", time: "15", result: "خسارة", rating: "-8" }
  ];

  const findRandomOpponent = async () => {
    setIsSearching(true);
    try {
      // REST: POST /api/games/queue -> join matchmaking queue
      const queueData = {
        timeControl: selectedTime,
        physicalBoard: physicalBoard,
        rating: 1200 // user's current rating
      };
      
      toast({
        title: "البحث عن خصم",
        description: `جاري البحث عن خصم لمباراة ${selectedTime} دقائق...`
      });

      // Simulate search time
      setTimeout(() => {
        // SOCKET: socket.on('matchFound', (gameData) => {
        //   navigate(`/game?id=${gameData.gameId}`);
        // });
        
        // Mock: redirect to game after 3 seconds
        navigate("/game?id=demo_game_123");
      }, 3000);

    } catch (error) {
      toast({
        title: "خطأ",
        description: "لم نتمكن من العثور على خصم. حاول مرة أخرى.",
        variant: "destructive"
      });
      setIsSearching(false);
    }
  };

  const cancelSearch = () => {
    setIsSearching(false);
    // REST: DELETE /api/games/queue -> leave matchmaking queue
    toast({
      title: "تم إلغاء البحث",
      description: "تم إلغاء البحث عن خصم"
    });
  };

  const startGameMode = (mode: string) => {
    setPendingGameMode(mode);
    setShowModeDialog(true);
  };

  const confirmGameMode = (usePhysical: boolean) => {
    setPhysicalBoard(usePhysical);
    setShowModeDialog(false);
    
    if (pendingGameMode === "random") {
      findRandomOpponent();
    } else if (pendingGameMode === "ai") {
      // SOCKET: emit('startAIGame', { physicalMode: usePhysical, timeControl: selectedTime });
      navigate("/game?mode=ai&physical=" + usePhysical);
    }
    setPendingGameMode(null);
  };

  const quickPlay = (timeControl: string) => {
    setSelectedTime(timeControl);
    startGameMode("random");
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
                <Play className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">اختر نوع اللعب</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">1,234 لاعب متصل</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {isSearching ? (
          /* Searching State */
          <div className="max-w-md mx-auto">
            <Card className="text-center p-8">
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold font-cairo">البحث عن خصم</h3>
                  <p className="text-muted-foreground">
                    جاري البحث عن لاعب في نفس مستواك لمباراة {selectedTime} دقائق
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">وقت الانتظار المتوقع: أقل من دقيقة</div>
                  <Button onClick={cancelSearch} variant="outline" className="w-full">
                    إلغاء البحث
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Play Modes */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Play Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">لعب سريع</CardTitle>
                  <CardDescription>اختر الوقت واللعب فوراً</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {timeControls.map((time) => (
                      <Button
                        key={time.value}
                        onClick={() => quickPlay(time.value)}
                        variant="elegant"
                        className="h-16 flex-col gap-1"
                      >
                        <span className="text-lg">{time.icon}</span>
                        <span className="text-sm">{time.label}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Play Modes */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold font-cairo">أنواع اللعب</h2>
                <div className="grid gap-4">
                  {playModes.map((mode) => (
                    <Card 
                      key={mode.id}
                      className={`cursor-pointer hover:shadow-card transition-all duration-300 ${
                        mode.disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={mode.disabled ? undefined : mode.action}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg ${mode.bgColor} flex items-center justify-center`}>
                            <mode.icon className={`h-6 w-6 ${mode.color}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold font-cairo">{mode.title}</h3>
                            <p className="text-sm text-muted-foreground">{mode.description}</p>
                          </div>
                          {mode.disabled && (
                            <Badge variant="outline">قريباً</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings & History */}
            <div className="space-y-6">
              {/* Game Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    إعدادات المباراة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">التحكم في الوقت</label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeControls.map((time) => (
                          <SelectItem key={time.value} value={time.value}>
                            {time.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">اللوحة المادية</label>
                      <p className="text-xs text-muted-foreground">
                        استخدم لوحة الشطرنج المادية الذكية
                      </p>
                    </div>
                    <Button
                      variant={physicalBoard ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPhysicalBoard(!physicalBoard)}
                    >
                      {physicalBoard ? "مفعل" : "معطل"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Games */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-cairo">المباريات الأخيرة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentGameSettings.map((game, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{game.opponent}</div>
                        <div className="text-xs text-muted-foreground">
                          {game.time} دقائق
                        </div>
                      </div>
                      <div className="text-left space-y-1">
                        <Badge 
                          variant={game.result === "فوز" ? "default" : 
                                  game.result === "تعادل" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {game.result}
                        </Badge>
                        <div className={`text-xs ${
                          game.rating.startsWith('+') ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {game.rating}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <Button variant="ghost" size="sm" className="w-full">
                    عرض جميع المباريات
                  </Button>
                </CardContent>
              </Card>

              {/* Current Rating */}
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="space-y-2">
                    <Crown className="h-8 w-8 text-primary mx-auto" />
                    <div className="text-sm text-muted-foreground">تقييمك الحالي</div>
                    <div className="text-2xl font-bold text-primary">1,247</div>
                    <div className="text-xs text-green-500">+15 هذا الأسبوع</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        {/* Game Mode Dialog */}
        <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-cairo">اختر طريقة اللعب</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                هل تريد اللعب عبر الهاتف أم عبر اللوحة المادية؟
              </p>
              
              <div className="grid gap-3">
                <Button
                  onClick={() => confirmGameMode(false)}
                  variant="chess"
                  className="h-16 flex-col gap-2"
                >
                  <span className="text-2xl">📱</span>
                  <span>الهاتف</span>
                </Button>
                
                <Button
                  onClick={() => confirmGameMode(true)}
                  variant="elegant"
                  className="h-16 flex-col gap-2"
                >
                  <span className="text-2xl">♟️</span>
                  <span>اللوحة المادية</span>
                </Button>
              </div>
              
              <Button
                onClick={() => setShowModeDialog(false)}
                variant="ghost"
                className="w-full"
              >
                إلغاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PlayPage;