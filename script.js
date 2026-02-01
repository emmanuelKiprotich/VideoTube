// --- API Configuration ---
const API_URL = 'http://localhost:3000/api';

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
            // We need to map it to the structure expected by watch_later (which stores JSON)
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
    // --- Global Search Functionality (for videos and music) ---
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            let filter = this.value.toLowerCase();
            
            // Check if on VideoTube Music page
            if (window.location.pathname.includes('videotube_music.html')) {
                document.querySelectorAll('.music-card').forEach(card => {
                    const title = card.querySelector('.music-title').innerText.toLowerCase();
                    const artist = card.querySelector('.music-artist').innerText.toLowerCase();
                    card.style.display = (title.includes(filter) || artist.includes(filter)) ? "" : "none";
                });
            } else { // Assume video grid for other pages
                document.querySelectorAll('.video-card').forEach(card => {
                    const title = card.querySelector('.video-title').innerText.toLowerCase();
                    const channel = card.querySelector('.text-info p').innerText.toLowerCase(); // Assuming first p is channel
                    card.style.display = (title.includes(filter) || channel.includes(filter)) ? "" : "none";
                });
            }
        });
    }

    // --- Show More / Show Less logic for Sidebar ---
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

    // --- Sidebar Collapse Logic ---
    const menuIcon = document.querySelector('.menu-icon');
    const sidebar = document.querySelector('.sidebar-watch');
    if (menuIcon && sidebar) {
        menuIcon.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // --- Dark Mode Toggle ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        // Check for saved preference
        // Apply dark mode immediately if preference is set
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

    // --- Authentication Logic ---
    await checkAuth();
    // If on profile page and logged in, update UI
    const user = getCurrentUser();
    if (user) updateUserProfileUI(user);

    // Logic specific to index.html
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        const videos = await fetchVideos();
        renderVideos(videos);
    }

    // Logic specific to library.html
    if (window.location.pathname.includes('library.html')) {
        renderWatchLater();
    }

    // Logic specific to watch.html
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

    // --- Settings Page Logic ---
    if (window.location.pathname.includes('settings.html')) {
        // Language Setting
        const languageSetting = document.getElementById('languageSetting');
        const currentLanguageSpan = document.getElementById('currentLanguage');
        const languageModal = document.getElementById('languageModal');
        const languageList = document.getElementById('languageList');
        const closeLanguageModal = languageModal ? languageModal.querySelector('.close-button') : null;

        if (languageSetting && currentLanguageSpan && languageModal && languageList) {
            const savedLang = localStorage.getItem('displayLanguage') || 'English (US)';
            currentLanguageSpan.innerText = savedLang;

            languageSetting.addEventListener('click', () => {
                languageModal.style.display = 'block';
            });

            closeLanguageModal.addEventListener('click', () => {
                languageModal.style.display = 'none';
            });

            languageList.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const selectedLang = e.target.innerText;
                    currentLanguageSpan.innerText = selectedLang;
                    localStorage.setItem('displayLanguage', selectedLang);
                    languageModal.style.display = 'none';
                    // Here you would typically reload content with the new language
                    alert(`Language set to ${selectedLang}. (Functionality not fully implemented)`);
                }
            });
        }

        // Restricted Mode Toggle
        const restrictedModeToggle = document.getElementById('restrictedModeToggle');
        if (restrictedModeToggle) {
            const isRestricted = localStorage.getItem('restrictedMode') === 'true';
            restrictedModeToggle.checked = isRestricted;

            restrictedModeToggle.addEventListener('change', () => {
                localStorage.setItem('restrictedMode', restrictedModeToggle.checked);
                alert(`Restricted Mode is now ${restrictedModeToggle.checked ? 'ON' : 'OFF'}. (Functionality not fully implemented)`);
            });
        }

        // Location Setting
        const locationSetting = document.getElementById('locationSetting');
        const currentLocationSpan = document.getElementById('currentLocation');
        const locationModal = document.getElementById('locationModal');
        const locationList = document.getElementById('locationList');
        const closeLocationModal = locationModal ? locationModal.querySelector('.close-button') : null;

        if (locationSetting && currentLocationSpan && locationModal && locationList) {
            const savedLoc = localStorage.getItem('displayLocation') || 'United States';
            currentLocationSpan.innerText = savedLoc;

            locationSetting.addEventListener('click', () => locationModal.style.display = 'block');
            closeLocationModal.addEventListener('click', () => locationModal.style.display = 'none');
            locationList.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const selectedLoc = e.target.innerText;
                    currentLocationSpan.innerText = selectedLoc;
                    localStorage.setItem('displayLocation', selectedLoc);
                    locationModal.style.display = 'none';
                    alert(`Location set to ${selectedLoc}. (Functionality not fully implemented)`);
                }
            });
        }
    }

    // --- VideoTube Music Page Logic ---
    if (window.location.pathname.includes('videotube_music.html')) {
        const audioPlayer = document.getElementById('audioPlayer');
        const musicGrid = document.getElementById('musicGrid');
        const currentTrackTitle = document.getElementById('currentTrackTitle');
        const currentTrackArtist = document.getElementById('currentTrackArtist');
        const currentTrackThumbnail = document.getElementById('currentTrackThumbnail');

        // Play music when card is clicked
        if (audioPlayer && musicGrid) {
            musicGrid.addEventListener('click', (e) => {
                const musicCard = e.target.closest('.music-card');
                if (musicCard && !e.target.classList.contains('add-to-playlist-btn')) { // Ignore clicks on the add button
                    const src = musicCard.dataset.src;
                    const title = musicCard.dataset.title;
                    const artist = musicCard.dataset.artist;
                    const thumbnail = musicCard.dataset.thumbnail;

                    audioPlayer.src = src;
                    audioPlayer.play();

                    if (currentTrackTitle) currentTrackTitle.innerText = title;
                    if (currentTrackArtist) currentTrackArtist.innerText = artist;
                    if (currentTrackThumbnail) currentTrackThumbnail.src = thumbnail;

                    recordRecentlyPlayed(user.id, { id: musicCard.dataset.trackId, src, title, artist, thumbnail });
                    document.querySelectorAll('.music-card').forEach(card => card.classList.remove('playing'));
                    musicCard.classList.add('playing');
                }
            });
        }

        // Playlist Management
        const createNewPlaylistBtn = document.getElementById('createNewPlaylistBtn');
        const createPlaylistModal = document.getElementById('createPlaylistModal');
        const newPlaylistNameInput = document.getElementById('newPlaylistName');
        const saveNewPlaylistBtn = document.getElementById('saveNewPlaylistBtn');
        const playlistsGrid = document.getElementById('playlistsGrid');
        const noPlaylistsMessage = document.getElementById('noPlaylistsMessage');

        const addToPlaylistModal = document.getElementById('addToPlaylistModal');
        const trackToAddTitle = document.getElementById('trackToAddTitle');
        const playlistSelectionList = document.getElementById('playlistSelectionList');
        const noPlaylistsToAddMessage = document.getElementById('noPlaylistsToAddMessage');
        let selectedTrackForPlaylist = null; // Store the track data temporarily

        const playlistTracksModal = document.getElementById('playlistTracksModal');
        const playlistTracksModalTitle = document.getElementById('playlistTracksModalTitle');
        const playlistTracksList = document.getElementById('playlistTracksList');
        const noTracksInPlaylistMessage = document.getElementById('noTracksInPlaylistMessage');

        const recentlyPlayedGrid = document.getElementById('recentlyPlayedGrid');
        const noRecentlyPlayedMessage = document.getElementById('noRecentlyPlayedMessage');


        // Close modals when clicking outside or on close button
        document.querySelectorAll('.modal .close-button').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
        });
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Open Create Playlist Modal
        if (createNewPlaylistBtn) {
            createNewPlaylistBtn.addEventListener('click', () => {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to create a playlist.'); return; }
                newPlaylistNameInput.value = '';
                createPlaylistModal.style.display = 'block';
            });
        }

        // Save New Playlist
        if (saveNewPlaylistBtn) {
            saveNewPlaylistBtn.addEventListener('click', async () => {
                const user = getCurrentUser();
                if (!user) return;
                const playlistName = newPlaylistNameInput.value.trim();
                if (!playlistName) { alert('Playlist name cannot be empty.'); return; }

                try {
                    const res = await fetch(`${API_URL}/playlists`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: user.id, name: playlistName })
                    });
                    if (!res.ok) throw new Error('Failed to create playlist');
                    alert(`Playlist "${playlistName}" created!`);
                    createPlaylistModal.style.display = 'none';
                    renderPlaylists(); // Refresh playlists
                    renderRecentlyPlayed(); // Also refresh recently played in case it's relevant
                } catch (error) {
                    console.error('Error creating playlist:', error);
                    alert('Failed to create playlist.');
                }
            });
        }

        // Render Playlists
        async function renderPlaylists() {
            const user = getCurrentUser();
            if (!user) { playlistsGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Log in to see your playlists.</p>'; return; }

            try {
                const res = await fetch(`${API_URL}/playlists?user_id=${user.id}`);
                if (!res.ok) throw new Error('Failed to fetch playlists');
                const playlists = await res.json();

                playlistsGrid.innerHTML = '';
                if (playlists.length === 0) {
                    noPlaylistsMessage.style.display = 'block';
                } else {
                    noPlaylistsMessage.style.display = 'none';
                    playlists.forEach(playlist => {
                        const playlistCard = document.createElement('div');
                        playlistCard.classList.add('music-card');
                        playlistCard.dataset.playlistId = playlist.id;
                        playlistCard.innerHTML = `
                            <img src="https://picsum.photos/seed/playlist${playlist.id}/180/180" class="music-thumbnail">
                            <div class="music-info" data-playlist-id="${playlist.id}">
                                <h3 class="music-title">${playlist.name}</h3>
                                <p class="music-artist">Tracks: Loading...</p>
                            </div>
                            <button class="delete-playlist-btn">🗑️</button>
                        `;
                        playlistsGrid.appendChild(playlistCard);
                    });
                }
            } catch (error) {
                console.error('Error rendering playlists:', error);
                playlistsGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Error loading playlists.</p>';
            }
        }

        renderPlaylists(); // Initial render of playlists

        // Add to Playlist Button Click
        musicGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('add-to-playlist-btn')) {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to add tracks to a playlist.'); return; }

                const musicCard = e.target.closest('.music-card');
                selectedTrackForPlaylist = {
                    id: musicCard.dataset.trackId, // Use a unique ID for the track
                    src: musicCard.dataset.src,
                    title: musicCard.dataset.title,
                    artist: musicCard.dataset.artist,
                    thumbnail: musicCard.dataset.thumbnail
                };
                trackToAddTitle.innerText = `Add "${selectedTrackForPlaylist.title}" to:`;

                // Fetch and display user's playlists in the modal
                try {
                    const res = await fetch(`${API_URL}/playlists?user_id=${user.id}`);
                    if (!res.ok) throw new Error('Failed to fetch playlists for selection');
                    const playlists = await res.json();

                    playlistSelectionList.innerHTML = '';
                    if (playlists.length === 0) {
                        noPlaylistsToAddMessage.style.display = 'block';
                        playlistSelectionList.style.display = 'none';
                    } else {
                        noPlaylistsToAddMessage.style.display = 'none';
                        playlistSelectionList.style.display = 'block';
                        playlists.forEach(playlist => {
                            const li = document.createElement('li');
                            li.dataset.playlistId = playlist.id;
                            li.innerText = playlist.name;
                            playlistSelectionList.appendChild(li);
                        });
                    }
                    addToPlaylistModal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching playlists for selection:', error);
                    alert('Failed to load playlists.');
                }
            }
        });

        // Handle selection from "Add to Playlist" modal
        playlistSelectionList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'LI' && selectedTrackForPlaylist) {
                const playlistId = e.target.dataset.playlistId;
                try {
                    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ track_data: selectedTrackForPlaylist })
                    });
                    if (!res.ok) throw new Error('Failed to add track to playlist');
                    alert(`"${selectedTrackForPlaylist.title}" added to "${e.target.innerText}"!`);
                    addToPlaylistModal.style.display = 'none';
                    // No need to re-render playlists, as track count isn't displayed on card
                    selectedTrackForPlaylist = null;
                } catch (error) {
                    console.error('Error adding track to playlist:', error);
                    alert('Failed to add track to playlist.');
                }
            }
        });

        // Handle opening playlist tracks modal
        playlistsGrid.addEventListener('click', async (e) => { // Event delegation for playlist cards
            const playlistCard = e.target.closest('.music-card[data-playlist-id]');
            if (playlistCard && !e.target.closest('.delete-playlist-btn')) { // Ignore clicks on delete button
                const playlistId = parseInt(playlistCard.dataset.playlistId);
                const playlistName = playlistCard.querySelector('.music-title').innerText;
                playlistTracksModalTitle.innerText = playlistName;

                try {
                    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`);
                    if (!res.ok) throw new Error('Failed to fetch playlist tracks');
                    const tracks = await res.json();

                    playlistTracksList.innerHTML = '';
                    if (tracks.length === 0) {
                        noTracksInPlaylistMessage.style.display = 'block';
                        playlistTracksList.style.display = 'none';
                    } else {
                        noTracksInPlaylistMessage.style.display = 'none';
                        playlistTracksList.style.display = 'block';
                        tracks.forEach(track => {
                            const li = document.createElement('li');
                            li.dataset.trackDbId = track.id; // Store the DB ID of the track in playlist_tracks
                            li.dataset.trackPosition = track.position;
                            li.innerHTML = `
                                <img src="${track.thumbnail}" alt="${track.title}" style="width: 40px; height: 40px; border-radius: 4px; margin-right: 10px;">
                                <span>${track.title} - ${track.artist}</span>
                                <div class="track-controls">
                                    <button class="move-up-btn">▲</button>
                                    <button class="move-down-btn">▼</button>
                                    <button class="remove-track-from-playlist-btn">x</button>
                                </div>
                            `;
                            playlistTracksList.appendChild(li);
                        });

                        // Add event listeners for reorder buttons
                        playlistTracksList.querySelectorAll('.move-up-btn').forEach(btn => {
                            btn.addEventListener('click', (event) => moveTrack(event, playlistId, 'up'));
                        });
                        playlistTracksList.querySelectorAll('.move-down-btn').forEach(btn => {
                            btn.addEventListener('click', (event) => moveTrack(event, playlistId, 'down'));
                        });
                        playlistTracksList.querySelectorAll('.remove-track-from-playlist-btn').forEach(btn => {
                            btn.addEventListener('click', (event) => removeTrackFromPlaylist(event, playlistId));
                        });
                    }
                    playlistTracksModal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching playlist tracks:', error);
                    alert('Failed to load playlist tracks.');
                }
            }
        });

        // Function to move a track up or down
        async function moveTrack(event, playlistId, direction) {
            const trackLi = event.target.closest('li');
            const trackDbId = parseInt(trackLi.dataset.trackDbId);
            const currentPosition = parseInt(trackLi.dataset.trackPosition);
            const allTracks = Array.from(playlistTracksList.children);
            const currentIndex = allTracks.indexOf(trackLi);

            let newIndex = currentIndex;
            if (direction === 'up' && currentIndex > 0) {
                newIndex = currentIndex - 1;
            } else if (direction === 'down' && currentIndex < allTracks.length - 1) {
                newIndex = currentIndex + 1;
            } else {
                return; // Cannot move further
            }

            // Swap elements in the DOM
            const movedTrack = allTracks.splice(currentIndex, 1)[0];
            allTracks.splice(newIndex, 0, movedTrack);
            playlistTracksList.innerHTML = ''; // Clear and re-append
            allTracks.forEach((li, index) => {
                li.dataset.trackPosition = index + 1; // Update dataset position
                playlistTracksList.appendChild(li);
            });

            // Prepare data for backend reorder
            const reorderedTracks = allTracks.map((li, index) => ({
                track_db_id: parseInt(li.dataset.trackDbId),
                newPosition: index + 1
            }));

            try {
                const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reorderedTracks })
                });
                if (!res.ok) throw new Error('Failed to reorder tracks');
                // Re-render the playlist tracks to ensure consistency with backend
                // await renderPlaylistTracks(playlistId, playlistTracksModalTitle.innerText);
            } catch (error) {
                console.error('Error reordering tracks:', error);
                alert('Failed to reorder tracks.');
                // Optionally, revert UI changes if backend fails
            }
        }

        // Function to remove a track from a playlist
        async function removeTrackFromPlaylist(event, playlistId) {
            const trackLi = event.target.closest('li');
            const trackDbId = parseInt(trackLi.dataset.trackDbId);
            const trackTitle = trackLi.querySelector('span').innerText.split(' - ')[0];

            if (confirm(`Are you sure you want to remove "${trackTitle}" from this playlist?`)) {
                try {
                    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks/${trackDbId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) throw new Error('Failed to remove track from playlist');
                    alert(`"${trackTitle}" removed from playlist.`);
                    // Re-render the playlist tracks to reflect changes
                    const playlistName = playlistTracksModalTitle.innerText;
                    // await renderPlaylistTracks(playlistId, playlistName); // This function needs to be defined or integrated
                    trackLi.remove(); // Optimistic UI update
                    if (playlistTracksList.children.length === 0) {
                        noTracksInPlaylistMessage.style.display = 'block';
                        playlistTracksList.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error removing track from playlist:', error);
                    alert('Failed to remove track from playlist.');
                }
            }
        });

        // Handle deleting a playlist
        playlistsGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-playlist-btn')) {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to delete a playlist.'); return; }

                const playlistCard = e.target.closest('.music-card');
                const playlistId = playlistCard.dataset.playlistId;
                const playlistName = playlistCard.querySelector('.music-title').innerText;

                if (confirm(`Are you sure you want to delete the playlist "${playlistName}"?`)) {
                    try {
                        const res = await fetch(`${API_URL}/playlists/${playlistId}?user_id=${user.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (!res.ok) throw new Error('Failed to delete playlist');
                        alert(`Playlist "${playlistName}" deleted.`);
                        renderPlaylists(); // Refresh playlists
                    } catch (error) {
                        console.error('Error deleting playlist:', error);
                        alert('Failed to delete playlist.');
                    }
                }
            }
        });

        // --- Recently Played Logic ---
        async function recordRecentlyPlayed(userId, trackData) {
            try {
                await fetch(`${API_URL}/recently-played`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, track_data: trackData })
                });
                renderRecentlyPlayed(); // Refresh recently played list after recording
            } catch (error) {
                console.error('Error recording recently played track:', error);
            }
        }

        async function renderRecentlyPlayed() {
            const user = getCurrentUser();
            if (!user) {
                recentlyPlayedGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Log in to see your recently played tracks.</p>';
                return;
            }

            try {
                const res = await fetch(`${API_URL}/recently-played?user_id=${user.id}`);
                if (!res.ok) throw new Error('Failed to fetch recently played tracks');
                const tracks = await res.json();

                recentlyPlayedGrid.innerHTML = '';
                if (tracks.length === 0) {
                    noRecentlyPlayedMessage.style.display = 'block';
                } else {
                    noRecentlyPlayedMessage.style.display = 'none';
                    tracks.forEach(track => {
                        const musicCard = createMusicCard(track); // Re-use music card creation
                        recentlyPlayedGrid.appendChild(musicCard);
                    });
                }
            } catch (error) {
                console.error('Error rendering recently played tracks:', error);
                recentlyPlayedGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Error loading recently played tracks.</p>';
            }
        }

        renderRecentlyPlayed(); // Initial render of recently played

        // Helper to create a music card (can be used for featured, playlists, recently played)
        function createMusicCard(track) {
            const musicCard = document.createElement('div');
            musicCard.classList.add('music-card');
            musicCard.dataset.trackId = track.id;
            musicCard.dataset.src = track.src;
            musicCard.dataset.title = track.title;
            musicCard.dataset.artist = track.artist;
            musicCard.dataset.thumbnail = track.thumbnail;
            musicCard.innerHTML = `
                <img src="${track.thumbnail}" class="music-thumbnail">
                <div class="music-info">
                    <h3 class="music-title">${track.title}</h3>
                    <p class="music-artist">${track.artist}</p>
                </div>
                <span class="play-icon">▶</span>
                <button class="add-to-playlist-btn">+</button>
            `;
            return musicCard;
        }
    }
});

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
    const signOutSettingsItem = document.getElementById('signOutSettings'); // Get the sign out item from settings.html
    modalItems.forEach(item => {
        if (item.innerText.includes('Sign out')) {
            item.onclick = async () => {
                localStorage.removeItem('currentUser');
                window.location.href = 'index.html';
            };
        }
    });

    // Add event listener for the sign out button on the settings page
    if (signOutSettingsItem) {
        signOutSettingsItem.onclick = async () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        };
    }
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
            console.error('Login error:', error); // Log error to console
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
            console.error('Signup error:', error); // Log error to console
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

