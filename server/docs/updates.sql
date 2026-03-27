-- 1) بداية التقييم 1500
ALTER TABLE users
  MODIFY COLUMN rank INT NOT NULL DEFAULT 1500;

-- 2) أعمدة تغيّر التقييم (إن لم تكن موجودة)
ALTER TABLE game
  ADD COLUMN IF NOT EXISTS white_rank_change INT NULL,
  ADD COLUMN IF NOT EXISTS black_rank_change INT NULL;

-- 3) فهارس مهمة لأداء سجل التقييم والإحصائيات
CREATE INDEX idx_game_user_status_ended
  ON game (white_player_id, status, ended_at);

CREATE INDEX idx_game_user_status_ended_black
  ON game (black_player_id, status, ended_at);

CREATE INDEX idx_game_ended_at
  ON game (ended_at);
