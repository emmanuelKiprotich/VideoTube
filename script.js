// --- API Configuration ---
const API_URL = 'http://localhost:3000/api';

document.getElementById('searchInput').addEventListener('keyup', function() {
    // 1. Get the text the user typed and convert to lowercase
    let filter = this.value.toLowerCase();
    
    // 2. Grab all the video cards
    let videoCards = document.querySelectorAll('.video-card');

    // 3. Loop through each card
    videoCards.forEach(card => {
        // Find the title inside this specific card
        let title = card.querySelector('.video-title').innerText.toLowerCase();

        // 4. If the title includes the search text, show it; otherwise, hide it
        if (title.includes(filter)) {
            card.style.display = ""; // Show
        } else {
            card.style.display = "none"; // Hide
        }
    });
});

// Show More / Show Less logic for Sidebar
const showMoreBtn = document.getElementById('showMoreBtn');
if (showMoreBtn) {
    showMoreBtn.addEventListener('click', function() {
        const hiddenSubs = document.querySelector('.hidden-subs');
        const btnText = this.querySelector('span');
        
        if (hiddenSubs.style.display === "none") {
            hiddenSubs.style.display = "block";
            btnText.innerText = "🔼 Show Less";
        } else {
            hiddenSubs.style.display = "none";
            btnText.innerText = "🔽 Show More";
        }
    });
}

// Sidebar Collapse Logic
const menuIcon = document.querySelector('.menu-icon');
const sidebar = document.querySelector('.sidebar-watch');
if (menuIcon && sidebar) {
    menuIcon.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// --- Watch Later Functionality ---

document.addEventListener('click', async function(e) {
    // Check if a watch later button was clicked
    if (e.target.classList.contains('watch-later-btn')) {
        e.preventDefault(); // Prevent the parent <a> tag from navigating
        e.stopPropagation(); // Stop the click from bubbling further

        const card = e.target.closest('.video-card');
        const videoId = card.getAttribute('data-video-id'); // Get the actual video ID
        
        // Fetch video details to get all necessary info for watch_later table
        try {
            const res = await fetch(`${API_URL}/videos/${videoId}`);
            if (!res.ok) throw new Error('Failed to fetch video details');
            const videoDetails = await res.json();

            // The videoDetails object from the backend has all the fields needed
            // We need to map it to the structure expected by watch_later
            const videoToSave = {
                id: videoDetails.id,
                title: videoDetails.title,
                thumbnail: videoDetails.thumbnail_url,
                channel: videoDetails.channel_name,
                // Add other fields if needed for display in watch later list
            };

            await addToWatchLater(videoToSave);
            alert(`'${videoDetails.title}' added to Watch Later!`);
        } catch (error) {
            console.error('Error adding to watch later:', error);
            alert('Failed to add video to Watch Later.');
        }
    }
    
    // Check if a remove button was clicked
    if (e.target.classList.contains('remove-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const card = e.target.closest('.video-card');
        const videoId = card.getAttribute('data-video-id');
        await removeFromWatchLater(videoId);
    }
});

async function addToWatchLater(video) {
    const user = getCurrentUser();

    if (user) {
        // Save to MySQL via API
        try {
            await fetch(`${API_URL}/watch-later`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, video: video })
            });
        } catch (error) {
            console.error('Error adding to watch later:', error);
        }
    } else {
        // Fallback to localStorage for guests
        let watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];
        if (!watchLaterList.some(v => v.id === video.id)) {
            watchLaterList.push(video);
            localStorage.setItem('watchLater', JSON.stringify(watchLaterList));
        }
    }
}

async function removeFromWatchLater(id) {
    const user = getCurrentUser();

    if (user) {
        // Remove from MySQL via API
        try {
            await fetch(`${API_URL}/watch-later`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, video_id: id })
            });
            renderWatchLater();
        } catch (error) { console.error(error); }
    } else {
        let watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];
        watchLaterList = watchLaterList.filter(v => v.id !== id);
        localStorage.setItem('watchLater', JSON.stringify(watchLaterList));
        renderWatchLater();
    }
}