document.addEventListener('DOMContentLoaded', async () => { // Main DOMContentLoaded listener
    await checkAuth();
    const user = getCurrentUser();
    if (user) updateUserProfileUI(user);

    // Logic specific to index.html
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        const videos = await fetchVideos();
        renderVideos(videos);
    }

    // Logic specific to library.html
    // This block should be placed inside DOMContentLoaded, not outside.
    if (window.location.pathname.includes('library.html')) {
        renderWatchLater();
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

// --- Settings Page Logic ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('settings.html')) {
        // Language Setting
        const languageSetting = document.getElementById('languageSetting');
        const currentLanguageSpan = document.getElementById('currentLanguage');
        const languageModal = document.getElementById('languageModal');
        const languageList = document.getElementById('languageList');
        const closeLanguageModal = languageModal ? languageModal.querySelector('.close-button') : null;

        if (languageSetting && currentLanguageSpan && languageModal && languageList) {
            const savedLang = localStorage.getItem('displayLanguage') || 'English (US)';
            currentLanguageSpan.innerText = savedLang;

            languageSetting.addEventListener('click', () => {
                languageModal.style.display = 'block';
            });

            closeLanguageModal.addEventListener('click', () => {
                languageModal.style.display = 'none';
            });

            languageList.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const selectedLang = e.target.innerText;
                    currentLanguageSpan.innerText = selectedLang;
                    localStorage.setItem('displayLanguage', selectedLang);
                    languageModal.style.display = 'none';
                    // Here you would typically reload content with the new language
                    alert(`Language set to ${selectedLang}. (Functionality not fully implemented)`);
                }
            });
        }

        // Restricted Mode Toggle
        const restrictedModeToggle = document.getElementById('restrictedModeToggle');
        if (restrictedModeToggle) {
            const isRestricted = localStorage.getItem('restrictedMode') === 'true';
            restrictedModeToggle.checked = isRestricted;

            restrictedModeToggle.addEventListener('change', () => {
                localStorage.setItem('restrictedMode', restrictedModeToggle.checked);
                alert(`Restricted Mode is now ${restrictedModeToggle.checked ? 'ON' : 'OFF'}. (Functionality not fully implemented)`);
            });
        }

        // Location Setting
        const locationSetting = document.getElementById('locationSetting');
        const currentLocationSpan = document.getElementById('currentLocation');
        const locationModal = document.getElementById('locationModal');
        const locationList = document.getElementById('locationList');
        const closeLocationModal = locationModal ? locationModal.querySelector('.close-button') : null;

        if (locationSetting && currentLocationSpan && locationModal && locationList) {
            const savedLoc = localStorage.getItem('displayLocation') || 'United States';
            currentLocationSpan.innerText = savedLoc;

            locationSetting.addEventListener('click', () => locationModal.style.display = 'block');
            closeLocationModal.addEventListener('click', () => locationModal.style.display = 'none');
            locationList.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const selectedLoc = e.target.innerText;
                    currentLocationSpan.innerText = selectedLoc;
                    localStorage.setItem('displayLocation', selectedLoc);
                    locationModal.style.display = 'none';
                    alert(`Location set to ${selectedLoc}. (Functionality not fully implemented)`);
                }
            });
        }
    }

    // --- VideoTube Music Page Logic ---
    if (window.location.pathname.includes('videotube_music.html')) {
        const audioPlayer = document.getElementById('audioPlayer');
        const musicGrid = document.getElementById('musicGrid');
        const currentTrackTitle = document.getElementById('currentTrackTitle');
        const currentTrackArtist = document.getElementById('currentTrackArtist');
        const currentTrackThumbnail = document.getElementById('currentTrackThumbnail');

        // Play music when card is clicked
        if (audioPlayer && musicGrid) {
            musicGrid.addEventListener('click', (e) => {
                const musicCard = e.target.closest('.music-card');
                if (musicCard && !e.target.classList.contains('add-to-playlist-btn')) { // Ignore clicks on the add button
                    const src = musicCard.dataset.src;
                    const title = musicCard.dataset.title;
                    const artist = musicCard.dataset.artist;
                    const thumbnail = musicCard.dataset.thumbnail;

                    audioPlayer.src = src;
                    audioPlayer.play();

                    if (currentTrackTitle) currentTrackTitle.innerText = title;
                    if (currentTrackArtist) currentTrackArtist.innerText = artist;
                    if (currentTrackThumbnail) currentTrackThumbnail.src = thumbnail;

                    document.querySelectorAll('.music-card').forEach(card => card.classList.remove('playing'));
                    musicCard.classList.add('playing');
                }
            });
        }

        // Playlist Management
        const createNewPlaylistBtn = document.getElementById('createNewPlaylistBtn');
        const createPlaylistModal = document.getElementById('createPlaylistModal');
        const newPlaylistNameInput = document.getElementById('newPlaylistName');
        const saveNewPlaylistBtn = document.getElementById('saveNewPlaylistBtn');
        const playlistsGrid = document.getElementById('playlistsGrid');
        const noPlaylistsMessage = document.getElementById('noPlaylistsMessage');

        const addToPlaylistModal = document.getElementById('addToPlaylistModal');
        const trackToAddTitle = document.getElementById('trackToAddTitle');
        const playlistSelectionList = document.getElementById('playlistSelectionList');
        const noPlaylistsToAddMessage = document.getElementById('noPlaylistsToAddMessage');
        let selectedTrackForPlaylist = null; // Store the track data temporarily

        const playlistTracksModal = document.getElementById('playlistTracksModal');
        const playlistTracksModalTitle = document.getElementById('playlistTracksModalTitle');
        const playlistTracksList = document.getElementById('playlistTracksList');
        const noTracksInPlaylistMessage = document.getElementById('noTracksInPlaylistMessage');

        // Close modals when clicking outside or on close button
        document.querySelectorAll('.modal .close-button').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
        });
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Open Create Playlist Modal
        if (createNewPlaylistBtn) {
            createNewPlaylistBtn.addEventListener('click', () => {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to create a playlist.'); return; }
                newPlaylistNameInput.value = '';
                createPlaylistModal.style.display = 'block';
            });
        }

        // Save New Playlist
        if (saveNewPlaylistBtn) {
            saveNewPlaylistBtn.addEventListener('click', async () => {
                const user = getCurrentUser();
                if (!user) return;
                const playlistName = newPlaylistNameInput.value.trim();
                if (!playlistName) { alert('Playlist name cannot be empty.'); return; }

                try {
                    const res = await fetch(`${API_URL}/playlists`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: user.id, name: playlistName })
                    });
                    if (!res.ok) throw new Error('Failed to create playlist');
                    alert(`Playlist "${playlistName}" created!`);
                    createPlaylistModal.style.display = 'none';
                    renderPlaylists(); // Refresh playlists
                } catch (error) {
                    console.error('Error creating playlist:', error);
                    alert('Failed to create playlist.');
                }
            });
        }

        // Render Playlists
        async function renderPlaylists() {
            const user = getCurrentUser();
            if (!user) { playlistsGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Log in to see your playlists.</p>'; return; }

            try {
                const res = await fetch(`${API_URL}/playlists?user_id=${user.id}`);
                if (!res.ok) throw new Error('Failed to fetch playlists');
                const playlists = await res.json();

                playlistsGrid.innerHTML = '';
                if (playlists.length === 0) {
                    noPlaylistsMessage.style.display = 'block';
                } else {
                    noPlaylistsMessage.style.display = 'none';
                    playlists.forEach(playlist => {
                        const playlistCard = document.createElement('div');
                        playlistCard.classList.add('music-card');
                        playlistCard.dataset.playlistId = playlist.id;
                        playlistCard.innerHTML = `
                            <img src="https://picsum.photos/seed/playlist${playlist.id}/180/180" class="music-thumbnail">
                            <div class="music-info">
                                <h3 class="music-title">${playlist.name}</h3>
                                <p class="music-artist">Tracks: Loading...</p>
                            </div>
                            <button class="delete-playlist-btn">🗑️</button>
                        `;
                        playlistsGrid.appendChild(playlistCard);
                    });
                }
            } catch (error) {
                console.error('Error rendering playlists:', error);
                playlistsGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #b3b3b3;">Error loading playlists.</p>';
            }
        }

        renderPlaylists(); // Initial render

        // Add to Playlist Button Click
        musicGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('add-to-playlist-btn')) {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to add tracks to a playlist.'); return; }

                const musicCard = e.target.closest('.music-card');
                selectedTrackForPlaylist = {
                    id: musicCard.dataset.trackId, // Use a unique ID for the track
                    src: musicCard.dataset.src,
                    title: musicCard.dataset.title,
                    artist: musicCard.dataset.artist,
                    thumbnail: musicCard.dataset.thumbnail
                };
                trackToAddTitle.innerText = `Add "${selectedTrackForPlaylist.title}" to:`;

                // Fetch and display user's playlists in the modal
                try {
                    const res = await fetch(`${API_URL}/playlists?user_id=${user.id}`);
                    if (!res.ok) throw new Error('Failed to fetch playlists for selection');
                    const playlists = await res.json();

                    playlistSelectionList.innerHTML = '';
                    if (playlists.length === 0) {
                        noPlaylistsToAddMessage.style.display = 'block';
                        playlistSelectionList.style.display = 'none';
                    } else {
                        noPlaylistsToAddMessage.style.display = 'none';
                        playlistSelectionList.style.display = 'block';
                        playlists.forEach(playlist => {
                            const li = document.createElement('li');
                            li.dataset.playlistId = playlist.id;
                            li.innerText = playlist.name;
                            playlistSelectionList.appendChild(li);
                        });
                    }
                    addToPlaylistModal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching playlists for selection:', error);
                    alert('Failed to load playlists.');
                }
            }
        });

        // Handle selection from "Add to Playlist" modal
        playlistSelectionList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'LI' && selectedTrackForPlaylist) {
                const playlistId = e.target.dataset.playlistId;
                try {
                    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ track_data: selectedTrackForPlaylist })
                    });
                    if (!res.ok) throw new Error('Failed to add track to playlist');
                    alert(`"${selectedTrackForPlaylist.title}" added to "${e.target.innerText}"!`);
                    addToPlaylistModal.style.display = 'none';
                    selectedTrackForPlaylist = null;
                } catch (error) {
                    console.error('Error adding track to playlist:', error);
                    alert('Failed to add track to playlist.');
                }
            }
        });

        // Handle opening playlist tracks modal
        playlistsGrid.addEventListener('click', async (e) => {
            const playlistCard = e.target.closest('.music-card');
            if (playlistCard && !e.target.classList.contains('delete-playlist-btn')) {
                const playlistId = playlistCard.dataset.playlistId;
                const playlistName = playlistCard.querySelector('.music-title').innerText;
                playlistTracksModalTitle.innerText = playlistName;

                try {
                    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`);
                    if (!res.ok) throw new Error('Failed to fetch playlist tracks');
                    const tracks = await res.json();

                    playlistTracksList.innerHTML = '';
                    if (tracks.length === 0) {
                        noTracksInPlaylistMessage.style.display = 'block';
                        playlistTracksList.style.display = 'none';
                    } else {
                        noTracksInPlaylistMessage.style.display = 'none';
                        playlistTracksList.style.display = 'block';
                        tracks.forEach(track => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <img src="${track.thumbnail}" alt="${track.title}" style="width: 40px; height: 40px; border-radius: 4px; margin-right: 10px;">
                                <span>${track.title} - ${track.artist}</span>
                            `;
                            playlistTracksList.appendChild(li);
                        });
                    }
                    playlistTracksModal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching playlist tracks:', error);
                    alert('Failed to load playlist tracks.');
                }
            }
        });

        // Handle deleting a playlist
        playlistsGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-playlist-btn')) {
                const user = getCurrentUser();
                if (!user) { alert('Please log in to delete a playlist.'); return; }

                const playlistCard = e.target.closest('.music-card');
                const playlistId = playlistCard.dataset.playlistId;
                const playlistName = playlistCard.querySelector('.music-title').innerText;

                if (confirm(`Are you sure you want to delete the playlist "${playlistName}"?`)) {
                    try {
                        const res = await fetch(`${API_URL}/playlists/${playlistId}?user_id=${user.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (!res.ok) throw new Error('Failed to delete playlist');
                        alert(`Playlist "${playlistName}" deleted.`);
                        renderPlaylists(); // Refresh playlists
                    } catch (error) {
                        console.error('Error deleting playlist:', error);
                        alert('Failed to delete playlist.');
                    }
                }
            }
        });
    }
});
    // --- VideoTube Music Page Logic ---
    if (window.location.pathname.includes('videotube_music.html')) {
        const audioPlayer = document.getElementById('audioPlayer');
        const musicGrid = document.getElementById('musicGrid');
        const currentTrackTitle = document.getElementById('currentTrackTitle');
        const currentTrackArtist = document.getElementById('currentTrackArtist');

        if (audioPlayer && musicGrid) {
            musicGrid.addEventListener('click', (e) => {
                const musicCard = e.target.closest('.music-card');
                if (musicCard) {
                    const src = musicCard.dataset.src;
                    const title = musicCard.dataset.title;
                    const artist = musicCard.dataset.artist;

                    audioPlayer.src = src;
                    audioPlayer.play();

                    if (currentTrackTitle) currentTrackTitle.innerText = title;
                    if (currentTrackArtist) currentTrackArtist.innerText = artist;

                    // Optional: Highlight the currently playing song
                    // Remove 'playing' class from all cards, then add to the clicked one
                    document.querySelectorAll('.music-card').forEach(card => card.classList.remove('playing'));
                    musicCard.classList.add('playing');
                }
            });
        }
    }
});
