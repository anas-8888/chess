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

-- 4) توسيع جدول الألغاز لدعم المنطق الفعلي
ALTER TABLE puzzle
  ADD COLUMN IF NOT EXISTS objective VARCHAR(200) NULL AFTER details,
  ADD COLUMN IF NOT EXISTS starts_with ENUM('white','black') NOT NULL DEFAULT 'white' AFTER objective,
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 10 AFTER starts_with,
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0 AFTER points,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER order_index;

CREATE INDEX IF NOT EXISTS idx_puzzle_order_active
  ON puzzle (is_active, order_index, id);

-- 5) جدول تقدم المستخدم في الألغاز
CREATE TABLE IF NOT EXISTS user_puzzle_progress (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  puzzle_id INT NOT NULL,
  attempts_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  total_mistakes INT NOT NULL DEFAULT 0,
  total_hints_used INT NOT NULL DEFAULT 0,
  used_solution_count INT NOT NULL DEFAULT 0,
  best_time_seconds INT NULL,
  points_earned INT NOT NULL DEFAULT 0,
  first_solved_at TIMESTAMP NULL DEFAULT NULL,
  last_solved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_puzzle_progress (user_id, puzzle_id),
  KEY idx_user_puzzle_progress_user (user_id),
  KEY idx_user_puzzle_progress_puzzle (puzzle_id),
  CONSTRAINT fk_user_puzzle_progress_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_puzzle_progress_puzzle FOREIGN KEY (puzzle_id) REFERENCES puzzle(id) ON DELETE CASCADE
);

-- 6) جدول سجل محاولات الألغاز
CREATE TABLE IF NOT EXISTS user_puzzle_attempt (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  puzzle_id INT NOT NULL,
  status ENUM('solved','failed','abandoned') NOT NULL DEFAULT 'failed',
  moves_count INT NOT NULL DEFAULT 0,
  mistakes_count INT NOT NULL DEFAULT 0,
  hints_used INT NOT NULL DEFAULT 0,
  used_solution TINYINT(1) NOT NULL DEFAULT 0,
  elapsed_seconds INT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_puzzle_attempt_user (user_id),
  KEY idx_user_puzzle_attempt_puzzle (puzzle_id),
  KEY idx_user_puzzle_attempt_status_created (status, created_at),
  CONSTRAINT fk_user_puzzle_attempt_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_puzzle_attempt_puzzle FOREIGN KEY (puzzle_id) REFERENCES puzzle(id) ON DELETE CASCADE
);


START TRANSACTION;

