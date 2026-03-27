-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 27, 2026 at 02:00 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `chess_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `friend`
--

CREATE TABLE `friend` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `friend_user_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Table structure for table `game`
--

CREATE TABLE `game` (
  `id` int(11) NOT NULL,
  `white_player_id` int(11) NOT NULL,
  `black_player_id` int(11) NOT NULL,
  `started_by_user_id` int(11) NOT NULL,
  `game_type` enum('friend','ranked','ai','puzzle') NOT NULL,
  `ai_level` tinyint(4) DEFAULT NULL,
  `puzzle_id` int(11) DEFAULT NULL,
  `initial_time` int(11) NOT NULL,
  `white_time_left` int(11) NOT NULL,
  `black_time_left` int(11) NOT NULL,
  `white_play_method` enum('phone','physical_board') NOT NULL,
  `black_play_method` enum('phone','physical_board') NOT NULL,
  `current_fen` varchar(100) NOT NULL DEFAULT 'startpos',
  `status` enum('waiting','active','ended') NOT NULL DEFAULT 'waiting',
  `current_turn` enum('white','black') NOT NULL DEFAULT 'white',
  `winner_id` int(11) DEFAULT NULL,
  `white_rank_change` int(11) DEFAULT NULL,
  `black_rank_change` int(11) DEFAULT NULL,
  `started_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Table structure for table `game_move`
--

CREATE TABLE `game_move` (
  `id` int(11) NOT NULL,
  `game_id` int(11) NOT NULL,
  `move_number` int(11) NOT NULL,
  `player_id` int(11) NOT NULL,
  `uci` varchar(8) NOT NULL,
  `san` varchar(16) DEFAULT NULL,
  `fen_after` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invites`
--

CREATE TABLE `invites` (
  `id` int(11) NOT NULL,
  `from_user_id` int(11) NOT NULL,
  `to_user_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected','expired','game_started') NOT NULL DEFAULT 'pending',
  `game_type` enum('friendly','competitive') NOT NULL DEFAULT 'friendly',
  `time_control` int(11) NOT NULL DEFAULT 10,
  `play_method` enum('physical_board','phone') DEFAULT 'phone',
  `date_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `game_id` int(11) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ;

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session`
--

CREATE TABLE `session` (
  `id` varchar(512) NOT NULL,
  `user_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `type` enum('user','admin') NOT NULL DEFAULT 'user',
  `is_banned` tinyint(1) NOT NULL DEFAULT 0,
  `banned_at` timestamp NULL DEFAULT NULL,
  `banned_reason` varchar(255) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `thumbnail` varchar(255) DEFAULT '/img/default-avatar.png',
  `rank` int(11) NOT NULL DEFAULT 1500,
  `puzzle_level` int(11) DEFAULT 1,
  `state` enum('online','offline','in-game') NOT NULL DEFAULT 'offline',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ;

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_course`
--

CREATE TABLE `user_course` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `purchase_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  ADD KEY `idx_course_category` (`category_id`),
  ADD KEY `idx_course_level` (`level`);

--
-- Indexes for table `course_video`
--
ALTER TABLE `course_video`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course_video_course_id` (`course_id`),
  ADD KEY `idx_course_video_position` (`position`);

--
-- Indexes for table `friend`
--
ALTER TABLE `friend`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_friendship` (`user_id`,`friend_user_id`),
  ADD KEY `idx_friend_user_id` (`user_id`),
  ADD KEY `idx_friend_friend_user_id` (`friend_user_id`),
  ADD KEY `idx_friend_status` (`status`);

--
-- Indexes for table `game`
--
ALTER TABLE `game`
  ADD PRIMARY KEY (`id`),
  ADD KEY `started_by_user_id` (`started_by_user_id`),
  ADD KEY `winner_id` (`winner_id`),
  ADD KEY `puzzle_id` (`puzzle_id`),
  ADD KEY `idx_game_white_player` (`white_player_id`),
  ADD KEY `idx_game_black_player` (`black_player_id`),
  ADD KEY `idx_game_status` (`status`),
  ADD KEY `idx_game_type` (`game_type`),
  ADD KEY `idx_game_started_at` (`started_at`),
  ADD KEY `idx_game_status_created` (`status`,`created_at`),
  ADD KEY `idx_game_user_status_ended` (`white_player_id`,`status`,`ended_at`),
  ADD KEY `idx_game_user_status_ended_black` (`black_player_id`,`status`,`ended_at`),
  ADD KEY `idx_game_ended_at` (`ended_at`);

--
-- Indexes for table `game_move`
--
ALTER TABLE `game_move`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_game_move_game_id` (`game_id`),
  ADD KEY `idx_game_move_player_id` (`player_id`),
  ADD KEY `idx_game_move_move_number` (`move_number`);

--
-- Indexes for table `invites`
--
ALTER TABLE `invites`
  ADD PRIMARY KEY (`id`),
  ADD KEY `game_id` (`game_id`),
  ADD KEY `idx_invites_from_user` (`from_user_id`),
  ADD KEY `idx_invites_to_user` (`to_user_id`),
  ADD KEY `idx_invites_status` (`status`),
  ADD KEY `idx_invites_expires_at` (`expires_at`),
  ADD KEY `idx_invites_status_date_deleted` (`status`,`date_time`,`deleted_at`);

--
-- Indexes for table `puzzle`
--
ALTER TABLE `puzzle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_puzzle_level` (`level`);

--
-- Indexes for table `session`
--
ALTER TABLE `session`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_session_user_id` (`user_id`),
  ADD KEY `idx_session_expires_at` (`expires_at`),
  ADD KEY `idx_session_user_expires_deleted` (`user_id`,`expires_at`,`deleted_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_email` (`email`),
  ADD KEY `idx_users_username` (`username`),
  ADD KEY `idx_users_rank` (`rank`),
  ADD KEY `idx_users_state` (`state`),
  ADD KEY `idx_users_is_banned_created` (`is_banned`,`created_at`);

--
-- Indexes for table `user_board`
--
ALTER TABLE `user_board`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial_number` (`serial_number`),
  ADD KEY `idx_user_board_user_id` (`user_id`),
  ADD KEY `idx_user_board_serial` (`serial_number`);

--
-- Indexes for table `user_course`
--
ALTER TABLE `user_course`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_course` (`user_id`,`course_id`),
  ADD KEY `idx_user_course_user_id` (`user_id`),
  ADD KEY `idx_user_course_course_id` (`course_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `course`
--
ALTER TABLE `course`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `course_video`
--
ALTER TABLE `course_video`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `friend`
--
ALTER TABLE `friend`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `game`
--
ALTER TABLE `game`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `game_move`
--
ALTER TABLE `game_move`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invites`
--
ALTER TABLE `invites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `puzzle`
--
ALTER TABLE `puzzle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_board`
--
ALTER TABLE `user_board`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_course`
--
ALTER TABLE `user_course`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `course`
--
ALTER TABLE `course`
  ADD CONSTRAINT `course_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `course_video`
--
ALTER TABLE `course_video`
  ADD CONSTRAINT `course_video_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `friend`
--
ALTER TABLE `friend`
  ADD CONSTRAINT `friend_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `friend_ibfk_2` FOREIGN KEY (`friend_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `game`
--
ALTER TABLE `game`
  ADD CONSTRAINT `game_ibfk_1` FOREIGN KEY (`white_player_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `game_ibfk_2` FOREIGN KEY (`black_player_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `game_ibfk_3` FOREIGN KEY (`started_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `game_ibfk_4` FOREIGN KEY (`winner_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `game_ibfk_5` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzle` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `game_move`
--
ALTER TABLE `game_move`
  ADD CONSTRAINT `game_move_ibfk_1` FOREIGN KEY (`game_id`) REFERENCES `game` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `game_move_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `invites`
--
ALTER TABLE `invites`
  ADD CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invites_ibfk_3` FOREIGN KEY (`game_id`) REFERENCES `game` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `session`
--
ALTER TABLE `session`
  ADD CONSTRAINT `session_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `user_board`
--
ALTER TABLE `user_board`
  ADD CONSTRAINT `user_board_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `user_course`
--
ALTER TABLE `user_course`
  ADD CONSTRAINT `user_course_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_course_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
