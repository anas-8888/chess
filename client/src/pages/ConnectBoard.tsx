import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Home, 
  Smartphone, 
  QrCode, 
  Wifi, 
  WifiOff,
  CheckCircle,
  AlertCircle,
  Cable
} from "lucide-react";

const ConnectBoard = () => {
  const { toast } = useToast();
  const [connectionMethod, setConnectionMethod] = useState<"qr" | "serial" | null>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [boardInfo, setBoardInfo] = useState<any>(null);

  const connectViaQR = () => {
    setConnectionStatus("connecting");
    // SOCKET: socket.emit('scanQR', { deviceId: 'user_device_id' });
    
    toast({
      title: "مسح رمز QR",
      description: "جاري البحث عن اللوحة المادية..."
    });

    // Simulate connection
    setTimeout(() => {
      setConnectionStatus("connected");
      setBoardInfo({
        model: "SmartChess Pro",
        version: "2.1.4",
        battery: 85,
        serialNumber: "SCH-2024-001"
      });
      
      toast({
        title: "تم الاتصال بنجاح!",
        description: "تم ربط اللوحة المادية بحسابك"
      });
    }, 3000);
  };

  const connectViaSerial = () => {
    if (!serialNumber.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال الرقم التسلسلي للوحة",
        variant: "destructive"
      });
      return;
    }

    setConnectionStatus("connecting");
    // REST: POST /api/boards/connect -> { serialNumber }
    
    toast({
      title: "جاري الاتصال",
      description: `البحث عن اللوحة ${serialNumber}...`
    });

    // Simulate connection
    setTimeout(() => {
      if (serialNumber === "SCH-2024-001") {
        setConnectionStatus("connected");
        setBoardInfo({
          model: "SmartChess Pro",
          version: "2.1.4",
          battery: 85,
          serialNumber: serialNumber
        });
        
        toast({
          title: "تم الاتصال بنجاح!",
          description: "تم ربط اللوحة المادية بحسابك"
        });
      } else {
        setConnectionStatus("disconnected");
        toast({
          title: "فشل الاتصال",
          description: "لم يتم العثور على اللوحة. تحقق من الرقم التسلسلي.",
          variant: "destructive"
        });
      }
    }, 2000);
  };

  const disconnect = () => {
    setConnectionStatus("disconnected");
    setBoardInfo(null);
    // SOCKET: socket.emit('disconnectBoard');
    
    toast({
      title: "تم قطع الاتصال",
      description: "تم فصل اللوحة المادية"
    });
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "connecting":
        return <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />;
      default:
        return <WifiOff className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "متصل";
      case "connecting":
        return "جاري الاتصال...";
      default:
        return "غير متصل";
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
                <Cable className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">ربط اللوحة المادية</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {connectionStatus === "connected" && boardInfo ? (
          /* Connected State */
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="font-cairo text-green-800">تم الاتصال بنجاح!</CardTitle>
                <CardDescription className="text-green-600">
                  لوحة الشطرنج المادية متصلة وجاهزة للاستخدام
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">الموديل</div>
                    <div className="font-semibold">{boardInfo.model}</div>
                  </div>
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">الإصدار</div>
                    <div className="font-semibold">{boardInfo.version}</div>
                  </div>
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">البطارية</div>
                    <div className="font-semibold text-green-600">{boardInfo.battery}%</div>
                  </div>
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">الرقم التسلسلي</div>
                    <div className="font-semibold">{boardInfo.serialNumber}</div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={disconnect} variant="outline" className="flex-1">
                    قطع الاتصال
                  </Button>
                  <Link to="/play" className="flex-1">
                    <Button variant="chess" className="w-full">
                      ابدأ اللعب
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Connection Methods */
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2 font-cairo">اختر طريقة الاتصال</h2>
              <p className="text-muted-foreground">
                اربط لوحة الشطرنج المادية الذكية بحسابك لتجربة لعب فريدة
              </p>
            </div>

            {!connectionMethod ? (
              /* Method Selection */
              <div className="grid md:grid-cols-2 gap-6">
                <Card 
                  className="cursor-pointer hover:shadow-card transition-all duration-300"
                  onClick={() => setConnectionMethod("qr")}
                >
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <QrCode className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 font-cairo">مسح رمز QR</h3>
                    <p className="text-muted-foreground mb-4">
                      استخدم كاميرا هاتفك لمسح رمز QR الموجود على اللوحة
                    </p>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      الطريقة الأسرع
                    </Badge>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-card transition-all duration-300"
                  onClick={() => setConnectionMethod("serial")}
                >
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Smartphone className="h-8 w-8 text-secondary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 font-cairo">الرقم التسلسلي</h3>
                    <p className="text-muted-foreground mb-4">
                      أدخل الرقم التسلسلي الموجود أسفل اللوحة يدوياً
                    </p>
                    <Badge variant="outline">
                      للاتصال اليدوي
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            ) : connectionMethod === "qr" ? (
              /* QR Scanner */
              <div className="max-w-md mx-auto">
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="font-cairo">مسح رمز QR</CardTitle>
                    <CardDescription>
                      وجه كاميرا هاتفك نحو رمز QR الموجود على اللوحة
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* QR Code Placeholder */}
                    <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                      <div className="text-center space-y-2">
                        {connectionStatus === "connecting" ? (
                          <>
                            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                            <p className="text-sm text-muted-foreground">جاري البحث...</p>
                          </>
                        ) : (
                          <>
                            <QrCode className="h-12 w-12 text-muted-foreground mx-auto" />
                            <p className="text-sm text-muted-foreground">
                              اضغط "بدء المسح" لتشغيل الكاميرا
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        onClick={connectViaQR}
                        disabled={connectionStatus === "connecting"}
                        variant="chess" 
                        className="w-full"
                      >
                        {connectionStatus === "connecting" ? "جاري المسح..." : "بدء المسح"}
                      </Button>
                      
                      <Button 
                        onClick={() => setConnectionMethod(null)}
                        variant="ghost" 
                        className="w-full"
                      >
                        العودة للخيارات
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Serial Number Input */
              <div className="max-w-md mx-auto">
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="font-cairo">أدخل الرقم التسلسلي</CardTitle>
                    <CardDescription>
                      ستجد الرقم التسلسلي أسفل اللوحة (مثال: SCH-2024-001)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">الرقم التسلسلي</label>
                      <Input
                        placeholder="SCH-2024-XXX"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        className="text-center font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        الرقم التسلسلي يبدأ بـ SCH ويحتوي على 11 رمز
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        onClick={connectViaSerial}
                        disabled={connectionStatus === "connecting" || !serialNumber.trim()}
                        variant="chess" 
                        className="w-full"
                      >
                        {connectionStatus === "connecting" ? "جاري الاتصال..." : "اتصال"}
                      </Button>
                      
                      <Button 
                        onClick={() => setConnectionMethod(null)}
                        variant="ghost" 
                        className="w-full"
                      >
                        العودة للخيارات
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Help Section */}
            <Card className="mt-8 bg-muted/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-semibold font-cairo">تحتاج مساعدة؟</h4>
                    <p className="text-sm text-muted-foreground">
                      إذا واجهت مشكلة في الاتصال، تأكد من أن اللوحة مشحونة ومشغلة، 
                      وأن هاتفك متصل بالإنترنت. يمكنك أيضاً إعادة تشغيل اللوحة والمحاولة مرة أخرى.
                    </p>
                    <Button variant="ghost" size="sm">
                      دليل الاستخدام التفصيلي
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectBoard;