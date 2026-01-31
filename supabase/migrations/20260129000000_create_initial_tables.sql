-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Channels table
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(255) NOT NULL,
    thumbnail_url VARCHAR(255),
    view_count BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    user_id UUID NOT NULL REFERENCES users(id),
    channel_id UUID NOT NULL REFERENCES channels(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, channel_id)
);

-- Likes table
CREATE TABLE likes (
    user_id UUID NOT NULL REFERENCES users(id),
    video_id UUID NOT NULL REFERENCES videos(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, video_id)
);

-- Playlists table
CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- PlaylistVideos table
CREATE TABLE playlist_videos (
    playlist_id UUID NOT NULL REFERENCES playlists(id),
    video_id UUID NOT NULL REFERENCES videos(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (playlist_id, video_id)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    video_id UUID NOT NULL REFERENCES videos(id),
    parent_comment_id UUID REFERENCES comments(id), -- For replies
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Views table
CREATE TABLE views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id), -- Can be null for anonymous viewers
    video_id UUID NOT NULL REFERENCES videos(id),
    viewed_at TIMESTAMPTZ DEFAULT now()
);
