const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // REPLACE with your MySQL username
    password: '',      // REPLACE with your MySQL password
    database: 'videotube'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// --- File Upload Configuration ---

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Unique filename
    }
});

const upload = multer({ storage: storage });

// --- Auth Routes ---

app.post('/api/signup', (req, res) => {
    console.log('Received signup request:', req.body);
    const { email, password, full_name } = req.body;
    const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(full_name)}&background=random`;
    
    const sql = 'INSERT INTO users (email, password, full_name, avatar_url) VALUES (?, ?, ?, ?)';
    console.log('Executing SQL for signup:', sql, [email, password, full_name, avatar_url]);
    db.query(sql, [email, password, full_name, avatar_url], (err, result) => {
        if (err) {
            console.error('Database error during signup:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        // Return the new user
        const newUser = { id: result.insertId, email, full_name, avatar_url };
        console.log('Signup successful, new user ID:', result.insertId);
        res.json({ user: newUser });
    });
});

app.post('/api/login', (req, res) => {
    console.log('Received login request:', req.body);
    const { email, password } = req.body;
    
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    console.log('Executing SQL for login:', sql, [email, password]);
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length > 0) {
            console.log('Login successful for user:', email);
            const user = results[0];
            // Don't send password back
            delete user.password;
            res.json({ user });
        } else {
            console.log('Invalid login credentials for email:', email);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

app.post('/api/upload', upload.single('video'), (req, res) => {
    const file = req.file;
    const { title, channel_name, channel_avatar_url } = req.body;

    if (!file) {
        return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Construct the URL for the uploaded file
    const videoUrl = `/uploads/${file.filename}`; // Relative path for serving
    const thumbnailFilename = `thumb-${Date.now()}.png`; // Unique thumbnail filename
    const thumbnailUrl = `/uploads/${thumbnailFilename}`; // Relative path for serving
    const thumbnailPath = path.join(uploadDir, thumbnailFilename);

    // Generate thumbnail
    ffmpeg(file.path)
        .screenshots({
            timestamps: ['00:00:01'], // Take screenshot at 1 second mark
            filename: thumbnailFilename,
            folder: uploadDir,
            size: '320x180' // Standard video card thumbnail size
        })
        .on('end', () => {
            const viewCount = '0'; // Default view count

            const sql = 'INSERT INTO videos (title, thumbnail_url, channel_name, channel_avatar_url, view_count, video_url) VALUES (?, ?, ?, ?, ?, ?)';
            
            db.query(sql, [title, thumbnailUrl, channel_name, channel_avatar_url, viewCount, videoUrl], (err, result) => {
                if (err) {
                    // Clean up uploaded video and generated thumbnail if DB insert fails
                    fs.unlink(file.path, (unlinkErr) => { if (unlinkErr) console.error('Error deleting video file:', unlinkErr); });
                    fs.unlink(thumbnailPath, (unlinkErr) => { if (unlinkErr) console.error('Error deleting thumbnail file:', unlinkErr); });
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, video: { id: result.insertId, title, videoUrl, thumbnailUrl } });
            });
        })
        .on('error', (err) => {
            console.error('Error generating thumbnail:', err);
            // Clean up uploaded video if thumbnail generation fails
            fs.unlink(file.path, (unlinkErr) => { if (unlinkErr) console.error('Error deleting video file:', unlinkErr); });
            return res.status(500).json({ error: 'Failed to generate thumbnail' });
        })
        .run();
});

// Get single video details
app.get('/api/videos/:id', (req, res) => {
    const videoId = req.params.id;
    db.query('SELECT * FROM videos WHERE id = ?', [videoId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Video not found' });
        res.json(results[0]);
    });
});
// --- Video Routes ---

app.get('/api/videos', (req, res) => {
    db.query('SELECT * FROM videos', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- Watch Later Routes ---

app.get('/api/watch-later', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    db.query('SELECT video_data FROM watch_later WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Parse the JSON string back to object
        const videos = results.map(row => JSON.parse(row.video_data));
        res.json(videos);
    });
});

app.post('/api/watch-later', (req, res) => {
    const { user_id, video } = req.body;
    if (!user_id || !video) return res.status(400).json({ error: 'Missing data' });

    // Check if already exists to prevent duplicates
    db.query('SELECT id FROM watch_later WHERE user_id = ? AND video_id = ?', [user_id, video.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length === 0) {
            const sql = 'INSERT INTO watch_later (user_id, video_id, video_data) VALUES (?, ?, ?)';
            db.query(sql, [user_id, video.id, JSON.stringify(video)], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        } else {
            res.json({ success: true, message: 'Already in watch later' });
        }
    });
});

app.delete('/api/watch-later', (req, res) => {
    const { user_id, video_id } = req.body;
    
    const sql = 'DELETE FROM watch_later WHERE user_id = ? AND video_id = ?';
    db.query(sql, [user_id, video_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Playlists Routes ---

// Get all playlists for a user
app.get('/api/playlists', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const sql = 'SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error fetching playlists:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Create a new playlist
app.post('/api/playlists', (req, res) => {
    const { user_id, name } = req.body;
    if (!user_id || !name) return res.status(400).json({ error: 'User ID and playlist name required' });

    const sql = 'INSERT INTO playlists (user_id, name) VALUES (?, ?)';
    db.query(sql, [user_id, name], (err, result) => {
        if (err) {
            console.error('Database error creating playlist:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, playlist: { id: result.insertId, user_id, name, created_at: new Date() } });
    });
});

// Delete a playlist
app.delete('/api/playlists/:id', (req, res) => {
    const playlistId = req.params.id;
    const userId = req.query.user_id; // Ensure only owner can delete
    if (!playlistId || !userId) return res.status(400).json({ error: 'Playlist ID and User ID required' });

    const sql = 'DELETE FROM playlists WHERE id = ? AND user_id = ?';
    db.query(sql, [playlistId, userId], (err, result) => {
        if (err) {
            console.error('Database error deleting playlist:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Playlist not found or not owned by user' });
        res.json({ success: true, message: 'Playlist deleted' });
    });
});

// Get tracks in a playlist
app.get('/api/playlists/:id/tracks', (req, res) => {
    const playlistId = req.params.id;
    const sql = 'SELECT track_data FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC';
    db.query(sql, [playlistId], (err, results) => {
        if (err) {
            console.error('Database error fetching playlist tracks:', err);
            return res.status(500).json({ error: err.message });
        }
        const tracks = results.map(row => JSON.parse(row.track_data));
        res.json(tracks);
    });
});

// Add a track to a playlist
app.post('/api/playlists/:id/tracks', (req, res) => {
    const playlistId = req.params.id;
    const { track_data } = req.body; // track_data should be a JSON string or object
    if (!playlistId || !track_data) return res.status(400).json({ error: 'Playlist ID and track data required' });

    // Find the next position in the playlist
    db.query('SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id = ?', [playlistId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const nextPosition = (result[0].max_pos || 0) + 1;

        const sql = 'INSERT INTO playlist_tracks (playlist_id, track_data, position) VALUES (?, ?, ?)';
        db.query(sql, [playlistId, JSON.stringify(track_data), nextPosition], (err, insertResult) => {
            if (err) {
                console.error('Database error adding track to playlist:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Track added to playlist', track_id: insertResult.insertId });
        });
    });
});

// Remove a track from a playlist (by its unique ID in playlist_tracks table)
app.delete('/api/playlists/:playlistId/tracks/:trackId', (req, res) => {
    const { playlistId, trackId } = req.params;
    if (!playlistId || !trackId) return res.status(400).json({ error: 'Playlist ID and Track ID required' });

    const sql = 'DELETE FROM playlist_tracks WHERE playlist_id = ? AND id = ?';
    db.query(sql, [playlistId, trackId], (err, result) => {
        if (err) {
            console.error('Database error removing track from playlist:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Track not found in playlist' });
        res.json({ success: true, message: 'Track removed from playlist' });
    });
});

// --- Recently Played Music Routes ---

// Record a recently played track
app.post('/api/recently-played', (req, res) => {
    const { user_id, track_data } = req.body;
    if (!user_id || !track_data || !track_data.id) {
        return res.status(400).json({ error: 'User ID and track data with ID required' });
    }

    const trackId = track_data.id;
    const trackDataJson = JSON.stringify(track_data);

    // Check if the track already exists for the user
    const checkSql = 'SELECT id FROM recently_played_music WHERE user_id = ? AND track_id = ?';
    db.query(checkSql, [user_id, trackId], (err, results) => {
        if (err) {
            console.error('Database error checking recently played track:', err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length > 0) {
            // Track exists, update played_at timestamp
            const updateSql = 'UPDATE recently_played_music SET played_at = CURRENT_TIMESTAMP, track_data = ? WHERE id = ?';
            db.query(updateSql, [trackDataJson, results[0].id], (updateErr) => {
                if (updateErr) {
                    console.error('Database error updating recently played track:', updateErr);
                    return res.status(500).json({ error: updateErr.message });
                }
                res.json({ success: true, message: 'Recently played track updated' });
            });
        } else {
            // Track does not exist, insert new entry
            const insertSql = 'INSERT INTO recently_played_music (user_id, track_id, track_data) VALUES (?, ?, ?)';
            db.query(insertSql, [user_id, trackId, trackDataJson], (insertErr) => {
                if (insertErr) {
                    console.error('Database error inserting recently played track:', insertErr);
                    return res.status(500).json({ error: insertErr.message });
                }
                res.json({ success: true, message: 'Recently played track recorded' });
            });
        }
    });
});

// Get recently played tracks for a user
app.get('/api/recently-played', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Fetch distinct tracks, ordered by played_at, limit to a reasonable number
    const sql = `
        SELECT track_data
        FROM recently_played_music
        WHERE user_id = ?
        ORDER BY played_at DESC
        LIMIT 20
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error fetching recently played tracks:', err);
            return res.status(500).json({ error: err.message });
        }
        const tracks = results.map(row => JSON.parse(row.track_data));
        res.json(tracks);
    });
});

