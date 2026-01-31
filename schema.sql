-- Active: 1769876809360@@127.0.0.1@3306@videotube
CREATE DATABASE IF NOT EXISTS videotube;
USE videotube;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- In a real app, store hashed passwords!
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    thumbnail_url VARCHAR(255),
    channel_name VARCHAR(255),
    channel_avatar_url VARCHAR(255),
    view_count VARCHAR(50),
    video_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_later (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    video_id VARCHAR(255), -- Storing the ID from the frontend (could be URL or int)
    video_data TEXT, -- Storing the JSON object for the video card
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Modify watch_later table to use INT for video_id and reference videos(id)
-- IMPORTANT: If you have existing data in watch_later where video_id is a URL string,
-- you will need to manually migrate or clear that data before running this ALTER TABLE.
-- For a fresh database, this will work directly.
ALTER TABLE watch_later
MODIFY COLUMN video_id INT NOT NULL,
ADD CONSTRAINT fk_watch_later_video
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert some dummy videos
INSERT INTO videos (title, thumbnail_url, channel_name, channel_avatar_url, view_count, created_at) VALUES 
('Building a Website', 'https://picsum.photos/seed/1/320/180', 'Coding Academy', 'https://picsum.photos/seed/avatar1/50', '500K', NOW()),
('Nature Documentary', 'https://picsum.photos/seed/2/320/180', 'Wanderlust TV', 'https://picsum.photos/seed/avatar2/50', '1.2M', NOW()),
('Gaming Highlights', 'https://picsum.photos/seed/3/320/180', 'Gaming Pro', 'https://picsum.photos/seed/avatar3/50', '800K', NOW());