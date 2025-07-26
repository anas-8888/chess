import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Zap, Trophy, Globe, Puzzle, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import chessHero from "@/assets/chess-hero.jpg";

const Index = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground font-cairo">شطرنج ذكي</h1>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                // Show dashboard button for authenticated users
                <Link to="/dashboard">
                  <Button variant="chess" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    لوحة التحكم
                  </Button>
                </Link>
              ) : (
                // Show login and register buttons for non-authenticated users
                <>
                  <Link to="/auth?tab=login">
                    <Button variant="ghost">تسجيل دخول</Button>
                  </Link>
                  <Link to="/auth?tab=register">
                    <Button variant="chess">انضم الآن</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-primary border-primary">
                  <Zap className="ml-2 h-4 w-4" />
                  منصة الشطرنج العربية الذكية
                </Badge>
                <h2 className="text-4xl lg:text-6xl font-bold text-foreground font-cairo leading-tight">
                  العب الشطرنج
                  <span className="text-primary block">بطريقة جديدة</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg">
                  منصة شطرنج عربية حديثة تدعم اللعب المباشر، الألغاز التكتيكية، واللوحة المادية الذكية
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/play">
                  <Button size="lg" variant="chess" className="w-full sm:w-auto">
                    <Crown className="ml-2 h-5 w-5" />
                    ابدأ اللعب الآن
                  </Button>
                </Link>
                <Link to="/puzzle">
                  <Button size="lg" variant="elegant" className="w-full sm:w-auto">
                    <Puzzle className="ml-2 h-5 w-5" />
                    حل الألغاز
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden shadow-elegant">
                <img 
                  src={chessHero} 
                  alt="لوحة شطرنج ذكية" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h3 className="text-3xl font-bold text-foreground font-cairo">ميزات المنصة</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              تجربة شطرنج متكاملة تجمع بين التقنية الحديثة والتصميم العربي الأنيق
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-border hover:shadow-card transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-cairo">لعب مباشر</CardTitle>
                <CardDescription>
                  العب مع الأصدقاء أو خصوم عشوائيين في الوقت الفعلي
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border hover:shadow-card transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Puzzle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-cairo">ألغاز تكتيكية</CardTitle>
                <CardDescription>
                  تحسين مهاراتك مع مئات الألغاز والتمارين اليومية
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border hover:shadow-card transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-cairo">لوحة مادية ذكية</CardTitle>
                <CardDescription>
                  ربط لوحة الشطرنج المادية بالمنصة الرقمية
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 شطرنج ذكي. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;