// Reorder tracks within a playlist
app.put('/api/playlists/:id/tracks/reorder', (req, res) => {
    const playlistId = req.params.id;
    const { reorderedTracks } = req.body; // Array of { track_db_id: ..., newPosition: ... }

    if (!playlistId || !Array.isArray(reorderedTracks)) {
        return res.status(400).json({ error: 'Playlist ID and reorderedTracks array required' });
    }

    const updatePromises = reorderedTracks.map(track => {
        return db.promise().query('UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?', [track.newPosition, track.track_db_id, playlistId]);
    });

    Promise.all(updatePromises)
        .then(() => res.json({ success: true, message: 'Tracks reordered successfully' }))
        .catch(err => {
            console.error('Database error reordering playlist tracks:', err);
            res.status(500).json({ error: err.message });
        });
});

// --- Comments Routes ---

app.get('/api/comments/:videoId', (req, res) => {
    const videoId = req.params.videoId;
    const sql = `
        SELECT c.*, u.full_name, u.avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.video_id = ?
        ORDER BY c.created_at DESC
    `;
    db.query(sql, [videoId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/comments', (req, res) => {
    const { video_id, user_id, comment_text } = req.body;
    if (!video_id || !user_id || !comment_text) {
        return res.status(400).json({ error: 'Missing required comment data' });
    }
    const sql = 'INSERT INTO comments (video_id, user_id, comment_text) VALUES (?, ?, ?)';
    db.query(sql, [video_id, user_id, comment_text], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        // Fetch the newly created comment with user details to return to frontend
        db.query(`
            SELECT c.*, u.full_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [result.insertId], (err, newComment) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, comment: newComment[0] });
        });
    });
});
// --- Profile Update (Mock) ---
app.post('/api/update-profile', (req, res) => {
    // In a real app, you'd update the DB here.
    // For now, we just echo back success.
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});