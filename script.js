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

document.addEventListener('click', function(e) {
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

        addToWatchLater(videoData);
        alert(`'${videoData.title}' added to Watch Later!`);
    }
    
    // Check if a remove button was clicked
    if (e.target.classList.contains('remove-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const card = e.target.closest('.video-card');
        const videoId = card.getAttribute('data-video-id');
        removeFromWatchLater(videoId);
    }
});

function addToWatchLater(video) {
    let watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];

    // Prevent adding duplicates
    if (!watchLaterList.some(v => v.id === video.id)) {
        watchLaterList.push(video);
        localStorage.setItem('watchLater', JSON.stringify(watchLaterList));
    }
}

function removeFromWatchLater(id) {
    let watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];
    watchLaterList = watchLaterList.filter(v => v.id !== id);
    localStorage.setItem('watchLater', JSON.stringify(watchLaterList));
    renderWatchLater(); // Re-render the list to show changes immediately
}

function renderWatchLater() {
    const container = document.getElementById('watch-later-list');
    // Only run this function if we are on a page with the watch later container (library.html)
    if (!container) return;

    const watchLaterList = JSON.parse(localStorage.getItem('watchLater')) || [];
    const placeholder = document.getElementById('watch-later-placeholder');

    if (watchLaterList.length > 0) {
        placeholder.style.display = 'none';
        container.innerHTML = ''; // Clear the placeholder text
        watchLaterList.forEach(video => {
            const videoCardHTML = `
                <a href="watch.html" style="text-decoration: none; color: inherit;">
                    <div class="video-card" data-video-id="${video.id}">
                        <img src="${video.thumbnail}" class="thumbnail">
                        <button class="remove-btn">REMOVE</button>
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

// Run the render function when the page has loaded
document.addEventListener('DOMContentLoaded', renderWatchLater);

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