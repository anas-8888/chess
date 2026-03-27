import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, LogOut, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';

const Settings = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    avatar: '',
  });
  const [selectedImageData, setSelectedImageData] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const profile = await userService.getCurrentUserProfile();
      setForm({
        username: profile.username || '',
        email: profile.email || '',
        avatar: profile.avatar || '',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحميل الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (selectedImageData?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImageData);
      }
    };
  }, [selectedImageData]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await userService.updateProfile({
        username: form.username,
        email: form.email,
        avatar: form.avatar,
      });
      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث بيانات الحساب بنجاح',
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث البيانات',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمة المرور الجديدة غير متطابقة',
        variant: 'destructive',
      });
      return;
    }

    setSavingPassword(true);
    try {
      await userService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast({
        title: 'تم التحديث',
        description: 'تم تغيير كلمة المرور بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تغيير كلمة المرور',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const createCenteredSquareImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2);
        const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2);
        const targetSize = Math.min(sourceSize, 1024);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('تعذر تجهيز الصورة للقص'));
          return;
        }

        ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize);

        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outputExt = outputType === 'image/png' ? '.png' : '.jpg';
        const baseName = file.name.replace(/\.[^.]+$/, '');

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('فشل تحويل الصورة بعد القص'));
              return;
            }

            resolve(
              new File([blob], baseName + outputExt, {
                type: outputType,
                lastModified: Date.now(),
              })
            );
          },
          outputType,
          0.92
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('تعذر قراءة الصورة المختارة'));
      };

      image.src = objectUrl;
    });
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: 'خطأ',
        description: 'حجم الصورة يجب أن يكون أقل من 2MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      const croppedFile = await createCenteredSquareImage(file);

      if (selectedImageData?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImageData);
      }

      const previewUrl = URL.createObjectURL(croppedFile);
      setSelectedImageFile(croppedFile);
      setSelectedImageData(previewUrl);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error?.message || 'فشل تجهيز الصورة المختارة',
        variant: 'destructive',
      });
    }
  };

  const uploadAvatar = async () => {
    if (!selectedImageFile) {
      toast({
        title: 'تنبيه',
        description: 'اختر صورة أولاً',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await userService.uploadAvatar(selectedImageFile);
      const avatarUrl = result.avatar || result.thumbnail;
      setForm(prev => ({ ...prev, avatar: avatarUrl }));
      setSelectedImageData(null);
      setSelectedImageFile(null);
      toast({
        title: 'تم الرفع',
        description: 'تم رفع الصورة الشخصية بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في رفع الصورة',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center" dir="rtl">
        جاري تحميل الإعدادات...
      </div>
    );
  }

  const avatarSrc = selectedImageData || form.avatar || '/img/default-avatar.png';

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="رجوع" onClick={() => navigate(-1)}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold font-cairo">ملفي الشخصي</h1>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>الملف الشخصي</CardTitle>
            <CardDescription>تحديث بيانات الحساب الأساسية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Label>الصورة الشخصية</Label>
              <div className="flex items-center gap-4">
                <img
                  src={avatarSrc}
                  alt="avatar"
                  className="h-20 w-20 rounded-full object-cover border"
                />
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={uploadAvatar}
                    disabled={uploadingAvatar || !selectedImageFile}
                  >
                    <Upload className="h-4 w-4 ml-2" />
                    {uploadingAvatar ? 'جاري الرفع...' : 'رفع الصورة'}
                  </Button>
                </div>
                  <p className="text-xs text-muted-foreground">سيتم قص الصورة تلقائيًا إلى مربع قبل الرفع.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                value={form.username}
                onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={savingProfile}>
                <Save className="h-4 w-4 ml-2" />
                {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تغيير كلمة المرور</CardTitle>
            <CardDescription>أدخل كلمة المرور الحالية ثم الجديدة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={e =>
                  setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={e =>
                  setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e =>
                  setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={savePassword} disabled={savingPassword}>
                <KeyRound className="h-4 w-4 ml-2" />
                {savingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

