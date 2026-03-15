-- =====================================================
-- 001_admin_role_and_ban_support.sql
-- يضيف حقول الحظر المطلوبة للوحة الإدارة بشكل آمن
-- =====================================================

-- ملاحظة: شغّل هذا الملف داخل نفس قاعدة البيانات (chess_db)

SET @schema_name = DATABASE();

-- is_banned
SET @sql_add_is_banned = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'is_banned'
    ),
    'SELECT "users.is_banned already exists" AS info',
    'ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0 AFTER type'
  )
);
PREPARE stmt FROM @sql_add_is_banned;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- banned_at
SET @sql_add_banned_at = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'banned_at'
    ),
    'SELECT "users.banned_at already exists" AS info',
    'ALTER TABLE users ADD COLUMN banned_at TIMESTAMP NULL DEFAULT NULL AFTER is_banned'
  )
);
PREPARE stmt FROM @sql_add_banned_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- banned_reason
SET @sql_add_banned_reason = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'banned_reason'
    ),
    'SELECT "users.banned_reason already exists" AS info',
    'ALTER TABLE users ADD COLUMN banned_reason VARCHAR(255) NULL AFTER banned_at'
  )
);
PREPARE stmt FROM @sql_add_banned_reason;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '001_admin_role_and_ban_support.sql applied successfully' AS message;
