# Smart Chess - موقع الشطرنج العربي

موقع شطرنج تفاعلي باللغة العربية مع واجهة مستخدم حديثة وخلفية قوية.

## المميزات

- 🎮 **لعب مباشر**: مباريات شطرنج فورية مع لاعبين آخرين
- 👥 **نظام أصدقاء**: إضافة وإدارة الأصدقاء
- 🏆 **نظام تصنيف**: تصنيف ELO مع لوحة متصدرين
- 📚 **كورسات تعليمية**: دروس شطرنج للمبتدئين والمتقدمين
- 🧩 **ألغاز شطرنج**: حل ألغاز لتحسين المهارات
- 📊 **تحليل الأداء**: إحصائيات مفصلة عن المباريات
- 🔐 **نظام مصادقة آمن**: JWT مع إدارة جلسات متقدمة

## التقنيات المستخدمة

### Backend
- **Node.js** مع **Express.js**
- **MySQL** مع **Sequelize ORM**
- **JWT** للمصادقة
- **Socket.IO** للعبة المباشرة
- **bcrypt** لتشفير كلمات المرور
- **express-session** لإدارة الجلسات

### Frontend
- **HTML5** و **CSS3** مع **Bootstrap 5**
- **JavaScript ES6+** مع **Fetch API**
- **Socket.IO Client** للاتصال المباشر
- **Chart.js** للرسوم البيانية
- **Chess.js** لمحرك الشطرنج

## التثبيت والتشغيل

### المتطلبات
- Node.js 18.0.0 أو أحدث
- MySQL 8.0 أو أحدث
- npm أو yarn

### خطوات التثبيت

1. **استنساخ المشروع**
```bash
git clone <repository-url>
cd smart-chess
```

2. **تثبيت التبعيات**
```bash
npm install
```

3. **إعداد قاعدة البيانات**
```bash
# إنشاء قاعدة البيانات
mysql -u root -p
CREATE DATABASE smart_chess;
```

4. **إعداد ملف البيئة**
```bash
cp env.example .env
# تعديل ملف .env بالمعلومات المطلوبة
```

5. **مزامنة قاعدة البيانات**
```bash
npm run idb
```

6. **تشغيل الخادم**
```bash
# للتطوير
npm run dev

# للإنتاج
npm start
```

7. **فتح المتصفح**
```
http://localhost:3003
```

## هيكل المشروع

```
smart-chess/
├── public/                 # الملفات الثابتة (Frontend)
│   ├── css/               # ملفات التصميم
│   ├── js/                # ملفات JavaScript
│   ├── img/               # الصور
│   ├── admin/             # صفحات الإدارة
│   └── *.html             # صفحات HTML
├── src/                   # Backend
│   ├── controllers/       # وحدات التحكم
│   ├── models/           # نماذج قاعدة البيانات
│   ├── routes/           # مسارات API
│   ├── services/         # خدمات الأعمال
│   ├── middlewares/      # middleware
│   ├── socket/           # WebSocket handlers
│   └── utils/            # أدوات مساعدة
├── tests/                # اختبارات
├── docs/                 # التوثيق
└── config/               # إعدادات التطبيق
```

## API Endpoints

### المصادقة
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - تسجيل حساب جديد
- `POST /api/auth/logout` - تسجيل الخروج
- `GET /api/auth/validate` - التحقق من صحة التوكن
- `POST /api/auth/refresh` - تجديد التوكن

### المستخدمين
- `GET /api/users/me` - بيانات المستخدم الحالي
- `GET /api/users/:id` - بيانات مستخدم محدد
- `PUT /api/users/me` - تحديث البيانات الشخصية
- `DELETE /api/users/me` - حذف الحساب

### المباريات
- `POST /api/games` - إنشاء مباراة جديدة
- `GET /api/games/:id` - تفاصيل مباراة
- `PUT /api/games/:id` - تحديث حالة المباراة

