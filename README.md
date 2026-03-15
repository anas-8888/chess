# شطرنج العرب - منصة الشطرنج الذكية المتكاملة

## نظرة عامة على المشروع

**شطرنج العرب** هو مشروع متكامل يجمع بين تطبيق ويب حديث للشطرنج وألواح شطرنج مادية ذكية. المشروع مصمم خصيصاً للعالم العربي مع دعم كامل للغة العربية والكتابة من اليمين إلى اليسار (RTL).

### فكرة المشروع الأساسية

المشروع يهدف إلى:
- **دمج التكنولوجيا الرقمية مع الألعاب التقليدية**: ربط ألواح الشطرنج المادية بالتطبيق الرقمي
- **تعزيز تجربة اللعب**: توفير تجربة لعب تفاعلية ومتقدمة
- **بناء مجتمع شطرنج عربي**: منصة اجتماعية للاعبين العرب
- **التعليم التفاعلي**: كورسات وألغاز شطرنجية تعليمية

## المميزات الرئيسية

### 🎮 أنماط اللعب المتعددة
- **لعبة سريعة**: البحث عن خصم عشوائي عبر الإنترنت
- **تحدي الأصدقاء**: إرسال واستقبال دعوات اللعب
- **ضد الذكاء الاصطناعي**: اللعب ضد محرك Stockfish المتقدم
- **اللوحة المادية**: دعم ألواح الشطرنج المزودة بـ ESP32
- **الألغاز الشطرنجية**: مجموعة متنوعة من الألغاز التعليمية

### 💬 التفاعل الاجتماعي
- **دردشة فورية**: أثناء المباراة مع دعم الرموز التعبيرية
- **قائمة الأصدقاء**: مع حالة الاتصال المباشرة
- **نظام الدعوات**: إرسال واستقبال دعوات اللعب
- **الإشعارات الفورية**: عبر WebSocket
- **تتبع الإحصائيات**: النقاط والرتب والتقدم

### 📚 النظام التعليمي
- **كورسات تفاعلية**: دروس شطرنج منظمة حسب المستوى
- **فيديوهات تعليمية**: محتوى مرئي للتعلم
- **الألغاز اليومية**: تحديات يومية لتحسين المهارات
- **تحليل المباريات**: أدوات تحليل متقدمة

### ⚡ المميزات التقنية المتقدمة
- **ساعة توقيت ذكية**: لكل لاعب مع إعدادات قابلة للتخصيص
- **حفظ تلقائي**: حالة المباراة عند الانقطاع
- **عرض النقلات**: تاريخ كامل للنقلات مع التعليقات
- **دعم RTL كامل**: واجهة عربية متكاملة
- **الوضع الليلي**: تجربة مستخدم محسنة

## هيكل المشروع

```
chessboard/
├── client/                 # تطبيق React الأمامي
│   ├── src/
│   │   ├── components/     # مكونات واجهة المستخدم
│   │   ├── pages/         # صفحات التطبيق
│   │   ├── services/      # خدمات API
│   │   ├── contexts/      # React Contexts
│   │   └── hooks/         # Custom Hooks
│   └── public/            # الملفات الثابتة
├── server/                # خادم Node.js الخلفي
│   ├── src/
│   │   ├── controllers/   # منطق الأعمال
│   │   ├── models/        # نماذج قاعدة البيانات
│   │   ├── routes/        # مسارات API
│   │   ├── services/      # الخدمات المنطقية
│   │   └── socket/        # WebSocket handlers
│   └── docs/              # توثيق API
└── microcontroller/       # كود ESP32 للوحة المادية
    ├── chess_board_integrated.cpp
    ├── senssor.cpp
    └── steppermotors.cpp
```

## التقنيات المستخدمة

### الواجهة الأمامية (Frontend)
- **React 18** - إطار العمل الأساسي
- **TypeScript** - للأمان في الكتابة
- **Vite** - أداة البناء السريعة
- **Tailwind CSS** - إطار العمل للتصميم
- **Shadcn/UI** - مكونات واجهة المستخدم
- **React Router** - إدارة التنقل
- **React Query** - إدارة حالة البيانات
- **Socket.IO Client** - الاتصال الفوري
- **Chess.js** - محرك قوانين الشطرنج
- **Lucide React** - الأيقونات

### الخادم الخلفي (Backend)
- **Node.js** - بيئة التشغيل
- **Express.js** - إطار العمل للخادم
- **Socket.IO** - الاتصال الفوري
- **Sequelize** - ORM لقاعدة البيانات
- **MySQL** - قاعدة البيانات
- **JWT** - المصادقة
- **bcrypt** - تشفير كلمات المرور
- **Stockfish** - محرك الذكاء الاصطناعي
- **Helmet** - أمان التطبيق
- **Rate Limiting** - حماية من الهجمات

### الأجهزة المادية (Hardware)
- **ESP32** - المعالج الرئيسي
- **WebSocket Client** - الاتصال بالخادم
- **Stepper Motors** - تحريك القطع
- **Reed Switches** - استشعار القطع
- **Servo Motors** - التحكم في المغناطيس
- **WiFi Module** - الاتصال بالإنترنت

## كيفية التشغيل

### متطلبات النظام
- **Node.js** (الإصدار 18 أو أحدث)
- **MySQL** (الإصدار 8.0 أو أحدث)
- **npm** أو **yarn**
- **Arduino IDE** (لبرمجة ESP32)