async function renderWatchLater() {
    const container = document.getElementById('watch-later-list');
    // Only run this function if we are on a page with the watch later container (library.html)
    if (!container) return;

    const user = getCurrentUser(); // Get current user
    
    let watchLaterList = [];

    if (user) {
        // Fetch from MySQL API
        try {
            const res = await fetch(`${API_URL}/watch-later?user_id=${user.id}`);
            if (res.ok) {
                watchLaterList = await res.json();
            } else {
                console.error('Error fetching watch later videos:', res.statusText);
            }
        } catch (error) {
            console.error('Error fetching watch later videos:', error);
        }
    } else {
        // Fetch from LocalStorage for guests
        watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];
    }

    const placeholder = document.getElementById('watch-later-placeholder');

    if (watchLaterList.length > 0) {
        if (placeholder) placeholder.style.display = 'none';
        container.innerHTML = ''; // Clear the placeholder text
        watchLaterList.forEach(video => {
            const videoCardHTML = `
                <a href="watch.html?v=${video.id}" style="text-decoration: none; color: inherit;">
                    <div class="video-card" data-video-id="${video.id}">
                        <img src="${video.thumbnail}" class="thumbnail">
                        <div class="video-info">
                            <div class="text-info">
                                <h3 class="video-title">${video.title}</h3>
                                <p>${video.channel}</p>
                            </div>
                        </div>
                    </div>
                </a>`;
            container.innerHTML += videoCardHTML;
        });
    } else {
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.innerText = 'No videos in Watch Later.';
        }
        container.innerHTML = ''; // Clear any previous videos if list becomes empty
    }
}

// --- Video Grid Population ---
async function fetchVideos() {
    try {
        const res = await fetch(`${API_URL}/videos`);
        return await res.json();
    } catch (error) {
        console.error('Error fetching videos:', error);
        return [];
    }
}

function renderVideos(videos) {
    const videoGrid = document.querySelector('.video-grid');
    if (!videoGrid) return;

    videoGrid.innerHTML = ''; // Clear existing videos
    videos.forEach(video => {
        const videoCard = `
            <a href="watch.html?v=${video.id}" style="text-decoration: none; color: inherit;">
                <div class="video-card" data-video-id="${video.id}">
                    <img src="${video.thumbnail_url}" class="thumbnail">
                    <button class="watch-later-btn">WATCH LATER</button>
                    <div class="video-info">
                        <div class="channel-pic" style="background-image: url('${video.channel_avatar_url}')"></div>
                        <div class="text-info">
                            <h3 class="video-title">${video.title}</h3>
                            <p>${video.channel_name}</p>
                            <p>${video.view_count} views • ${new Date(video.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            </a>
        `;
        videoGrid.innerHTML += videoCard;
    });
}

// Run the render function when the page has loaded
document.addEventListener('DOMContentLoaded', async () => {
    renderWatchLater();
});

// --- Dark Mode Toggle ---
const darkModeToggle = document.getElementById('darkModeToggle');
if (darkModeToggle) {
    // Check for saved preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerText = '☀️';
    }

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        darkModeToggle.innerText = isDark ? '☀️' : '🌙';
    });
}

// --- User Modal Logic ---
const profilePic = document.querySelector('.profile-pic');
const userModal = document.getElementById('userModal');

if (profilePic && userModal) {
    profilePic.addEventListener('click', (e) => {
        e.stopPropagation();
        userModal.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!userModal.contains(e.target) && !profilePic.contains(e.target)) {
            userModal.classList.remove('active');
        }
    });
}

// --- Upload Video Logic ---
const selectFilesBtn = document.getElementById('selectFilesBtn');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const videoPreviewContainer = document.getElementById('videoPreviewContainer');
const videoPreview = document.getElementById('videoPreview');
const previewTitle = document.getElementById('previewTitle');
const previewSize = document.getElementById('previewSize');

if (selectFilesBtn && fileInput) {
    // Trigger file input when button is clicked
    selectFilesBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Drag and drop support
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#eef';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.backgroundColor = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }
}

function handleFileUpload(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please upload a valid video file.');
        return;
    }

    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    
    previewTitle.innerText = file.name;
    previewSize.innerText = `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    uploadArea.style.display = 'none';
    videoPreviewContainer.style.display = 'block';
    
    uploadVideo(file);
}

function uploadVideo(file) {
    const user = getCurrentUser();
    if (!user) {
        alert("You must be logged in to upload.");
        window.location.href = 'login.html';
        return;
    }

    const progressBar = document.getElementById('uploadProgressBar');
    const statusText = document.getElementById('uploadStatus');
    if (!progressBar || !statusText) return;

    const formData = new FormData();
    formData.append('video', file);
    // Use filename as title, removing extension
    formData.append('title', file.name.replace(/\.[^/.]+$/, ""));
    formData.append('channel_name', user.full_name || 'Unknown');
    formData.append('channel_avatar_url', user.avatar_url || 'https://picsum.photos/seed/avatar/50');
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/upload`, true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressBar.style.width = percentComplete + '%';
            statusText.innerText = `Uploading ${Math.floor(percentComplete)}%`;
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            statusText.innerText = 'Upload complete! Redirecting...';
            progressBar.style.backgroundColor = '#4CAF50';
            setTimeout(() => window.location.href = 'index.html', 1500);
        } else {
            statusText.innerText = 'Upload failed';
            progressBar.style.backgroundColor = '#f44336';
        }
    };

    xhr.onerror = function() {
        statusText.innerText = 'Network Error';
        progressBar.style.backgroundColor = '#f44336';
    };

    xhr.send(formData);
}

