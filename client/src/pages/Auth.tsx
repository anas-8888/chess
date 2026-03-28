import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

const Auth = () => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { toast } = useToast();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  // Set active tab based on URL parameters
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register' || tab === 'login') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const getAuthErrorMessage = (rawError: unknown, mode: 'login' | 'register'): string => {
    const message = (rawError instanceof Error ? rawError.message : String(rawError || '')).trim();
    const normalized = message.toLowerCase();

    if (mode === 'register') {
      if (normalized.includes('البريد الإلكتروني مستخدم بالفعل') || normalized.includes('email')) {
        return 'هذا البريد الإلكتروني مستخدم من قبل';
      }
      if (normalized.includes('اسم المستخدم مستخدم بالفعل') || normalized.includes('username')) {
        return 'اسم المستخدم مستخدم من قبل';
      }
      if (normalized.includes('صيغة البريد')) {
        return 'صيغة البريد الإلكتروني غير صحيحة';
      }
      if (normalized.includes('كلمة المرور')) {
        return message;
      }
    }

    if (mode === 'login') {
      if (normalized.includes('بيانات الدخول غير صحيحة')) {
        return 'كلمة المرور أو البريد الإلكتروني غير صحيحين';
      }
      if (normalized.includes('تم حذف الحساب')) {
        return 'هذا الحساب غير متاح';
      }
      if (normalized.includes('حظر')) {
        return 'تم حظر هذا الحساب، راجع الإدارة';
      }
      if (normalized.includes('مطلوب')) {
        return 'أدخل البريد الإلكتروني وكلمة المرور';
      }
    }

    return message || (mode === 'login' ? 'فشل تسجيل الدخول' : 'فشل إنشاء الحساب');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.login({
        email: loginData.email,
        password: loginData.password,
      });

      // Store token and user data using auth context
      login(response.token, {
        ...response.user,
        email: loginData.email, // Add email from login data
        thumbnail: response.user?.avatar,
      });
      
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في شطرنج العرب",
      });
      
      // Redirect by role
      const nextPath = response.user?.type === 'admin' ? '/admin' : '/dashboard';
      window.location.href = nextPath;
      
    } catch (error: any) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: getAuthErrorMessage(error, 'login'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "خطأ في كلمة المرور",
        description: "كلمتا المرور غير متطابقتان",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.register({
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        confirmPassword: registerData.confirmPassword,
      });

      // Store token and user data using auth context
      login(response.token, {
        ...response.user,
        email: registerData.email, // Add email from register data
        thumbnail: response.user?.avatar,
      });
      
      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "مرحباً بك في شطرنج العرب",
      });
      
      // Redirect by role
      const nextPath = response.user?.type === 'admin' ? '/admin' : '/dashboard';
      window.location.href = nextPath;
      
    } catch (error: any) {
      toast({
        title: "خطأ في إنشاء الحساب",
        description: getAuthErrorMessage(error, 'register'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <BrandLogo variant="full" imgClassName="h-24 w-auto" />
          </div>
          <p className="text-white/80 text-lg">
            منصة الشطرنج الذكية
          </p>
        </div>

        <Card className="backdrop-blur-sm bg-white/95 shadow-elegant border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-amiri text-2xl">الدخول إلى حسابك</CardTitle>
            <CardDescription>
              ادخل إلى عالم الشطرنج العربي الممتع
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="font-cairo">
                  تسجيل الدخول
                </TabsTrigger>
                <TabsTrigger value="register" className="font-cairo">
                  إنشاء حساب
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">البريد الإلكتروني</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="أدخل بريدك الإلكتروني"
                      value={loginData.email}
                      onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      required
                      className="text-right"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="أدخل كلمة المرور"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    variant="chess"
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? "جاري تسجيل الدخول..." : "دخول"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">اسم المستخدم</Label>
                    <Input
                      id="register-username"
                      placeholder="اختر اسم مستخدم"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                      required
                      className="text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">البريد الإلكتروني</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="أدخل بريدك الإلكتروني"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      required
                      className="text-right"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password">كلمة المرور</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="أدخل كلمة المرور"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="أعد إدخال كلمة المرور"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    variant="chess"
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
