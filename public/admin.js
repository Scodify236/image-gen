let currentAdminId = null;
let currentChatUserId = null;
let isAdminLoggedIn = false;

// DOM Elements
let authSection;
let dashboardSection;
let loginForm;
let pendingSubmissionsGrid;
let paidSubmissionsGrid;
let rejectedSubmissionsGrid;
let statusFilter;
let chatModal;
let chatSellerName;
let chatForm;
let chatMessages;
let messageInput;
let logoutBtn;
let videoModal;
let modalVideo;
let refreshBtn;
let resetBtn;
let resetConfirmationModal;
let finalConfirmationModal;

// Stats elements
let totalSubmissions;
let pendingSubmissions;
let approvedSubmissions;
let paidSubmissions;
let rejectedSubmissions;

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

// Utility functions for modals
function showModal(modal) {
    if (!modal) return;
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300); // Match the transition duration in CSS
}

// Initialize DOM elements
function initializeElements() {
    authSection = document.getElementById('admin-auth');
    dashboardSection = document.getElementById('admin-dashboard');
    loginForm = document.getElementById('admin-login-form');
    pendingSubmissionsGrid = document.getElementById('pending-submissions-grid');
    paidSubmissionsGrid = document.getElementById('paid-submissions-grid');
    rejectedSubmissionsGrid = document.getElementById('rejected-submissions-grid');
    statusFilter = document.getElementById('status-filter');
    chatModal = document.getElementById('chat-modal');
    chatSellerName = document.getElementById('chat-seller-name');
    chatForm = document.getElementById('admin-chat-form');
    chatMessages = document.getElementById('admin-chat-messages');
    messageInput = document.getElementById('admin-message-input');
    logoutBtn = document.getElementById('logoutBtn');
    videoModal = document.getElementById('video-modal');
    modalVideo = document.getElementById('modal-video');
    refreshBtn = document.getElementById('refreshBtn');
    resetBtn = document.getElementById('resetBtn');
    resetConfirmationModal = document.getElementById('reset-confirmation-modal');
    finalConfirmationModal = document.getElementById('final-confirmation-modal');
    
    // Stats elements
    totalSubmissions = document.getElementById('total-submissions');
    pendingSubmissions = document.getElementById('pending-submissions');
    approvedSubmissions = document.getElementById('approved-submissions');
    paidSubmissions = document.getElementById('paid-submissions');
    rejectedSubmissions = document.getElementById('rejected-submissions');
}

// Initialize event listeners
function initializeEventListeners() {
    const sendOtpButton = document.getElementById('sendOtpButton');
    const verifyButton = document.getElementById('verifyButton');
    const otpInput = document.getElementById('otpInput');

    if (sendOtpButton) {
        sendOtpButton.addEventListener('click', sendOTP);
    }
    if (verifyButton) {
        verifyButton.addEventListener('click', verifyOTP);
    }
    if (otpInput) {
        otpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyOTP();
            }
        });
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', loadGiftCards);
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('loading');
            try {
                await loadGiftCards();
            } finally {
                refreshBtn.classList.remove('loading');
            }
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', showResetConfirmation);
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (videoModal && e.target === videoModal) {
            closeVideoModal();
        }
        if (chatModal && e.target === chatModal) {
            closeChatModal();
        }
    });

    // Add escape key handler for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (videoModal && videoModal.style.display === 'block') {
                closeVideoModal();
            }
            if (chatModal && chatModal.style.display === 'block') {
                closeChatModal();
            }
        }
    });

    // Reset confirmation modal event listeners
    if (resetConfirmationModal) {
        const cancelBtn = resetConfirmationModal.querySelector('.cancel-btn');
        const confirmBtn = resetConfirmationModal.querySelector('.confirm-btn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => hideModal(resetConfirmationModal));
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', showFinalConfirmation);
        }
    }

    // Final confirmation modal event listeners
    if (finalConfirmationModal) {
        const cancelBtn = finalConfirmationModal.querySelector('.cancel-btn');
        const confirmBtn = finalConfirmationModal.querySelector('.confirm-btn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                hideModal(finalConfirmationModal);
                hideModal(resetConfirmationModal);
            });
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', handleDatabaseReset);
        }
    }
}

