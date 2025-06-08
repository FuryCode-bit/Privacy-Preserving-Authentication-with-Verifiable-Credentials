// --- Constants ---
const API_BASE_URL = 'http://localhost:5001';

// --- DOM Elements ---
const uploadInput = document.getElementById('upload-input');
const uploadLabel = document.getElementById('upload-label');
const statusMessage = document.getElementById('status-message');

// --- Event Listeners ---
uploadInput.addEventListener('change', handleVCUpload);

// --- Functions ---
async function handleVCUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset UI state
    uploadLabel.textContent = 'Uploading...';
    uploadLabel.classList.add('disabled');
    statusMessage.textContent = '';
    statusMessage.classList.add('hidden');

    try {
        // 1. Get the auth token from storage
        const storageData = await browser.storage.local.get('token');
        const token = storageData.token;

        if (!token) {
            throw new Error("Authentication error. Please log in again in the extension popup.");
        }

        const fileContent = await file.text();
        const vcJson = JSON.parse(fileContent);

        // 2. Call the backend upload endpoint
        const response = await fetch(`${API_BASE_URL}/api/holder/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vcJson)
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Server responded with status: ${response.status}`);
        }

        statusMessage.style.color = 'var(--success-color)';
        statusMessage.textContent = '✅ Success! This tab will close in 3 seconds.';
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            window.close();
        }, 3000);

    } catch (error) {
        statusMessage.style.color = 'var(--danger-color)';
        statusMessage.textContent = `❌ Error: ${error.message}`;
        statusMessage.classList.remove('hidden');
    } finally {
        if (statusMessage.style.color.includes('var(--danger-color)')) {
            uploadLabel.textContent = 'Select Another File';
            uploadLabel.classList.remove('disabled');
        }
        event.target.value = null; 
    }
}