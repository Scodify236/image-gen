let currentUserId = null;
let currentUsername = null;
let isUserLoggedIn = false;

// DOM Elements
let authSection;
let dashboardSection;
let loginForm;
let registerForm;
let giftCardForm;
let chatForm;
let chatMessages;
let messageInput;
let usernameDisplay;
let logoutBtn;
let userSubmissions;
let videoModal;
let modalVideo;

// Stats elements
let totalSubmissions;
let approvedSubmissions;
let paidSubmissions;
let pendingSubmissions;

let lastMessageTimestamp = null;
let isPolling = false;

// Create loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = `
    <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading...</div>
    </div>
`;
document.body.appendChild(loadingOverlay);

// Show loading overlay
function showLoading(text = 'Loading...') {
    loadingOverlay.querySelector('.loading-text').textContent = text;
    loadingOverlay.classList.add('show');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Initialize DOM elements
function initializeElements() {
    authSection = document.getElementById('auth-section');
    dashboardSection = document.getElementById('dashboard-section');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    giftCardForm = document.getElementById('gift-card-form');
    chatForm = document.getElementById('chat-form');
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    usernameDisplay = document.getElementById('username-display');
    logoutBtn = document.getElementById('logout-btn');
    userSubmissions = document.getElementById('user-submissions');
    videoModal = document.getElementById('video-modal');
    modalVideo = document.getElementById('modal-video');

    // Stats elements
    totalSubmissions = document.getElementById('total-submissions');
    approvedSubmissions = document.getElementById('approved-submissions');
    paidSubmissions = document.getElementById('paid-submissions');
    pendingSubmissions = document.getElementById('pending-submissions');
}

// Initialize event listeners
function initializeEventListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (giftCardForm) {
        giftCardForm.addEventListener('submit', handleGiftCardSubmit);
    }
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            closeVideoModal();
        }
        if (e.target === document.getElementById('chat-modal')) {
            closeChatModal();
        }
    });

    // Add escape key handler for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (videoModal && videoModal.style.display === 'block') {
                closeVideoModal();
            }
            const chatModal = document.getElementById('chat-modal');
            if (chatModal && chatModal.style.display === 'block') {
                closeChatModal();
            }
        }
    });
}

// Chat Modal Functions
function openChat() {
    const chatModal = document.getElementById('chat-modal');
    chatModal.style.display = 'block';
    // Trigger reflow
    chatModal.offsetHeight;
    chatModal.classList.add('show');
    loadChatMessages();
}

function closeChatModal() {
    const chatModal = document.getElementById('chat-modal');
    chatModal.classList.remove('show');
    setTimeout(() => {
        chatModal.style.display = 'none';
    }, 300);
}

// Video Modal Functions
function showVideo(url) {
    modalVideo.src = url;
    videoModal.style.display = 'block';
    // Trigger reflow
    videoModal.offsetHeight;
    videoModal.classList.add('show');
    modalVideo.play();
}

function closeVideoModal() {
    modalVideo.pause();
    modalVideo.src = '';
    videoModal.classList.remove('show');
    setTimeout(() => {
        videoModal.style.display = 'none';
    }, 300);
}

// Check localStorage for existing user data
function checkLocalStorage() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        const { userId, username } = JSON.parse(userData);
        currentUserId = userId;
        currentUsername = username;
        isUserLoggedIn = true;
        showDashboard();
        loadUserSubmissions();
        loadChatMessages();
        startMessagePolling();
    } else {
        showAuth();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            currentUserId = data.userId;
            currentUsername = username;
            isUserLoggedIn = true;
            
            // Save user data to localStorage
            localStorage.setItem('userData', JSON.stringify({
                userId: currentUserId,
                username: currentUsername
            }));
            
            showDashboard();
            loadUserSubmissions();
            loadChatMessages();
            startMessagePolling();
        } else {
            alert('Login failed: ' + data.error);
        }
    } catch (err) {
        alert('Error during login: ' + err.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            currentUserId = data.userId;
            currentUsername = username;
            isUserLoggedIn = true;
            
            // Save user data to localStorage
            localStorage.setItem('userData', JSON.stringify({
                userId: currentUserId,
                username: currentUsername
            }));
            
            showDashboard();
            loadUserSubmissions();
            loadChatMessages();
            startMessagePolling();
        } else {
            alert('Registration failed: ' + data.error);
        }
    } catch (err) {
        alert('Error during registration: ' + err.message);
    }
}

async function handleLogout() {
    currentUserId = null;
    currentUsername = null;
    isUserLoggedIn = false;
    
    // Clear user data from localStorage
    localStorage.removeItem('userData');
    
    showAuth();
}

async function loadUserSubmissions() {
    if (!isUserLoggedIn || !currentUserId) {
        showAuth();
        return;
    }

    try {
        const response = await fetch(`/api/user-submissions/${currentUserId}`);
        const submissions = await response.json();
        
        userSubmissions.innerHTML = '';
        let stats = {
            total: submissions.length,
            approved: 0,
            paid: 0,
            pending: 0
        };

        submissions.forEach(submission => {
            const card = createSubmissionCard(submission);
            userSubmissions.appendChild(card);

            // Update stats
            stats[submission.status]++;
        });

        // Update stats display
        totalSubmissions.textContent = stats.total;
        approvedSubmissions.textContent = stats.approved;
        paidSubmissions.textContent = stats.paid;
        pendingSubmissions.textContent = stats.pending;
    } catch (err) {
        console.error('Error loading submissions:', err);
        if (!isUserLoggedIn) {
            showAuth();
        }
    }
}

function createSubmissionCard(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'submission-card';
    
    const statusClass = `status-${card.status}`;
    const statusText = card.status.charAt(0).toUpperCase() + card.status.slice(1);
    
    cardElement.innerHTML = `
        <div class="submission-header">
            <span class="submission-id">#${card.id}</span>
            <span class="submission-status ${statusClass}">${statusText}</span>
        </div>
        <div class="submission-details">
            <div class="detail-row">
                <span class="detail-label">Ticket User</span>
                <span class="detail-value">${card.ticket_user_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Ticket Number</span>
                <span class="detail-value">${card.ticket_number}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">GC Name</span>
                <span class="detail-value">${card.gc_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">GC Code</span>
                <span class="detail-value">${card.gc_code}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">UPI ID</span>
                <span class="detail-value">${card.upi_id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value">₹${card.amount}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Created</span>
                <span class="detail-value">${new Date(card.created_at).toLocaleString()}</span>
            </div>
        </div>
        <div class="submission-actions">
            <button class="action-btn view-btn" onclick="showVideo('${card.proof_video_url}')">
                <i class="fas fa-video"></i> View Video
            </button>
            <button class="action-btn view-btn" onclick="openChat()">
                <i class="fas fa-comments"></i> Chat with Admin
            </button>
        </div>
    `;
    
    return cardElement;
}

async function handleGiftCardSubmit(e) {
    e.preventDefault();
    if (!isUserLoggedIn || !currentUserId) {
        showAuth();
        return;
    }

    const fileInput = document.getElementById('proof-video');
    
    try {
        showLoading('Uploading video...');
        // Upload video to File2Link
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        const uploadResponse = await fetch('https://file2link-21oh.onrender.com/upload', {
            method: 'POST',
            body: formData
        });

        const uploadData = await uploadResponse.json();
        const videoUrl = uploadData.access_url;

        // Submit gift card data
        const giftCardData = {
            userId: currentUserId,
            ticketUserName: document.getElementById('ticket-user-name').value,
            ticketNumber: document.getElementById('ticket-number').value,
            gcName: document.getElementById('gc-name').value,
            gcCode: document.getElementById('gc-code').value,
            upiId: document.getElementById('upi-id').value,
            amount: document.getElementById('amount').value,
            proofVideoUrl: videoUrl
        };

        const response = await fetch('/api/gift-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(giftCardData)
        });

        const data = await response.json();
        if (data.success) {
            alert('Gift card submitted successfully!');
            giftCardForm.reset();
            loadUserSubmissions();
        } else {
            alert('Failed to submit gift card: ' + data.error);
        }
    } catch (err) {
        alert('Error submitting gift card: ' + err.message);
    } finally {
        hideLoading();
    }
}

async function loadChatMessages() {
    if (!isUserLoggedIn || !currentUserId) return;
    
    try {
        const response = await fetch(`/api/messages/${currentUserId}`);
        const messages = await response.json();
        
        if (messages.length > 0) {
            const latestMessage = messages[messages.length - 1];
            if (!lastMessageTimestamp || new Date(latestMessage.created_at) > lastMessageTimestamp) {
                chatMessages.innerHTML = '';
                messages.forEach(appendMessage);
                lastMessageTimestamp = new Date(latestMessage.created_at);
            }
        }
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    if (!isUserLoggedIn || !currentUserId || !messageInput.value.trim()) return;

    const content = messageInput.value.trim();
    messageInput.value = '';

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                content,
                sender: 'seller'
            })
        });

        const data = await response.json();
        if (data.error === 'Duplicate message') {
            return;
        }
        if (data) {
            appendMessage(data);
            lastMessageTimestamp = new Date(data.created_at);
        }
    } catch (err) {
        console.error('Error sending message:', err);
        alert('Error sending message: ' + err.message);
    }
}

function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender}`;
    messageDiv.textContent = message.content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showDashboard() {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    usernameDisplay.textContent = currentUsername;
}

function showAuth() {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
}

// Start polling for new messages
function startMessagePolling() {
    if (isPolling || !isUserLoggedIn) return;
    isPolling = true;
    
    setInterval(() => {
        if (isUserLoggedIn && currentUserId) {
            loadChatMessages();
        }
    }, 2000); // Poll every 2 seconds
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    checkLocalStorage(); // Check localStorage instead of showing auth screen directly
}); 