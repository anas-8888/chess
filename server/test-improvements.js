#!/usr/bin/env node

/**
 * اختبار سريع للتحسينات
 * تشغيل: node test-improvements.js
 */

import { testConnection, withConn } from './src/config/db.js';
import logger from './src/utils/logger.js';

console.log('🧪 بدء اختبار التحسينات...\n');

// اختبار 1: الاتصال بقاعدة البيانات
console.log('1️⃣ اختبار الاتصال بقاعدة البيانات');
try {
  const isConnected = await testConnection();
  if (isConnected) {
    console.log('✅ الاتصال بقاعدة البيانات ناجح');
  } else {
    console.log('❌ فشل الاتصال بقاعدة البيانات');
  }
} catch (error) {
  console.log('❌ خطأ في اختبار الاتصال:', error.message);
}

// اختبار 2: دالة withConn
console.log('\n2️⃣ اختبار دالة withConn');
try {
  await withConn(async (connection) => {
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('✅ دالة withConn تعمل بشكل صحيح');
    return rows;
  });
} catch (error) {
  console.log('❌ خطأ في دالة withConn:', error.message);
}

// اختبار 3: نظام التسجيل
console.log('\n3️⃣ اختبار نظام التسجيل');
logger.info('رسالة معلومات عادية');
logger.warn('تحذير مهم');
logger.error('خطأ في النظام');
logger.debug('رسالة تفصيلية (تظهر فقط مع DEBUG=1)');

// اختبار 4: تسجيل العمليات المتكررة
console.log('\n4️⃣ اختبار تسجيل العمليات المتكررة');
logger.logCount('الأصدقاء', 15);
logger.logCount('الدعوات', 3);
logger.logOperation('تنظيف قاعدة البيانات', 'completed', { cleaned: 5 });

console.log('\n🎉 انتهى اختبار التحسينات!');
console.log('\n📋 ملاحظات:');
console.log('- تأكد من تشغيل قاعدة البيانات');
console.log('- استخدم DEBUG=1 لرؤية رسائل debug');
console.log('- استخدم LOG_LEVEL=warn لتقليل الرسائل'); 