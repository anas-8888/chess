-- =====================================================
-- 002_admin_dashboard_indexes.sql
-- فهارس لتحسين سرعة استعلامات لوحة الإدارة
-- =====================================================

SET @schema_name = DATABASE();

-- users: is_banned + created_at
SET @sql_idx_users_banned = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'users'
        AND INDEX_NAME = 'idx_users_is_banned_created'
    ),
    'SELECT "idx_users_is_banned_created already exists" AS info',
    'CREATE INDEX idx_users_is_banned_created ON users(is_banned, created_at)'
  )
);
PREPARE stmt FROM @sql_idx_users_banned;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- game: status + created_at
SET @sql_idx_game_status_created = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'game'
        AND INDEX_NAME = 'idx_game_status_created'
    ),
    'SELECT "idx_game_status_created already exists" AS info',
    'CREATE INDEX idx_game_status_created ON game(status, created_at)'
  )
);
PREPARE stmt FROM @sql_idx_game_status_created;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- invites: status + date_time + deleted_at
SET @sql_idx_invites_status_date_deleted = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'invites'
        AND INDEX_NAME = 'idx_invites_status_date_deleted'
    ),
    'SELECT "idx_invites_status_date_deleted already exists" AS info',
    'CREATE INDEX idx_invites_status_date_deleted ON invites(status, date_time, deleted_at)'
  )
);
PREPARE stmt FROM @sql_idx_invites_status_date_deleted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- session: user_id + expires_at + deleted_at
SET @sql_idx_session_user_expires_deleted = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'session'
        AND INDEX_NAME = 'idx_session_user_expires_deleted'
    ),
    'SELECT "idx_session_user_expires_deleted already exists" AS info',
    'CREATE INDEX idx_session_user_expires_deleted ON session(user_id, expires_at, deleted_at)'
  )
);
PREPARE stmt FROM @sql_idx_session_user_expires_deleted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '002_admin_dashboard_indexes.sql applied successfully' AS message;