const OTP_API_BASE_URL = 'https://mail-steel.vercel.app';

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = show ? 'block' : 'none';
}

function setInputState(enabled) {
    const otpInput = document.getElementById('otpInput');
    const verifyButton = document.getElementById('verifyButton');
    const sendOtpButton = document.getElementById('sendOtpButton');
    
    otpInput.disabled = !enabled;
    verifyButton.disabled = !enabled;
    sendOtpButton.disabled = enabled;
    
    if (enabled) {
        otpInput.focus();
    }
}

async function sendOTP() {
    showLoading(true);
    setInputState(false);
    
    try {
        const response = await fetch(`${OTP_API_BASE_URL}/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('OTP sent successfully! Please check your email.', 'success');
            setInputState(true);
        } else {
            showMessage(data.error || 'Failed to send OTP', 'error');
            setInputState(false);
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        showMessage('Error sending OTP. Please try again.', 'error');
        setInputState(false);
    } finally {
        showLoading(false);
    }
}

async function verifyOTP() {
    const otp = document.getElementById('otpInput').value.trim();
    
    if (!otp) {
        showMessage('Please enter the OTP', 'error');
        return;
    }
    
    if (!/^\d{6}$/.test(otp)) {
        showMessage('Please enter a valid 6-digit OTP', 'error');
        return;
    }
    
    showLoading(true);
    setInputState(false);
    
    try {
        const response = await fetch(`${OTP_API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ otp })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('OTP verified successfully!', 'success');
            
            // Call the admin login endpoint after successful OTP verification
            const loginResponse = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: 'abc' })
            });
            
            const loginData = await loginResponse.json();
            
            if (loginData.success) {
                isAdminLoggedIn = true;
                showDashboard();
                await loadGiftCards();
            } else {
                showMessage('Admin login failed', 'error');
                setInputState(true);
            }
        } else {
            showMessage(data.error || 'Invalid OTP', 'error');
            setInputState(true);
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showMessage('Error verifying OTP. Please try again.', 'error');
        setInputState(true);
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    isAdminLoggedIn = false;
    localStorage.removeItem('adminPassword');
    showAuth();
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
                <span class="detail-label">Seller</span>
                <span class="detail-value">${card.username}</span>
            </div>
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
            <button class="action-btn view-btn" onclick="openChat(${card.user_id}, '${card.username}')">
                <i class="fas fa-comments"></i> Chat
            </button>
            ${card.status === 'pending' ? `
                <button class="action-btn approve-btn" onclick="updateStatus(${card.id}, 'approved')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="action-btn reject-btn" onclick="updateStatus(${card.id}, 'rejected')">
                    <i class="fas fa-times"></i> Reject
                </button>
            ` : ''}
            ${card.status === 'approved' ? `
                <button class="action-btn pay-btn" onclick="updateStatus(${card.id}, 'paid')">
                    <i class="fas fa-money-bill"></i> Mark as Paid
                </button>
            ` : ''}
        </div>
    `;
    
    return cardElement;
}

async function loadGiftCards() {
    if (!isAdminLoggedIn) {
        showAuth();
        return;
    }

    try {
        showLoading('Loading submissions...');
        const response = await fetch('/api/gift-cards');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const giftCards = Array.isArray(data) ? data : [];
        
        if (pendingSubmissionsGrid) pendingSubmissionsGrid.innerHTML = '';
        if (paidSubmissionsGrid) paidSubmissionsGrid.innerHTML = '';
        if (rejectedSubmissionsGrid) rejectedSubmissionsGrid.innerHTML = '';
        
        let stats = {
            total: giftCards.length,
            pending: 0,
            approved: 0,
            paid: 0,
            rejected: 0
        };

        const filteredStatus = statusFilter ? statusFilter.value : 'all';
        
        giftCards.forEach(card => {
            // Update stats
            stats[card.status]++;
            
            // Create card element
            const cardElement = createSubmissionCard(card);
            
            // Add to appropriate grid
            if (card.status === 'paid' && paidSubmissionsGrid) {
                paidSubmissionsGrid.appendChild(cardElement);
            } else if (card.status === 'rejected' && rejectedSubmissionsGrid) {
                rejectedSubmissionsGrid.appendChild(cardElement);
            } else if ((filteredStatus === 'all' || card.status === filteredStatus) && pendingSubmissionsGrid) {
                pendingSubmissionsGrid.appendChild(cardElement);
            }
        });

        // Update stats display
        if (totalSubmissions) totalSubmissions.textContent = stats.total;
        if (pendingSubmissions) pendingSubmissions.textContent = stats.pending;
        if (approvedSubmissions) approvedSubmissions.textContent = stats.approved;
        if (paidSubmissions) paidSubmissions.textContent = stats.paid;
        if (rejectedSubmissions) rejectedSubmissions.textContent = stats.rejected;
    } catch (err) {
        console.error('Error loading gift cards:', err);
        if (!isAdminLoggedIn) {
            showAuth();
        }
    } finally {
        hideLoading();
    }
}

function showVideo(url) {
    modalVideo.src = url;
    showModal(videoModal);
    modalVideo.play();
}

function closeVideoModal() {
    modalVideo.pause();
    modalVideo.src = '';
    hideModal(videoModal);
}

async function loadChatMessages(userId) {
    if (!userId) return;
    
    try {
        const response = await fetch(`/api/messages/${userId}`, {
            credentials: 'include'
        });
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
    if (!messageInput.value.trim() || !currentChatUserId) return;

    const content = messageInput.value.trim();
    messageInput.value = '';

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                userId: currentChatUserId,
                content,
                sender: 'admin'
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

// Start polling for new messages
function startMessagePolling() {
    if (isPolling) return;
    isPolling = true;
    
    setInterval(() => {
        if (currentChatUserId) {
            loadChatMessages(currentChatUserId);
        }
    }, 2000); // Poll every 2 seconds
}

function openChat(userId, username) {
    currentChatUserId = userId;
    chatSellerName.textContent = username;
    showModal(chatModal);
    loadChatMessages(userId);
    startMessagePolling();
}

function closeChatModal() {
    hideModal(chatModal);
    currentChatUserId = null;
    chatMessages.innerHTML = '';
}

async function updateStatus(cardId, newStatus) {
    if (!isAdminLoggedIn) {
        showAuth();
        return;
    }

    const button = event.target.closest('button');
    const originalText = button.innerHTML;
    
    try {
        button.classList.add('loading');
        button.innerHTML = '';
        
        const response = await fetch(`/api/gift-cards/${cardId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Admin-Password': localStorage.getItem('adminPassword')
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (data.success) {
            await loadGiftCards();
        } else {
            alert('Failed to update status: ' + data.error);
        }
    } catch (err) {
        alert('Error updating status: ' + err.message);
    } finally {
        button.classList.remove('loading');
        button.innerHTML = originalText;
    }
}

function showDashboard() {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
}

function showAuth() {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
}

// Show reset confirmation modal
function showResetConfirmation() {
    showModal(resetConfirmationModal);
}

// Show final confirmation modal
function showFinalConfirmation() {
    hideModal(resetConfirmationModal);
    showModal(finalConfirmationModal);
}

// Handle database reset
async function handleDatabaseReset() {
    const button = finalConfirmationModal.querySelector('.confirm-btn');
    const originalText = button.innerHTML;
    
    try {
        button.classList.add('loading');
        button.innerHTML = '';
        
        const response = await fetch('/api/reset-database', {
            method: 'POST'
        });

        const data = await response.json();
        if (data.success) {
            alert('Database has been reset successfully!');
            hideModal(finalConfirmationModal);
            await loadGiftCards();
        } else {
            alert('Failed to reset database: ' + data.error);
        }
    } catch (err) {
        alert('Error resetting database: ' + err.message);
    } finally {
        button.classList.remove('loading');
        button.innerHTML = originalText;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    showAuth(); // Always start with auth screen
}); 