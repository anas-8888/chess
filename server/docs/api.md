# Smart Chess API Documentation

## نظرة عامة

هذا التوثيق يغطي جميع نقاط النهاية (Endpoints) المتاحة في API الخاص بموقع الشطرنج العربي، بالإضافة إلى طريقة الربط مع واجهة المستخدم.

## معلومات أساسية

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer Token

## المصادقة (Authentication)

### تسجيل الدخول
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "user_id": 1,
      "username": "user123",
      "email": "user@example.com",
      "type": "user",
      "rank": 1200,
      "puzzle_level": 1,
      "state": "online",
      "thumbnail": "https://example.com/avatar.jpg",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### تسجيل حساب جديد
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123"
}
```

### التحقق من صحة التوكن
```http
GET /api/auth/validate
Authorization: Bearer <token>
```

### تجديد التوكن
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "token": "old_token_here"
}
```

### تسجيل الخروج
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## المستخدمين (Users)

### جلب بيانات المستخدم الحالي
```http
GET /api/users/me
Authorization: Bearer <token>
```

### جلب بيانات مستخدم آخر
```http
GET /api/users/:userId
Authorization: Bearer <token>
```

### تحديث بيانات المستخدم
```http
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com",
  "thumbnail": "https://example.com/new-avatar.jpg"
}
```

### حذف الحساب
```http
DELETE /api/users/me
Authorization: Bearer <token>
```

## المباريات (Games)

### إنشاء مباراة جديدة
```http
POST /api/games
Authorization: Bearer <token>
Content-Type: application/json

{
  "opponent_id": 2,
  "time_control": "blitz",
  "color": "white"
}
```

### جلب مباراة محددة
```http
GET /api/games/:gameId
Authorization: Bearer <token>
```

### تحديث حالة المباراة
```http
PUT /api/games/:gameId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",
  "moves": ["e4", "e5", "Nf3"]
}
```

## سجل المباريات (History)

### جلب سجل مباريات المستخدم
```http
GET /api/history/user/:userId
Authorization: Bearer <token>
```

### جلب تفاصيل مباراة محددة
```http
GET /api/history/game/:gameId
Authorization: Bearer <token>
```

## الأصدقاء (Friends)

### جلب قائمة الأصدقاء
```http
GET /api/friends
Authorization: Bearer <token>
```

### إرسال طلب صداقة
```http
POST /api/friends/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "friend_id": 2
}
```

### قبول طلب صداقة
```http
POST /api/friends/accept/:requestId
Authorization: Bearer <token>
```

### رفض طلب صداقة
```http
POST /api/friends/reject/:requestId
Authorization: Bearer <token>
```

### حذف صديق
```http
DELETE /api/friends/:friendId
Authorization: Bearer <token>
```

## التحديات (Challenges)

### إنشاء تحدي
```http
POST /api/challenges
Authorization: Bearer <token>
Content-Type: application/json

{
  "opponent_id": 2,
  "time_control": "blitz",
  "message": "تحدي للعب!"
}
```

### جلب التحديات الواردة
```http
GET /api/challenges/incoming
Authorization: Bearer <token>
```

### قبول تحدي
```http
POST /api/challenges/:challengeId/accept
Authorization: Bearer <token>
```

### رفض تحدي
```http
POST /api/challenges/:challengeId/reject
Authorization: Bearer <token>
```

## الكورسات (Courses)

### جلب جميع الكورسات
```http
GET /api/courses
Authorization: Bearer <token>
```

### جلب كورس محدد
```http
GET /api/courses/:courseId
Authorization: Bearer <token>
```

### التسجيل في كورس
```http
POST /api/courses/:courseId/enroll
Authorization: Bearer <token>
```

## الألغاز (Puzzles)

### جلب الألغاز
```http
GET /api/puzzles
Authorization: Bearer <token>
```

### جلب لغز محدد
```http
GET /api/puzzles/:puzzleId
Authorization: Bearer <token>
```

### تقديم حل للغز
```http
POST /api/puzzles/:puzzleId/solve
Authorization: Bearer <token>
Content-Type: application/json

{
  "solution": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"]
}
```

## التصنيف (Leaderboard)

### جلب التصنيف العام
```http
GET /api/leaderboard
Authorization: Bearer <token>
```

### جلب تصنيف الأصدقاء
```http
GET /api/leaderboard/friends
Authorization: Bearer <token>
```

## الربط مع الواجهة الأمامية

### إعداد الطلبات

