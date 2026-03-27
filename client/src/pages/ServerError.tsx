import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";

const ServerError = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/95 p-8 text-center shadow-elegant">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <p className="text-6xl font-black text-destructive/90 leading-none">500</p>
        <h1 className="mt-4 text-3xl font-cairo font-bold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-muted-foreground">
          تعذر إكمال العملية حالياً. يمكنك إعادة المحاولة أو العودة للوحة التحكم.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="destructive"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            إعادة تحميل الصفحة
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            العودة إلى لوحة التحكم
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServerError;

