const API_BASE_URL = 'http://localhost:5001';

const uploadInput = document.getElementById('upload-input');
const uploadLabel = document.getElementById('upload-label');
const statusMessage = document.getElementById('status-message');

// Add the event listener to the file input on this page
uploadInput.addEventListener('change', handleVCUpload);

async function handleVCUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploadLabel.textContent = 'Uploading...';
    uploadLabel.style.pointerEvents = 'none'; // Disable clicking
    statusMessage.textContent = '';

    try {
        // 1. Get the auth token from storage, just like in the popup
        const storageData = await browser.storage.local.get('token');
        const token = storageData.token;

        if (!token) {
            throw new Error("Authentication error. Please log in again in the extension popup.");
        }

        const vcJson = JSON.parse(await file.text());

        // 2. Call the backend upload endpoint
        const response = await fetch(`${API_BASE_URL}/api/upload_vc`, {
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

        // 3. Show success message and close the tab after a delay
        statusMessage.style.color = 'green';
        statusMessage.textContent = '✅ Success! This tab will close in 3 seconds.';
        setTimeout(() => {
            window.close();
        }, 3000);

    } catch (error) {
        statusMessage.style.color = 'var(--danger-color)';
        statusMessage.textContent = `❌ Error: ${error.message}`;
    } finally {
        uploadLabel.textContent = 'Select Another File';
        uploadLabel.style.pointerEvents = 'auto'; // Re-enable clicking
        event.target.value = null; // Reset input
    }
}