// --- Dynamic User Avatar Logic ---
async function loadUserAvatar() {
    const user = getCurrentUser();

    let userAvatarUrl = 'https://picsum.photos/seed/currentUser/200'; // Default

    if (user && user.avatar_url) {
        userAvatarUrl = user.avatar_url;
    } else if (localStorage.getItem('userAvatar')) {
        userAvatarUrl = localStorage.getItem('userAvatar');
    }

    // Selectors for all places the user avatar appears
    const avatarSelectors = [
        '.profile-pic',                                      // Navbar
        '.sidebar-watch a[href="profile.html"] .channel-pic', // Sidebar "Your Channel"
        '.profile-avatar-large',                             // Profile Page Header
        '.comment-input-block .user-avatar'                  // Watch Page Comment Input
    ];

    avatarSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.style.backgroundImage = `url('${userAvatarUrl}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundColor = 'transparent'; // Override default gray
        });
    });
}

document.addEventListener('DOMContentLoaded', loadUserAvatar);

// --- Authentication Logic ---
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

async function checkAuth() {
    const userIcons = document.querySelector('.user-icons');
    
    const isLoggedIn = !!getCurrentUser();
    
    // Redirect protected pages if not logged in
    const path = window.location.pathname;
    const protectedPages = ['upload.html', 'profile.html', 'library.html', 'liked.html'];
    // Simple check: if the current path contains a protected page name and user is not logged in
    if (protectedPages.some(page => path.includes(page)) && !isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    if (!userIcons) return;

    // Elements that should only be visible when logged in
    const authElements = userIcons.querySelectorAll('.notification-wrapper, .profile-pic, a[href="upload.html"]');
    let signInBtn = userIcons.querySelector('.sign-in-btn');

    if (isLoggedIn) {
        // Show auth elements
        authElements.forEach(el => el.style.display = ''); 
        
        if (signInBtn) signInBtn.remove();
        
        // Setup Sign Out listener
        setupSignOut();
    } else {
        // Hide auth elements
        authElements.forEach(el => el.style.display = 'none');
        
        // Add Sign In button if it doesn't exist
        if (!signInBtn) {
            signInBtn = document.createElement('a');
            signInBtn.href = 'login.html';
            signInBtn.className = 'sign-in-btn';
            signInBtn.style.textDecoration = 'none';
            signInBtn.innerHTML = `
                <div style="display: flex; align-items: center; border: 1px solid #3ea6ff; color: #3ea6ff; padding: 5px 15px; border-radius: 18px; cursor: pointer; margin-left: 10px;">
                    <span style="margin-right: 5px; font-size: 16px;">👤</span> Sign in
                </div>
            `;
            userIcons.appendChild(signInBtn);
        }
    }
}

function updateUserProfileUI(user) {
    // Update Profile Page Name
    const profileName = document.querySelector('.profile-info h1');
    const profileHandle = document.querySelector('.profile-info p');
    
    if (profileName && user.full_name) {
        profileName.innerText = user.full_name;
    }
    
    if (profileHandle && user.email) {
        const handle = '@' + user.email.split('@')[0];
        // Preserve the "subscribers • videos" part if it exists
        if (profileHandle.innerText.includes('•')) {
            const stats = profileHandle.innerText.substring(profileHandle.innerText.indexOf('•'));
            profileHandle.innerText = `${handle} ${stats}`;
        }
    }
}

function setupSignOut() {
    const modalItems = document.querySelectorAll('.user-modal-item');
    modalItems.forEach(item => {
        if (item.innerText.includes('Sign out')) {
            item.onclick = async () => {
                localStorage.removeItem('currentUser');
                window.location.href = 'index.html';
            };
        }
    });
}

// Handle Login/Signup Forms
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');
        const errorMsg = document.getElementById('auth-error');
        
        // UI Loading State
        const originalText = btn.innerText;
        btn.innerText = 'Signing in...';
        btn.disabled = true;
        if (errorMsg) errorMsg.style.display = 'none';
        
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('currentUser', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } catch (error) {
            if (errorMsg) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            }
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;
        const btn = signupForm.querySelector('button');
        const errorMsg = document.getElementById('auth-error');
        
        // UI Loading State
        const originalText = btn.innerText;
        btn.innerText = 'Creating Account...';
        btn.disabled = true;
        if (errorMsg) errorMsg.style.display = 'none';
        
        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, full_name: name })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Signup failed');

            localStorage.setItem('currentUser', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } catch (error) {
            if (errorMsg) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            }
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// Handle Forgot Password Form
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;
        // Mock functionality for now
        alert(`If an account exists for ${email}, a password reset link has been sent.`);
        window.location.href = 'login.html';
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    // If on profile page and logged in, update UI
    const user = getCurrentUser();
    if (user) updateUserProfileUI(user);
});

// --- Watch Page Logic ---
function getVideoIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
}

async function fetchVideoDetails(videoId) {
    try {
        const res = await fetch(`${API_URL}/videos/${videoId}`);
        if (!res.ok) throw new Error('Failed to fetch video details');
        return await res.json();
    } catch (error) {
        console.error('Error fetching video details:', error);
        return null;
    }
}

function renderVideoDetails(video) {
    if (!video) return;

    const videoPlayer = document.getElementById('videoPlayer');
    const videoTitle = document.getElementById('videoTitle');
    const channelAvatar = document.getElementById('channelAvatar');
    const channelName = document.getElementById('channelName');
    const viewCountAndDate = document.getElementById('viewCountAndDate');

    if (videoPlayer) videoPlayer.src = video.video_url;
    if (videoTitle) videoTitle.innerText = video.title;
    if (channelAvatar) {
        channelAvatar.style.backgroundImage = `url('${video.channel_avatar_url}')`;
        channelAvatar.style.backgroundSize = 'cover';
        channelAvatar.style.backgroundPosition = 'center';
    }
    if (channelName) channelName.innerText = video.channel_name;
    if (viewCountAndDate) viewCountAndDate.innerText = `${video.view_count} views • ${new Date(video.created_at).toLocaleDateString()}`;
}

async function fetchComments(videoId) {
    try {
        const res = await fetch(`${API_URL}/comments/${videoId}`);
        if (!res.ok) throw new Error('Failed to fetch comments');
        return await res.json();
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
}

function renderComments(comments) {
    const commentsList = document.getElementById('commentsList');
    const commentCount = document.getElementById('commentCount');
    if (!commentsList) return;

    commentsList.innerHTML = ''; // Clear existing comments
    if (commentCount) commentCount.innerText = `(${comments.length})`;

    comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.classList.add('comment-item');
        commentElement.innerHTML = `
            <div class="user-avatar" style="background-image: url('${comment.avatar_url || 'https://picsum.photos/seed/avatar/50'}');"></div>
            <div class="comment-content">
                <div class="comment-author">${comment.full_name} <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span></div>
                <div class="comment-text">${comment.comment_text}</div>
            </div>
        `;
        commentsList.appendChild(commentElement);
    });
}

async function postComment(videoId, userId, commentText) {
    try {
        const res = await fetch(`${API_URL}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, user_id: userId, comment_text: commentText })
        });
        if (!res.ok) throw new Error('Failed to post comment');
        return await res.json();
    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment.');
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    const user = getCurrentUser();
    if (user) updateUserProfileUI(user);

    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        const videos = await fetchVideos();
        renderVideos(videos);
    }

    if (window.location.pathname.includes('watch.html')) {
        const videoId = getVideoIdFromUrl();
        if (videoId) {
            const video = await fetchVideoDetails(videoId);
            renderVideoDetails(video);

            const comments = await fetchComments(videoId);
            renderComments(comments);

            const postCommentBtn = document.getElementById('postCommentBtn');
            const commentInput = document.getElementById('commentInput');
            if (postCommentBtn && commentInput) {
                postCommentBtn.addEventListener('click', async () => {
                    const currentUser = getCurrentUser();
                    if (!currentUser) {
                        alert('You must be logged in to comment.');
                        window.location.href = 'login.html';
                        return;
                    }
                    const commentText = commentInput.value.trim();
                    if (commentText) {
                        const newComment = await postComment(videoId, currentUser.id, commentText);
                        if (newComment) {
                            commentInput.value = ''; // Clear input
                            // Re-fetch and re-render comments to include the new one
                            const updatedComments = await fetchComments(videoId);
                            renderComments(updatedComments);
                        }
                    }
                });
            }
        }
    }
});