جميع الطلبات إلى API يجب أن تتضمن التوكن في header:

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
// في ملف auth.js
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
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
            // تخزين بيانات المستخدم
            localStorage.setItem('user', data.data.user.username);
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user_id', data.data.user.user_id);
            localStorage.setItem('user_type', data.data.user.type);

            // إعادة التوجيه
            window.location.href = '/';
        } else {
            showError(data.message || 'فشل تسجيل الدخول');
        }
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showError('حدث خطأ في الاتصال بالخادم');
    }
});
```

### مثال على جلب بيانات المستخدم

```javascript
// في ملف profile.js
async function loadUserProfile() {
    try {
        const response = await apiRequest('/api/users/me');
        
        if (response.ok) {
            const data = await response.json();
            const user = data.data;
            
            // تحديث واجهة المستخدم
            document.getElementById('profile-name').textContent = user.username;
            document.getElementById('profile-rank').textContent = user.rank;
            // ... المزيد من التحديثات
        } else {
            throw new Error('فشل جلب بيانات المستخدم');
        }
    } catch (error) {
        console.error('خطأ في جلب الملف الشخصي:', error);
        showToast('فشل في تحميل الملف الشخصي', 'danger');
    }
}
```

### مثال على إنشاء مباراة

```javascript
// في ملف play.js
async function createGame(opponentId, timeControl) {
    try {
        const response = await apiRequest('/api/games', {
            method: 'POST',
            body: JSON.stringify({
                opponent_id: opponentId,
                time_control: timeControl
            })
        });

        if (response.ok) {
            const data = await response.json();
            const game = data.data;
            
            // الانتقال إلى غرفة اللعب
            window.location.href = `/game-room?gameId=${game.game_id}`;
        } else {
            const errorData = await response.json();
            showToast(errorData.message || 'فشل إنشاء المباراة', 'danger');
        }
    } catch (error) {
        console.error('خطأ في إنشاء المباراة:', error);
        showToast('فشل في إنشاء المباراة', 'danger');
    }
}
```

## إدارة الأخطاء

### رموز الحالة الشائعة

- `200` - نجح الطلب
- `201` - تم إنشاء المورد بنجاح
- `400` - خطأ في البيانات المرسلة
- `401` - غير مصرح (توكن غير صالح)
- `403` - ممنوع (لا توجد صلاحيات كافية)
- `404` - المورد غير موجود
- `429` - طلبات كثيرة جداً
- `500` - خطأ في الخادم

### التعامل مع الأخطاء

```javascript
async function handleApiError(response) {
    if (response.status === 401) {
        // إعادة توجيه لتسجيل الدخول
        window.location.href = '/login';
        return;
    }
    
    if (response.status === 403) {
        showToast('ليس لديك صلاحية للقيام بهذا الإجراء', 'danger');
        return;
    }
    
    if (response.status === 429) {
        showToast('طلبات كثيرة جداً، يرجى الانتظار قليلاً', 'warning');
        return;
    }
    
    // محاولة قراءة رسالة الخطأ
    try {
        const errorData = await response.json();
        showToast(errorData.message || 'حدث خطأ غير متوقع', 'danger');
    } catch {
        showToast('حدث خطأ في الاتصال بالخادم', 'danger');
    }
}
```

## WebSocket للعبة المباشرة

### الاتصال بـ Socket.IO

```javascript
// في ملف game-room.js
const socket = io('/games', {
    auth: {
        token: localStorage.getItem('token')
    }
});

socket.on('connect', () => {
    console.log('تم الاتصال بخادم اللعب');
});

socket.on('game_update', (data) => {
    // تحديث حالة اللعبة
    updateGameState(data);
});

socket.on('move_made', (data) => {
    // تحديث الحركة على اللوحة
    makeMove(data.from, data.to);
});

socket.on('game_over', (data) => {
    // عرض نتيجة المباراة
    showGameResult(data.result);
});
```

## نصائح للتنفيذ

1. **استخدم دالة `apiRequest`** لجميع الطلبات لضمان إضافة التوكن تلقائياً
2. **تعامل مع انتهاء صلاحية التوكن** باستخدام `refreshToken`
3. **استخدم `showToast`** لعرض الرسائل للمستخدم
4. **تحقق من الاستجابة** قبل معالجة البيانات
5. **استخدم `try-catch`** لمعالجة الأخطاء
6. **احفظ التوكن** في `localStorage` بعد تسجيل الدخول
7. **امسح البيانات المحلية** عند تسجيل الخروج

## اختبارات التكامل

### اختبار تسجيل الدخول
1. انتقل إلى `/login`
2. أدخل بيانات صحيحة
3. تحقق من تخزين التوكن
4. تحقق من إعادة التوجيه

### اختبار حماية الصفحات
1. حاول الوصول لصفحة محمية بدون تسجيل دخول
2. تحقق من إعادة التوجيه لصفحة تسجيل الدخول

### اختبار انتهاء صلاحية التوكن
1. انتظر انتهاء صلاحية التوكن
2. حاول إجراء طلب
3. تحقق من تجديد التوكن التلقائي

### اختبار WebSocket
1. ابدأ مباراة
2. تحقق من الاتصال بـ Socket.IO
3. تحقق من استقبال تحديثات اللعبة
