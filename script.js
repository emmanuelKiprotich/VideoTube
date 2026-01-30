// --- Supabase Configuration ---
const SUPABASE_URL = 'https://ddsyyrqctkehzujntqxv.supabase.co'; // Replace with your Supabase URL
const SUPABASE_KEY = 'YeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc3l5cnFjdGtlaHp1am50cXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDI4OTUsImV4cCI6MjA4NTM3ODg5NX0.SEjZGh4MqicoMX--Pbo0r9vgV0DbArNjXDgGHZrjHdoeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc3l5cnFjdGtlaHp1am50cXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDI4OTUsImV4cCI6MjA4NTM3ODg5NX0.SEjZGh4MqicoMX--Pbo0r9vgV0DbArNjXDgGHZrjHdo'; // Replace with your Supabase Anon Key
let supabaseClient = null;

// Helper to load and get Supabase client
function getSupabase() {
    return new Promise((resolve, reject) => {
        if (supabaseClient) return resolve(supabaseClient);
        
        if (typeof supabase !== 'undefined') {
            const { createClient } = supabase;
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
            return resolve(supabaseClient);
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            const { createClient } = supabase;
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
            resolve(supabaseClient);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

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
        const videoData = {
            // Use the thumbnail source as a unique ID for this example
            id: card.querySelector('.thumbnail').src,
            thumbnail: card.querySelector('.thumbnail').src,
            title: card.querySelector('.video-title').innerText,
            // The first <p> inside text-info is assumed to be the channel
            channel: card.querySelector('.text-info p').innerText
        };

        await addToWatchLater(videoData);
        alert(`'${videoData.title}' added to Watch Later!`);
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
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        // Save to Supabase DB
        const { error } = await sb.from('watch_later').insert({
            user_id: session.user.id,
            video_data: video
        });
        if (error) console.error('Error adding to watch later:', error);
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
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        // Remove from Supabase DB using JSON containment to match the video ID
        const { error } = await sb
            .from('watch_later')
            .delete()
            .eq('user_id', session.user.id)
            .contains('video_data', { id: id });

        if (!error) renderWatchLater();
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

    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    
    let watchLaterList = [];

    if (session) {
        // Fetch from DB
        const { data, error } = await sb.from('watch_later').select('video_data');
        if (data) {
            watchLaterList = data.map(row => row.video_data);
        }
    } else {
        // Fetch from LocalStorage
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
    }
}

// --- Video Grid Population ---
async function fetchVideos() {
    const sb = await getSupabase();
    const { data, error } = await sb.from('videos').select('*');
    if (error) {
        console.error('Error fetching videos:', error);
        return [];
    }
    return data;
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
    const videos = await fetchVideos();
    renderVideos(videos);
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
    
    simulateUpload();
}

function simulateUpload() {
    const progressBar = document.getElementById('uploadProgressBar');
    const statusText = document.getElementById('uploadStatus');
    if (!progressBar || !statusText) return;

    let width = 0;
    progressBar.style.width = '0%';
    statusText.innerText = 'Uploading 0%';
    
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            statusText.innerText = 'Processing complete';
            progressBar.style.backgroundColor = '#4CAF50';
        } else {
            width += Math.random() * 5; 
            if (width > 100) width = 100;
            progressBar.style.width = width + '%';
            statusText.innerText = `Uploading ${Math.floor(width)}%`;
        }
    }, 200);
}

// --- Dynamic User Avatar Logic ---
async function loadUserAvatar() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    let userAvatarUrl = 'https://picsum.photos/seed/currentUser/200'; // Default

    if (session?.user?.user_metadata?.avatar_url) {
        userAvatarUrl = session.user.user_metadata.avatar_url;
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
async function checkAuth() {
    const userIcons = document.querySelector('.user-icons');
    
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const isLoggedIn = !!session;
    
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
        setupSignOut(sb);
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
    
    if (profileName && user.user_metadata?.full_name) {
        profileName.innerText = user.user_metadata.full_name;
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

function setupSignOut(sb) {
    const modalItems = document.querySelectorAll('.user-modal-item');
    modalItems.forEach(item => {
        if (item.innerText.includes('Sign out')) {
            item.onclick = async () => {
                await sb.auth.signOut();
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
        
        const sb = await getSupabase();
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        
        if (error) {
            if (errorMsg) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } else {
                alert('Login failed: ' + error.message);
            }
            btn.innerText = originalText;
            btn.disabled = false;
        } else {
            // Login successful, redirect to home
            window.location.href = 'index.html';
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
        
        const sb = await getSupabase();
        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: name } }
        });

        if (error) {
            if (errorMsg) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } else {
                alert('Signup failed: ' + error.message);
            }
            btn.innerText = originalText;
            btn.disabled = false;
        } else {
            // Check if session was created immediately (Auto Confirm enabled in Supabase)
            if (data.session) {
                window.location.href = 'index.html';
            } else {
                alert('Signup successful! Please check your email to confirm.');
                window.location.href = 'login.html';
            }
        }
    });
}

// Handle Forgot Password Form
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;
        
        const sb = await getSupabase();
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset_password.html',
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert(`Password reset link sent to ${email}`);
            window.location.href = 'login.html';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    // If on profile page and logged in, update UI
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session) updateUserProfileUI(session.user);
});