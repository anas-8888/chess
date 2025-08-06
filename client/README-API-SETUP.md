# إعداد API للواجهة الأمامية

## المتغيرات البيئية

قم بإنشاء ملف `.env` في مجلد `client` وأضف المتغير التالي:

```env
VITE_API_URL=http://192.168.204.221:3000
```

## تشغيل المشروع

### 1. تشغيل الباك-إند
```bash
cd server
npm install
npm start
```

### 2. تشغيل الفرونت-إند
```bash
cd client
npm install
npm run dev
```

## نقاط النهاية المتاحة

### المصادقة
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب
- `POST /api/auth/logout` - تسجيل الخروج
- `POST /api/auth/validate` - التحقق من صحة التوكن

### البيانات المطلوبة

#### تسجيل الدخول
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### إنشاء حساب
```json
{
  "username": "username",
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### الاستجابة المتوقعة
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "username",
    "avatar": "avatar_url",
    "rating": 1200
  }
}
```

## ملاحظات مهمة

1. تأكد من أن الباك-إند يعمل على المنفذ 3000
2. تأكد من أن الفرونت-إند يعمل على المنفذ 8080
3. تم تكوين CORS للسماح بالاتصال بين المنافذ المختلفة
4. يتم تخزين التوكن وبيانات المستخدم في localStorage 