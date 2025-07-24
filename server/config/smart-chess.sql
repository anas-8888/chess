-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 17, 2025 at 05:48 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `smart-chess`
--

-- --------------------------------------------------------

--
-- Table structure for table `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `category`
--

INSERT INTO `category` (`id`, `name`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Openings', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 'intermediate', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(4, 'Tactics', '2025-06-29 11:29:34', '2025-06-29 11:29:34', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `course`
--

CREATE TABLE `course` (
  `id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `details` varchar(200) DEFAULT NULL,
  `level` enum('beginner','intermediate','pro') DEFAULT 'beginner',
  `image_url` varchar(255) DEFAULT NULL,
  `hours` decimal(4,1) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course`
--

INSERT INTO `course` (`id`, `category_id`, `name`, `details`, `level`, `image_url`, `hours`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 1, 'المبادئ الأساسية للشطرنج', 'دورة للمبتدئين', 'beginner', 'https://i.imgur.com/basic.png', 2.5, '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 2, 'تكنيكات متقدمة', 'دورة للمتقدمين', 'intermediate', 'https://i.imgur.com/advanced.png', 5.0, '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `course_video`
--

CREATE TABLE `course_video` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `url` varchar(255) NOT NULL,
  `position` int(11) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course_video`
--

INSERT INTO `course_video` (`id`, `course_id`, `title`, `url`, `position`, `created_at`, `deleted_at`) VALUES
(1, 1, 'الدرس الأول: الحركات الأساسية', 'https://youtu.be/example1', 1, '2025-06-27 15:42:11', NULL),
(2, 1, 'الدرس الثاني: فتحات بسيطة', 'https://youtu.be/example2', 2, '2025-06-27 15:42:11', NULL),
(3, 2, 'الدرس الثالث: تكتيكات', 'https://youtu.be/example3', 1, '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `friend`
--

CREATE TABLE `friend` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `friend_user_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `friend`
--

INSERT INTO `friend` (`id`, `user_id`, `friend_user_id`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 1, 2, 'accepted', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 1, 3, 'pending', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(3, 2, 3, 'accepted', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `game`
--

CREATE TABLE `game` (
  `id` int(11) NOT NULL,
  `white_user_id` int(11) NOT NULL,
  `black_user_id` int(11) NOT NULL,
  `white_play_method` enum('local','board') NOT NULL,
  `black_play_method` enum('local','board') NOT NULL,
  `game_time` enum('5','10','15') DEFAULT '5',
  `mode` enum('friend','random','ai','challenge') NOT NULL,
  `white_rating_change` int(11) DEFAULT NULL,
  `black_rating_change` int(11) DEFAULT NULL,
  `date_time` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `game`
--

INSERT INTO `game` (`id`, `white_user_id`, `black_user_id`, `white_play_method`, `black_play_method`, `game_time`, `mode`, `white_rating_change`, `black_rating_change`, `date_time`, `deleted_at`) VALUES
(1, 1, 2, 'local', 'board', '5', 'friend', 10, -10, '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `game_move`
--

CREATE TABLE `game_move` (
  `id` int(11) NOT NULL,
  `game_id` int(11) NOT NULL,
  `move_number` int(11) NOT NULL,
  `move` varchar(10) NOT NULL,
  `moved_by` enum('white','black') NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `game_move`
--

INSERT INTO `game_move` (`id`, `game_id`, `move_number`, `move`, `moved_by`, `created_at`, `deleted_at`) VALUES
(1, 1, 1, 'e4', 'white', '2025-06-27 15:42:11', NULL),
(2, 1, 1, 'e5', 'black', '2025-06-27 15:42:11', NULL),
(3, 1, 2, 'Nf3', 'white', '2025-06-27 15:42:11', NULL),
(4, 1, 2, 'Nc6', 'black', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `invites`
--

CREATE TABLE `invites` (
  `id` int(11) NOT NULL,
  `from_user_id` int(11) NOT NULL,
  `to_user_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `date_time` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `invites`
--

INSERT INTO `invites` (`id`, `from_user_id`, `to_user_id`, `status`, `date_time`, `deleted_at`) VALUES
(1, 1, 3, 'pending', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `puzzle`
--

CREATE TABLE `puzzle` (
  `id` int(11) NOT NULL,
  `name` varchar(200) DEFAULT NULL,
  `level` enum('easy','medium','hard') DEFAULT 'easy',
  `fen` varchar(200) NOT NULL,
  `details` varchar(200) DEFAULT NULL,
  `solution` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`solution`)),
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `puzzle`
--

INSERT INTO `puzzle` (`id`, `name`, `level`, `fen`, `details`, `solution`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'مفتاح الشعاع', 'easy', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'ابدأ بتحريك الحصان للسيطرة على المركز', '\"[\\\"Nxe5\\\",\\\"Nxe5\\\",\\\"d4\\\",\\\"Nc6\\\"]\"', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 'هجوم الفيل', 'medium', 'rnbqkbnr/pp1ppppp/2p5/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2', 'استغل ضعف الملك في الطرف', '\"[\\\"d4\\\",\\\"cxd4\\\",\\\"Nxd4\\\",\\\"e5\\\"]\"', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `session`
--

CREATE TABLE `session` (
  `id` varchar(512) NOT NULL,
  `user_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `last_activity` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'user',
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `thumbnail` varchar(255) DEFAULT NULL,
  `rank` int(11) DEFAULT 1200,
  `puzzle_level` int(11) DEFAULT 1,
  `state` enum('online','offline','in-game') DEFAULT 'online',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `type`, `email`, `password_hash`, `thumbnail`, `rank`, `puzzle_level`, `state`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'bashar', 'user', 'bashar@example.com', 'hash1', 'https://i.imgur.com/1Q9Z1Zm.png', 1400, 2, 'online', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 'ahmad', 'user', 'ahmad@example.com', 'hash2', 'https://i.imgur.com/2Q9Z1Zm.png', 1350, 1, 'offline', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(3, 'laila', 'user', 'laila@example.com', 'hash3', 'https://i.imgur.com/3Q9Z1Zm.png', 1500, 3, 'in-game', '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(4, 'anas', 'admin', 'anas@example.com', '$2b$12$JMUNuUgTCmRYKSVgBvyPJ.vMSPa/pW83jS7R98GoGZ5SkMzVE3cP2', 'https://i.imgur.com/default.png', 1200, 1, 'online', '2025-06-27 17:11:14', '2025-06-28 10:25:55', NULL),
(5, 'zakaria', 'user', 'zak@test.com', '$2b$12$5VsNSE2IH8oVRbel9bRV5.TssLz0w788h4V8rFGa/OHJueM0tUMqu', 'https://i.imgur.com/default.png', 1200, 1, 'offline', '2025-06-28 10:29:30', '2025-06-28 10:29:30', NULL),
(6, 'zakaria1', 'user', 'zak1@test.com', '$2b$12$jL6YXAhBvJ/Q85YYRK08PunmAlN1aFDo1xWozy9rImv5pDzcsLwJq', 'https://i.imgur.com/default.png', 1200, 1, 'offline', '2025-06-28 10:30:09', '2025-06-28 10:30:09', NULL),
(8, 'anas1', 'admin', 'anas1@example.com', '$2b$12$HPKINKXgUDP9PkWMNy1gFO6cXrjZ1n8lU.lMnKPYeemxrjPwdIgwu', 'https://i.imgur.com/default.png', 1200, 1, 'online', '2025-06-28 10:36:48', '2025-06-28 10:36:48', NULL),
(9, 'testuser', 'admin', 'test@example.com', '$2b$12$zSR2dQmAMKcYHb6pbfAz...LTRO7oS.MydtdzPONLdIqtW6hN6aVe', 'https://i.imgur.com/default.png', 1200, 4, 'online', '2025-06-29 10:38:17', '2025-07-01 23:44:01', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_board`
--

CREATE TABLE `user_board` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `connected` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_board`
--

INSERT INTO `user_board` (`id`, `user_id`, `serial_number`, `name`, `connected`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 1, 'ABC123XYZ', 'لوحة المكتب', 1, '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL),
(2, 2, 'DEF456UVW', 'لوحة الغرفة', 0, '2025-06-27 15:42:11', '2025-06-27 15:42:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_course`
--

CREATE TABLE `user_course` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `purchase_at` datetime DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_course`
--

INSERT INTO `user_course` (`id`, `user_id`, `course_id`, `purchase_at`, `is_deleted`, `deleted_at`) VALUES
(1, 9, 1, '2025-06-27 15:42:11', 0, NULL),
(2, 9, 2, '2025-06-27 15:42:11', 0, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `course`
--
ALTER TABLE `course`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `course_video`
--
ALTER TABLE `course_video`
  ADD PRIMARY KEY (`id`),
  ADD KEY `course_id` (`course_id`);

--
-- Indexes for table `friend`
--
ALTER TABLE `friend`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `friend_user_id` (`friend_user_id`);

--
-- Indexes for table `game`
--
ALTER TABLE `game`
  ADD PRIMARY KEY (`id`),
  ADD KEY `white_user_id` (`white_user_id`),
  ADD KEY `black_user_id` (`black_user_id`);

--
-- Indexes for table `game_move`
--
ALTER TABLE `game_move`
  ADD PRIMARY KEY (`id`),
  ADD KEY `game_id` (`game_id`);

--
-- Indexes for table `invites`
--
ALTER TABLE `invites`
  ADD PRIMARY KEY (`id`),
  ADD KEY `from_user_id` (`from_user_id`),
  ADD KEY `to_user_id` (`to_user_id`);

--
-- Indexes for table `puzzle`
--
ALTER TABLE `puzzle`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `session`
--
ALTER TABLE `session`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_board`
--
ALTER TABLE `user_board`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial_number` (`serial_number`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `user_course`
--
ALTER TABLE `user_course`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `course_id` (`course_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `course`
--
ALTER TABLE `course`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `course_video`
--
ALTER TABLE `course_video`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `friend`
--
ALTER TABLE `friend`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `game`
--
ALTER TABLE `game`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `game_move`
--
ALTER TABLE `game_move`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `invites`
--
ALTER TABLE `invites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `puzzle`
--
ALTER TABLE `puzzle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `user_board`
--
ALTER TABLE `user_board`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_course`
--
ALTER TABLE `user_course`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `course`
--
ALTER TABLE `course`
  ADD CONSTRAINT `course_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `course_video`
--
ALTER TABLE `course_video`
  ADD CONSTRAINT `course_video_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `friend`
--
ALTER TABLE `friend`
  ADD CONSTRAINT `friend_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `friend_ibfk_2` FOREIGN KEY (`friend_user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `game`
--
ALTER TABLE `game`
  ADD CONSTRAINT `game_ibfk_1` FOREIGN KEY (`white_user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `game_ibfk_2` FOREIGN KEY (`black_user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `game_move`
--
ALTER TABLE `game_move`
  ADD CONSTRAINT `game_move_ibfk_1` FOREIGN KEY (`game_id`) REFERENCES `game` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `invites`
--
ALTER TABLE `invites`
  ADD CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `session`
--
ALTER TABLE `session`
  ADD CONSTRAINT `session_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `user_board`
--
ALTER TABLE `user_board`
  ADD CONSTRAINT `user_board_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `user_course`
--
ALTER TABLE `user_course`
  ADD CONSTRAINT `user_course_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `user_course_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
