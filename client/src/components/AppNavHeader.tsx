import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import type { User as AuthUser } from "@/services/authService";
import { getInitialsFromName, hasCustomAvatar } from "@/utils/avatar";
import BrandLogo from "@/components/BrandLogo";
import { BarChart3, Crown, House, LogOut, Menu, Trophy, UserCircle, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type AppNavHeaderProps = {
  profileRating?: number;
};

type HeaderUser = AuthUser & {
  rank?: number;
  thumbnail?: string;
};

const AppNavHeader = ({ profileRating }: AppNavHeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const headerUser = user as HeaderUser | null;

  const navItems = [
    { label: "الرئيسية", path: "/dashboard", icon: House, adminOnly: false },
    { label: "الإحصائيات", path: "/my-statistics", icon: BarChart3, adminOnly: false },
    { label: "الأصدقاء", path: "/friends", icon: Users, adminOnly: false },
    { label: "ربط الرقعة", path: "/connect-board", icon: Trophy, adminOnly: false },
    { label: "لوحة الإدارة", path: "/admin", icon: Crown, adminOnly: true },
  ].filter((item) => !item.adminOnly || headerUser?.type === "admin");

  const currentPath = location.pathname;
  const ratingValue = Number(profileRating ?? headerUser?.rating ?? headerUser?.rank ?? 1500) || 1500;
  const username = headerUser?.username || "مستخدم";
  const avatarUrl = hasCustomAvatar(headerUser?.avatar || headerUser?.thumbnail)
    ? (headerUser?.avatar || headerUser?.thumbnail)
    : undefined;

  const isPathActive = (path: string) => {
    if (path === "/dashboard") return currentPath === "/dashboard";
    return currentPath.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden rounded-xl bg-card/70 border border-border/70" aria-label="فتح القائمة">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" dir="rtl" className="w-[88%] max-w-sm border-l border-border/70 bg-background/95 backdrop-blur-md p-5">
                <SheetHeader className="text-right space-y-1">
                  <SheetTitle className="font-cairo text-xl">القائمة</SheetTitle>
                </SheetHeader>

                <div className="mt-5 rounded-2xl bg-card/80 border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="font-cairo text-lg font-bold leading-tight">{username}</p>
                      <Badge variant="outline" className="mt-2 border-border text-foreground">
                        <Trophy className="w-3 h-3 ml-1 text-muted-foreground" />
                        {ratingValue}
                      </Badge>
                    </div>
                    <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                        {getInitialsFromName(username)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isPathActive(item.path);
                    return (
                      <SheetClose asChild key={item.path}>
                        <Button
                          variant={active ? "default" : "outline"}
                          className="w-full justify-start gap-2 h-11 border-border/70 bg-card/40"
                          onClick={() => navigate(item.path)}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Button>
                      </SheetClose>
                    );
                  })}
                </div>

                <div className="mt-6 border-t border-border/70 pt-4 space-y-2">
                  <SheetClose asChild>
                    <Button variant="ghost" className="w-full justify-start gap-2 h-11" onClick={() => navigate("/my-profile")}>
                      <UserCircle className="h-4 w-4" />
                      الملف الشخصي
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="destructive" className="w-full justify-start gap-2 h-11" onClick={logout}>
                      <LogOut className="h-4 w-4" />
                      تسجيل الخروج
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden md:flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-card/40 transition-colors">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/30">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {getInitialsFromName(username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right">
                    <h2 className="font-cairo text-lg font-bold text-foreground">{username}</h2>
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant="outline" className="border-border text-foreground">
                        <Trophy className="w-3 h-3 ml-1 text-muted-foreground" />
                        {ratingValue}
                      </Badge>
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 text-right">
                <div dir="rtl">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/my-profile")} className="justify-start gap-2">
                    <UserCircle className="h-4 w-4 shrink-0" />
                    الملف الشخصي
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="justify-start gap-2">
                    <LogOut className="h-4 w-4 shrink-0" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isPathActive(item.path);
                return (
                  <Button
                    key={item.path}
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 rounded-xl"
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BrandLogo variant="icon" imgClassName="h-10 w-10" />
            {headerUser?.type === "admin" && <Badge variant="outline" className="border-border text-foreground">مدير</Badge>}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppNavHeader;