INSERT INTO puzzle
(name, level, fen, objective, details, starts_with, points, order_index, is_active, solution, created_at, updated_at)
VALUES
-- 1..20 (ألغاز إضافية)
('مات فوري بالوزير 1', 'easy', 'k7/1Q6/2K5/8/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة', 'حقق المات مباشرة.', 'white', 10, 1, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','b7b8')), NOW(), NOW()),

('مات فوري بالوزير 2', 'easy', '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة', 'تموضع بسيط ومباشر.', 'white', 10, 2, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','g6g7')), NOW(), NOW()),

('مات فوري بالقلعة 1', 'easy', 'k7/8/1K6/R7/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة', 'استعمل القلعة للحسم.', 'white', 10, 3, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','a5a8')), NOW(), NOW()),

('مات فوري بالقلعة 2', 'easy', '7k/8/6K1/7R/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة', 'نقلة خطية مباشرة.', 'white', 10, 4, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','h5h8')), NOW(), NOW()),

('اكسب الوزير 1', 'easy', '4k3/8/8/3q4/4Q3/8/8/4K3 w - - 0 1', 'اكسب الوزير', 'التقاط مباشر للوزير.', 'white', 8, 5, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e4d5')), NOW(), NOW()),

('شوكة حصان 1', 'easy', '4k3/8/3q4/8/8/3N4/8/4K3 w - - 0 1', 'نقلة تكتيكية', 'ابحث عن نقلة حصان فعالة.', 'white', 8, 6, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','d3e5')), NOW(), NOW()),

('التقاط بالفيل', 'easy', '6k1/8/8/8/3B4/8/4q3/4K3 w - - 0 1', 'اكسب الوزير', 'القطر يحسم الموقف.', 'white', 8, 7, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','d4e3')), NOW(), NOW()),

('قفزة حصان دقيقة', 'easy', '6k1/8/8/8/8/3N4/5q2/4K3 w - - 0 1', 'اكسب قطعة قوية', 'نقلة حصان تحسم المادة.', 'white', 8, 8, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','d3f2')), NOW(), NOW()),

('ترقية بيادق 1', 'easy', '7k/4P3/6K1/8/8/8/8/8 w - - 0 1', 'ترقية البيدق', 'رقِّ البيدق إلى وزير.', 'white', 12, 9, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e7e8q')), NOW(), NOW()),

('ترقية بيادق 2 (للأسود)', 'easy', '8/8/8/8/8/6k1/4p3/6K1 b - - 0 1', 'ترقية البيدق', 'رقِّ البيدق الأسود.', 'black', 12, 10, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e2e1q')), NOW(), NOW()),

('مات بقطعة ثقيلة', 'medium', '6k1/5pp1/8/8/8/3B4/5PP1/6KQ w - - 0 1', 'مات في نقلة واحدة', 'نسّق بين القطع.', 'white', 14, 11, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','h1h8')), NOW(), NOW()),

('رخ مقابل رخ', 'medium', '4k3/8/8/8/4r3/8/4R3/4K3 w - - 0 1', 'اكسب المادة', 'تبديل رابح.', 'white', 10, 12, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e2e4')), NOW(), NOW()),

('التقاط رخ بالحصان', 'medium', '4k3/8/8/3r4/8/2N5/8/4K3 w - - 0 1', 'اكسب الرخ', 'نقلة حصان تكتيكية.', 'white', 10, 13, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','c3d5')), NOW(), NOW()),

('التقاط رخ بالوزير', 'medium', '4k3/8/8/3r4/4Q3/8/8/4K3 w - - 0 1', 'اكسب الرخ', 'التقاط مباشر.', 'white', 10, 14, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e4d5')), NOW(), NOW()),

('مات بالرخ من العمود', 'medium', '7k/8/8/8/8/6K1/5R2/7R w - - 0 1', 'مات في نقلة واحدة', 'استغل العمود المفتوح.', 'white', 14, 15, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','h1h8')), NOW(), NOW()),

('مات بالرخ من الطرف', 'medium', 'k7/8/1K6/8/8/8/8/R7 w - - 0 1', 'مات في نقلة واحدة', 'ضربة طرفية قوية.', 'white', 14, 16, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','a1a8')), NOW(), NOW()),

('مات بالوزير في المنتصف', 'hard', '3k4/3Q4/3K4/8/8/8/8/8 w - - 0 1', 'مات فوري', 'تمركز مثالي للوزير.', 'white', 16, 17, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','d7d8')), NOW(), NOW()),

('مات بالوزير على العمود', 'hard', '4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة', 'ادفع الملك للحافة.', 'white', 16, 18, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e5e8')), NOW(), NOW()),

('مات بالوزير من a-file', 'hard', 'k7/8/1K6/8/8/8/Q7/8 w - - 0 1', 'مات في نقلة واحدة', 'حسم مباشر من العمود a.', 'white', 16, 19, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','a2a8')), NOW(), NOW()),

('مات بالرخ من g-file', 'hard', '6k1/8/6K1/8/8/8/6R1/8 w - - 0 1', 'مات في نقلة واحدة', 'ضربة نهائية بالرخ.', 'white', 16, 20, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','g2g8')), NOW(), NOW()),

-- 21..25 (الألغاز التي أرسلتها)
('مات في نقلة واحدة (الوزير)', 'easy', 'k7/1QK5/8/8/8/8/8/8 w - - 0 1', 'مات في نقلة واحدة',
 'استغل تمركز الملك والوزير لإنهاء المباراة فورًا.', 'white', 10, 21, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','b7b8')), NOW(), NOW()),

('اكسب الوزير', 'easy', '6k1/3q1ppp/5N2/8/8/8/6PP/6K1 w - - 0 1', 'اكسب قطعة قوية (الوزير)',
 'نقلة تكتيكية مباشرة لكسب الوزير الأسود.', 'white', 8, 22, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','f6d7')), NOW(), NOW()),

('مات الباحث (خط إجباري)', 'medium', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'مات في 4 نقلات',
 'اتبع السلسلة الصحيحة حتى المات.', 'white', 20, 23, 1,
 JSON_ARRAY(
   JSON_OBJECT('actor','player','uci','e2e4'),
   JSON_OBJECT('actor','opponent','uci','e7e5'),
   JSON_OBJECT('actor','player','uci','d1h5'),
   JSON_OBJECT('actor','opponent','uci','b8c6'),
   JSON_OBJECT('actor','player','uci','f1c4'),
   JSON_OBJECT('actor','opponent','uci','g8f6'),
   JSON_OBJECT('actor','player','uci','h5f7')
 ), NOW(), NOW()),

('مات الأحمق للأسود', 'medium', 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1', 'نفّذ مات الأحمق',
 'ابدأ أنت (الأسود) وأنهِ المات بسرعة.', 'black', 18, 24, 1,
 JSON_ARRAY(
   JSON_OBJECT('actor','player','uci','e7e5'),
   JSON_OBJECT('actor','opponent','uci','g2g4'),
   JSON_OBJECT('actor','player','uci','d8h4')
 ), NOW(), NOW()),

('ترقية البيدق', 'hard', '5k2/4P3/4K3/8/8/8/8/8 w - - 0 1', 'قم بترقية البيدق',
 'الحل يعتمد على الترقية الصحيحة في النقلة الأولى.', 'white', 15, 25, 1,
 JSON_ARRAY(JSON_OBJECT('actor','player','uci','e7e8q')), NOW(), NOW());

COMMIT;

-- ==========================================
-- Game Live Chat (WhatsApp-style in-game chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS game_chat_message (
  id BIGINT NOT NULL AUTO_INCREMENT,
  game_id INT NOT NULL,
  user_id INT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_game_chat_game_created (game_id, created_at),
  KEY idx_game_chat_user_created (user_id, created_at),
  CONSTRAINT fk_game_chat_game FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_chat_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
