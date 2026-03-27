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
import { useLocation, useNavigate } from 'react-router-dom';
import { userService } from '@/services/userService';

const AILoading = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingText, setLoadingText] = useState('جاري تهيئة جلسة اللعب...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const tasks: Array<{
      startText: string;
      doneText: string;
      run: () => Promise<unknown>;
    }> = [
      {
        startText: 'جاري تحميل صفحة اللعب...',
        doneText: 'تم تجهيز واجهة اللعب.',
        run: async () => {
          await import('./AIGame');
        },
      },
      {
        startText: 'جاري فحص المباراة الجارية...',
        doneText: 'تم جلب حالة الجلسة الحالية.',
        run: async () => {
          await userService.getActiveAiGameSession().catch(() => null);
        },
      },
      {
        startText: 'جاري تحميل محرك الشطرنج...',
        doneText: 'تم تجهيز محرك الشطرنج.',
        run: async () => {
          await import('chess.js');
        },
      },
    ];

    let completed = 0;
    const total = tasks.length;

    const markProgress = (text: string) => {
      completed += 1;
      if (cancelled) return;
      setLoadingText(text);
      setProgress((completed / total) * 100);

      if (completed >= total) {
        setLoadingText('كل شيء جاهز!');
        navigate(`/ai-game${location.search || ''}`, { replace: true });
      }
    };

    tasks.forEach((task) => {
      if (cancelled) return;
      setLoadingText(task.startText);
      task
        .run()
        .then(() => markProgress(task.doneText))
        .catch(() => markProgress('تم تجاوز خطوة غير حرجة...'));
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, location.search]);

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
            <div className="text-center">
              <div className="mb-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
              <p className="text-muted-foreground animate-pulse">
                {loadingText}
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>

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
