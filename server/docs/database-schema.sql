-- =====================================================
-- Smart Chess Database Schema
-- =====================================================

-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS chess_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE chess_db;

-- =====================================================
-- جدول المستخدمين
-- =====================================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    thumbnail VARCHAR(255) DEFAULT '/img/default-avatar.png',
    rank INT DEFAULT 1200,
    puzzle_level INT DEFAULT 1,
    state ENUM('online', 'offline', 'in-game') DEFAULT 'offline' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Constraints
    CHECK (rank >= 0 AND rank <= 3000),
    CHECK (puzzle_level >= 1 AND puzzle_level <= 10),
    CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 50),
    CHECK (username REGEXP '^[a-zA-Z0-9_]+$')
);

-- =====================================================
-- جدول الجلسات
-- =====================================================
CREATE TABLE session (
    id VARCHAR(512) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    last_activity TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =====================================================
-- جدول التصنيفات
-- =====================================================
CREATE TABLE category (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- =====================================================
-- جدول الدورات
-- =====================================================
CREATE TABLE course (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    details VARCHAR(200),
    level ENUM('beginner', 'intermediate', 'pro') DEFAULT 'beginner',
    image_url VARCHAR(255),
    hours DECIMAL(4,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
);

-- =====================================================
-- جدول فيديوهات الدورات
-- =====================================================
CREATE TABLE course_video (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    url VARCHAR(255) NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
);

-- =====================================================
-- جدول دورات المستخدمين
-- =====================================================
CREATE TABLE user_course (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    purchase_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_course (user_id, course_id)
);

-- =====================================================
-- جدول الأصدقاء
-- =====================================================
CREATE TABLE friend (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    friend_user_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (friend_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_user_id),
    CHECK (user_id != friend_user_id)
);

-- =====================================================
-- جدول الألغاز
-- =====================================================
CREATE TABLE puzzle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200),
    level ENUM('easy', 'medium', 'hard') DEFAULT 'easy',
    fen VARCHAR(200) NOT NULL,
    details VARCHAR(200),
    solution JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- =====================================================
-- جدول رقعة الشطرنج للمستخدمين
-- =====================================================
CREATE TABLE user_board (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100),
    connected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =====================================================
-- جدول الألعاب
-- =====================================================
CREATE TABLE game (
    id INT AUTO_INCREMENT PRIMARY KEY,
    white_player_id INT NOT NULL,
    black_player_id INT NOT NULL,
    started_by_user_id INT NOT NULL,
    game_type ENUM('friend', 'ranked', 'ai', 'puzzle') NOT NULL,
    ai_level INT NULL,
    puzzle_id INT NULL,
    initial_time INT NOT NULL,
    white_time_left INT NOT NULL,
    black_time_left INT NOT NULL,
    white_play_method ENUM('phone', 'physical_board') NOT NULL,
    black_play_method ENUM('phone', 'physical_board') NOT NULL,
    current_fen VARCHAR(100) NOT NULL DEFAULT 'startpos',
    status ENUM('waiting', 'active', 'ended') NOT NULL DEFAULT 'waiting',
    current_turn ENUM('white', 'black') NOT NULL DEFAULT 'white',
    winner_id INT NULL,
    white_rank_change INT NULL,
    black_rank_change INT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (white_player_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (black_player_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (started_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (puzzle_id) REFERENCES puzzle(id) ON DELETE SET NULL,
    CHECK (white_player_id != black_player_id)
);

-- =====================================================
-- جدول حركات اللعبة
-- =====================================================
CREATE TABLE game_move (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    move_number INT NOT NULL,
    player_id INT NOT NULL,
    uci VARCHAR(8) NOT NULL,
    san VARCHAR(16) NULL,
    fen_after VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =====================================================
-- جدول الدعوات
-- =====================================================
CREATE TABLE invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'expired', 'game_started') DEFAULT 'pending' NOT NULL,
    game_type ENUM('friendly', 'competitive') DEFAULT 'friendly' NOT NULL,
    time_control INT DEFAULT 10 NOT NULL,
    play_method ENUM('physical_board', 'phone') DEFAULT 'phone',
    date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    game_id INT NULL,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (from_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE SET NULL,
    CHECK (from_user_id != to_user_id)
);

-- =====================================================
-- إنشاء الفهارس لتحسين الأداء
-- =====================================================

-- فهارس جدول المستخدمين
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_rank ON users(rank);
CREATE INDEX idx_users_state ON users(state);

-- فهارس جدول الجلسات
CREATE INDEX idx_session_user_id ON session(user_id);
CREATE INDEX idx_session_expires_at ON session(expires_at);

-- فهارس جدول الألعاب
CREATE INDEX idx_game_white_player ON game(white_player_id);
CREATE INDEX idx_game_black_player ON game(black_player_id);
CREATE INDEX idx_game_status ON game(status);
CREATE INDEX idx_game_type ON game(game_type);
CREATE INDEX idx_game_started_at ON game(started_at);

-- فهارس جدول حركات اللعبة
CREATE INDEX idx_game_move_game_id ON game_move(game_id);
CREATE INDEX idx_game_move_player_id ON game_move(player_id);
CREATE INDEX idx_game_move_move_number ON game_move(move_number);

-- فهارس جدول الأصدقاء
CREATE INDEX idx_friend_user_id ON friend(user_id);
CREATE INDEX idx_friend_friend_user_id ON friend(friend_user_id);
CREATE INDEX idx_friend_status ON friend(status);

-- فهارس جدول الدعوات
CREATE INDEX idx_invites_from_user ON invites(from_user_id);
CREATE INDEX idx_invites_to_user ON invites(to_user_id);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);

-- فهارس جدول الدورات
CREATE INDEX idx_course_category ON course(category_id);
CREATE INDEX idx_course_level ON course(level);

-- فهارس جدول فيديوهات الدورات
CREATE INDEX idx_course_video_course_id ON course_video(course_id);
CREATE INDEX idx_course_video_position ON course_video(position);

-- فهارس جدول دورات المستخدمين
CREATE INDEX idx_user_course_user_id ON user_course(user_id);
CREATE INDEX idx_user_course_course_id ON user_course(course_id);

-- فهارس جدول الألغاز
CREATE INDEX idx_puzzle_level ON puzzle(level);

-- فهارس جدول رقعة الشطرنج
CREATE INDEX idx_user_board_user_id ON user_board(user_id);
CREATE INDEX idx_user_board_serial ON user_board(serial_number);

-- =====================================================
-- إنشاء مستخدم افتراضي للمشرف
-- =====================================================
INSERT INTO users (username, type, email, password_hash, rank, puzzle_level) 
VALUES ('admin', 'admin', 'admin@chess.com', '$2b$10$default_hash_here', 1500, 1);

-- =====================================================
-- إنشاء تصنيفات افتراضية
-- =====================================================
INSERT INTO category (name) VALUES 
('أساسيات الشطرنج'),
('الافتتاحيات'),
('الوسطيات'),
('النهايات'),
('الاستراتيجيات'),
('التكتيكات');

-- =====================================================
-- إنشاء ألغاز افتراضية
-- =====================================================
INSERT INTO puzzle (name, level, fen, details, solution) VALUES 
('مات في حركة واحدة', 'easy', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'ابحث عن مات في حركة واحدة', '["e2e4"]'),
('كش مزدوج', 'medium', 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', 'كش مزدوج للأسود', '["d2d4", "e5d4"]');

-- =====================================================
-- إنشاء دورات افتراضية
-- =====================================================
INSERT INTO course (category_id, name, details, level, hours) VALUES 
(1, 'مقدمة في الشطرنج', 'تعلم أساسيات اللعبة', 'beginner', 2.0),
(2, 'الافتتاحيات الأساسية', 'أفضل الافتتاحيات للمبتدئين', 'beginner', 3.0),
(3, 'استراتيجيات الوسطية', 'كيفية تطوير اللعبة', 'intermediate', 4.0);

-- =====================================================
-- إنشاء فيديوهات للدورات
-- =====================================================
INSERT INTO course_video (course_id, title, url, position) VALUES 
(1, 'تعريف القطع', 'https://example.com/video1.mp4', 1),
(1, 'حركة القطع', 'https://example.com/video2.mp4', 2),
(2, 'افتتاحية الملك', 'https://example.com/video3.mp4', 1),
(2, 'افتتاحية الوزير', 'https://example.com/video4.mp4', 2);

-- =====================================================
-- رسالة نجاح
-- =====================================================
SELECT 'Database created successfully!' as message;

