import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass, Crown } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/95 p-8 text-center shadow-elegant">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Crown className="h-8 w-8 text-primary" />
        </div>

        <p className="text-6xl font-black text-primary/90 leading-none">404</p>
        <h1 className="mt-4 text-3xl font-cairo font-bold text-foreground">النقلة غير موجودة</h1>
        <p className="mt-3 text-muted-foreground">
          الصفحة المطلوبة غير متاحة. ربما تم نقلها أو حذفها.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button variant="chess" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            رجوع
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href="/dashboard">
              <Compass className="w-4 h-4" />
              الذهاب إلى لوحة التحكم
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