### إعداد قاعدة البيانات

1. **إنشاء قاعدة البيانات**
```sql
CREATE DATABASE smart_chess CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **إعداد ملف البيئة**
```bash
cd server
cp env.example .env
```

3. **تعديل ملف .env**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=your_password
DB_NAME=smart-chess

# JWT Configuration
JWT_SECRET=your-strong-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Session Management
SESSION_POLICY=single
MAX_SESSIONS=5

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3003

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=2000

# Logging
LOG_LEVEL=info
```

### تشغيل الخادم الخلفي

```bash
cd server
npm install
npm run dev
```

### تشغيل التطبيق الأمامي

```bash
cd client
npm install
npm run dev
```

### برمجة ESP32

1. **تثبيت مكتبات Arduino المطلوبة**
   - WebSocketsClient
   - ArduinoJson
   - ESP32Servo
   - AccelStepper

2. **تعديل إعدادات الشبكة في الكود**
```cpp
const String ssid = "your_wifi_name";
const String password = "your_wifi_password";
const String host = "your_server_ip";
const uint16_t port = 3000;
```

3. **رفع الكود إلى ESP32**

## API Documentation

### المصادقة (Authentication)
```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/profile
```

### الألعاب (Games)
```http
POST /api/game/create
GET /api/game/:id
POST /api/game/:id/move
POST /api/game/:id/resign
GET /api/game/:id/history
```

### الأصدقاء (Friends)
```http
GET /api/friends
POST /api/friends/add/:userId
DELETE /api/friends/remove/:userId
```

### الدعوات (Invites)
```http
POST /api/invites/create
GET /api/invites
POST /api/invites/:id/accept
DELETE /api/invites/:id/decline
```

### الكورسات (Courses)
```http
GET /api/courses
GET /api/courses/:id
POST /api/courses/:id/enroll
```

### الألغاز (Puzzles)
```http
GET /api/puzzles
GET /api/puzzles/:id
POST /api/puzzles/:id/solve
```

## WebSocket Events

### أحداث اللعبة
```javascript
// استقبال النقلات
socket.on('moveMade', (data) => {
  // تحديث لوحة الشطرنج
});

// تحديث الساعة
socket.on('clock', (data) => {
  // تحديث الوقت المتبقي
});

// رسائل الدردشة
socket.on('chatMessage', (data) => {
  // عرض الرسالة
});
```

### أحداث الأصدقاء
```javascript
// تغيير حالة الصديق
socket.on('friendStatusChanged', (data) => {
  // تحديث حالة الاتصال
});

// استقبال دعوة جديدة
socket.on('inviteCreated', (data) => {
  // عرض إشعار الدعوة
});
```

## المميزات المستقبلية

### قيد التطوير
- [ ] **تحليل المباريات المتقدم**: أدوات تحليل شاملة
- [ ] **البطولات والمسابقات**: نظام تنافسي متكامل
- [ ] **التعليق الصوتي**: تعليقات مباشرة على المباريات
- [ ] **الذكاء الاصطناعي المتقدم**: محركات شطرنج متعددة
- [ ] **التطبيق المحمول**: تطبيق React Native
- [ ] **الواقع المعزز**: AR للعرض ثلاثي الأبعاد

### المميزات المخططة
- [ ] **نظام الرتب المتقدم**: تصنيف ELO دقيق
- [ ] **المباريات المباشرة**: بث المباريات المهمة
- [ ] **المجموعات والمنتديات**: مجتمعات شطرنج متخصصة
- [ ] **التدريب الشخصي**: مدربين محترفين
- [ ] **التحليل التكتيكي**: أدوات تحليل متقدمة

## المساهمة في المشروع

نرحب بالمساهمات من جميع المطورين! يرجى اتباع الخطوات التالية:

1. **إنشاء Fork للمشروع**
2. **إنشاء Branch جديد**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **التأكد من جودة الكود**
   ```bash
   npm run lint
   npm run test
   ```
4. **إرسال Pull Request**

### معايير الكود
- استخدام TypeScript للواجهة الأمامية
- اتباع معايير ESLint
- كتابة تعليقات واضحة باللغة العربية
- اختبار جميع الميزات الجديدة

## الدعم والمساعدة

### قنوات الدعم
- **GitHub Issues**: للإبلاغ عن الأخطاء
- **Discord**: للمناقشات العامة
- **Email**: للاستفسارات الخاصة

### التوثيق الإضافي
- [دليل API المفصل](./server/docs/api.md)
- [دليل إعداد ESP32](./microcontroller/README.md)
- [دليل النشر](./DEPLOYMENT.md)

## الترخيص

هذا المشروع مرخص تحت رخصة MIT. راجع ملف [LICENSE](./LICENSE) للتفاصيل.

## فريق التطوير

- **المطور الرئيسي**: فريق شطرنج العرب
- **المصمم**: فريق التصميم العربي
- **مطور الأجهزة**: فريق الإلكترونيات

---

**شطرنج العرب** - حيث يلتقي التراث العربي بالتكنولوجيا الحديثة في عالم الشطرنج الممتع 🏰♔

*"الشطرنج ليس مجرد لعبة، بل هو فن وعلم وفلسفة"*