### الأصدقاء
- `GET /api/friends` - قائمة الأصدقاء
- `POST /api/friends/request` - إرسال طلب صداقة
- `POST /api/friends/accept/:id` - قبول طلب صداقة
- `DELETE /api/friends/:id` - حذف صديق

### التحديات
- `POST /api/challenges` - إنشاء تحدي
- `GET /api/challenges/incoming` - التحديات الواردة
- `POST /api/challenges/:id/accept` - قبول تحدي

### الكورسات
- `GET /api/courses` - جميع الكورسات
- `GET /api/courses/:id` - كورس محدد
- `POST /api/courses/:id/enroll` - التسجيل في كورس

### الألغاز
- `GET /api/puzzles` - الألغاز المتاحة
- `GET /api/puzzles/:id` - لغز محدد
- `POST /api/puzzles/:id/solve` - حل لغز

### التصنيف
- `GET /api/leaderboard` - التصنيف العام
- `GET /api/leaderboard/friends` - تصنيف الأصدقاء

## الربط مع الواجهة الأمامية

### إعداد الطلبات
```javascript
// دالة مساعدة لطلب API
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        credentials: 'include',
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        // التعامل مع انتهاء صلاحية التوكن
        if (response.status === 401) {
            const refreshed = await refreshToken();
            if (refreshed) {
                const newToken = localStorage.getItem('token');
                defaultOptions.headers['Authorization'] = `Bearer ${newToken}`;
                return await fetch(url, defaultOptions);
            } else {
                localStorage.clear();
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }
        
        return response;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}
```

### مثال على تسجيل الدخول
```javascript
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
});

const data = await response.json();
if (response.ok) {
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', data.data.user.username);
    window.location.href = '/';
}
```

### WebSocket للعبة المباشرة
```javascript
const socket = io('/games', {
    auth: {
        token: localStorage.getItem('token')
    }
});

socket.on('game_update', (data) => {
    updateGameState(data);
});

socket.on('move_made', (data) => {
    makeMove(data.from, data.to);
});
```

## الأمان

- **JWT Authentication**: مصادقة آمنة باستخدام JWT
- **Session Management**: إدارة جلسات متقدمة
- **Rate Limiting**: حماية من الهجمات
- **CORS**: إعدادات CORS آمنة
- **Input Validation**: التحقق من صحة المدخلات
- **SQL Injection Protection**: حماية من حقن SQL
- **XSS Protection**: حماية من XSS

## الاختبارات

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل الاختبارات مع التغطية
npm run test:coverage

# تشغيل الاختبارات في وضع المراقبة
npm run test:watch
```

## النشر

### الإعدادات المطلوبة للإنتاج

1. **تحديث ملف .env**
```env
NODE_ENV=production
JWT_SECRET=your-production-secret-key
SESSION_SECRET=your-production-session-secret
SECURE_COOKIES=true
```

2. **إعداد قاعدة البيانات**
```bash
# إنشاء مستخدم قاعدة البيانات للإنتاج
CREATE USER 'smart_chess'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON smart_chess.* TO 'smart_chess'@'localhost';
FLUSH PRIVILEGES;
```

3. **بناء المشروع**
```bash
npm run build
```

4. **تشغيل الخادم**
```bash
npm start
```

## المساهمة

1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى branch (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## الترخيص

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## الدعم

إذا واجهت أي مشاكل أو لديك أسئلة:

1. تحقق من [التوثيق](docs/)
2. ابحث في [Issues](https://github.com/your-repo/issues)
3. أنشئ issue جديد إذا لم تجد الحل

## التحديثات القادمة

- [ ] تطبيق جوال (React Native)
- [ ] دعم اللعب ضد الذكاء الاصطناعي
- [ ] نظام بطولات
- [ ] تحليل المباريات بالذكاء الاصطناعي
- [ ] دعم اللغات الأخرى
- [ ] نظام إشعارات متقدم
