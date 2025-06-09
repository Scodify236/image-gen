// Admin OTP Verification
const OTP_API_BASE_URL = 'https://mail-steel.vercel.app';

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = show ? 'block' : 'none';
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
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
                window.location.href = '/admin.html';
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

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
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
        
        // Only allow numeric input
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
}); 