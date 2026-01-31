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