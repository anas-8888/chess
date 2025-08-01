import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Crown, 
  Trophy, 
  Clock,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AILoading = () => {
  const navigate = useNavigate();
  const [loadingText, setLoadingText] = useState('جاري تحضير الذكاء الاصطناعي...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadingSteps = [
      'جاري تحضير الذكاء الاصطناعي...',
      'جاري تحميل استراتيجيات اللعب...',
      'جاري تحضير لوحة الشطرنج...',
      'جاري إعداد المؤقتات...',
      'كل شيء جاهز!'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length) {
        setLoadingText(loadingSteps[currentStep]);
        setProgress((currentStep + 1) * (100 / loadingSteps.length));
        currentStep++;
      } else {
        clearInterval(interval);
        // Navigate to AI game after loading is complete
        setTimeout(() => {
          navigate('/ai-game');
        }, 1000);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <CardHeader className="text-center pb-6">
            <div className="mb-6">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full animate-pulse"></div>
                <div className="absolute inset-2 bg-background rounded-full flex items-center justify-center">
                  <Brain className="w-12 h-12 text-primary animate-bounce" />
                </div>
              </div>
            </div>
            
            <CardTitle className="text-2xl font-amiri mb-2">
              اللعب ضد الذكاء الاصطناعي
            </CardTitle>
            
            <div className="space-y-4">
              <Badge variant="outline" className="text-sm">
                <Trophy className="w-3 h-3 ml-1" />
                مستوى الذكاء الاصطناعي: 1500
              </Badge>
              
              <Badge variant="outline" className="text-sm">
                <Clock className="w-3 h-3 ml-1" />
                وقت اللعب: 10 دقائق
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Loading Animation */}
            <div className="text-center">
              <div className="mb-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
              <p className="text-muted-foreground animate-pulse">
                {loadingText}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* Progress Percentage */}
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>

            {/* Features List */}
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" />
                <span>ذكاء اصطناعي متقدم</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-secondary" />
                <span>تحليل استراتيجي للحركات</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-accent" />
                <span>مستوى صعوبة قابل للتعديل</span>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="w-4 h-4 ml-2" />
                إلغاء والعودة للوحة التحكم
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AILoading; 