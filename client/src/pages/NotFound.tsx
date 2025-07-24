import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <div className="text-center p-8 bg-card/90 backdrop-blur-sm rounded-lg shadow-elegant max-w-md">
        <div className="text-8xl font-amiri font-bold text-primary mb-4">404</div>
        <h1 className="text-2xl font-amiri font-bold text-card-foreground mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-muted-foreground mb-6">
          عذراً، لا يمكن العثور على الصفحة المطلوبة
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="chess">
            <a href="/">
              <Home className="w-4 h-4" />
              العودة للرئيسية
            </a>
          </Button>
          <Button asChild variant="elegant">
            <a href="/dashboard">
              <Search className="w-4 h-4" />
              لوحة التحكم
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
