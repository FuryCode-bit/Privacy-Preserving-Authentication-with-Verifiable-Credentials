// --- Constants ---
const API_BASE_URL = 'http://localhost:5001';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const vcList = document.getElementById('vc-list');
const loadingMessage = document.getElementById('loading-message');
const noVcsMessage = document.getElementById('no-vcs-message');
const logoutButton = document.getElementById('logout-button');
const vcUploadInput = document.getElementById('vc-upload');
const uploadButtonLabel = document.querySelector('label[for="vc-upload"]');

// Modal Elements
const disclosureModal = document.getElementById('disclosure-modal');
const disclosureForm = document.getElementById('disclosure-form');
const closeModalButton = document.querySelector('.close-button');
const cancelPresentationButton = document.getElementById('cancel-presentation-button');
const generatePresentationButton = document.getElementById('generate-presentation-button');
const presentationError = document.getElementById('presentation-error');

// --- State ---
let allVCs = []; // In-memory cache of all VCs from the backend

// --- Functions ---

/**
 * Switches between the login and dashboard views.
 */
function showView(viewName) {
    loginView.classList.add('hidden');
    dashboardView.classList.add('hidden');
    if (viewName === 'login') {
        loginView.classList.remove('hidden');
    } else if (viewName === 'dashboard') {
        dashboardView.classList.remove('hidden');
    }
}

/**
 * Renders a single Verifiable Credential item using the new card layout.
 * @param {object} vcWrapper - The credential wrapper object from the API.
 */
function renderVC(vcWrapper) {
    try {
        const credential = JSON.parse(vcWrapper.credential_data);
        const { cred_id } = vcWrapper;
        const { credentialSubject, type, issuanceDate } = credential;

        const li = document.createElement('li');
        li.className = 'vc-item';

        const vcType = type.filter(t => t !== 'VerifiableCredential').join(', ') || 'Credential';
        const formattedDate = new Date(issuanceDate).toLocaleDateString();

        // Create the card structure
        li.innerHTML = `
            <div class="vc-item-header">${vcType}</div>
            <div class="vc-item-body">
                <p><strong>Course:</strong> ${credentialSubject.course || 'N/A'}</p>
                <p><strong>University:</strong> ${credentialSubject.university || 'N/A'}</p>
                <p><strong>Name:</strong> ${credentialSubject.name || 'N/A'}</p>
                <p><strong>Grade:</strong> ${credentialSubject.grade || 'N/A'}</p>
            </div>
            <div class="vc-item-footer">
                <span>Issued: ${formattedDate}</span>
                <div class="vc-actions">
                    <button class="btn btn-primary btn-sm disclose-btn" data-cred-id="${cred_id}">Create Presentation</button>
                </div>
            </div>
        `;
        vcList.appendChild(li);
    } catch (error)
    {
        console.error("Failed to parse or render VC:", error, vcWrapper);
    }
}


/**
 * Fetches the list of credentials from the backend and displays them.
 */
async function fetchAndDisplayVCs() {
    vcList.innerHTML = ''; // Clear previous list
    loadingMessage.classList.remove('hidden');
    noVcsMessage.classList.add('hidden');
    allVCs = []; // Clear the cache

    try {
        const storageData = await browser.storage.local.get('token');
        const token = storageData.token;

        if (!token) {
            await handleLogout();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/list_credentials`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
            await handleLogout();
            return;
        }

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const credentials = await response.json();
        allVCs = credentials;

        if (credentials.length === 0) {
            noVcsMessage.classList.remove('hidden');
        } else {
            credentials.forEach(renderVC);
        }

    } catch (error) {
        console.error('Error fetching credentials:', error);
        vcList.innerHTML = `<p class="error-message">Could not load credentials.</p>`;
    } finally {
        loadingMessage.classList.add('hidden');
    }
}

// --- Selective Disclosure Modal Logic ---

function openDisclosureModal(credId) {
    const vcWrapper = allVCs.find(v => v.cred_id === credId);
    if (!vcWrapper) {
        alert("Error: Could not find the credential data.");
        return;
    }

    const vc = JSON.parse(vcWrapper.credential_data);
    disclosureForm.innerHTML = '';
    presentationError.textContent = '';
    presentationError.classList.add('hidden');
    
    const claims = Object.keys(vc.credentialSubject);

    claims.forEach(claim => {
        // The subject 'id' is usually required and not optional
        if (claim === 'id') return;

        // --- THIS IS THE UPDATED PART ---
        // Create the new row and toggle switch structure
        const disclosureRow = document.createElement('div');
        disclosureRow.className = 'disclosure-row';

        // Use a unique ID for the input and a matching 'for' on the label
        const uniqueId = `toggle-${claim}-${credId}`;

        disclosureRow.innerHTML = `
            <span class="claim-name">${claim}</span>
            <label class="toggle-switch" for="${uniqueId}">
                <input type="checkbox" id="${uniqueId}" name="${claim}" value="${claim}" checked>
                <span class="toggle-slider"></span>
            </label>
        `;
        // --- END OF UPDATED PART ---

        disclosureForm.appendChild(disclosureRow);
    });
    
    generatePresentationButton.dataset.credId = credId;
    disclosureModal.classList.remove('hidden');
}

function closeDisclosureModal() {
    disclosureModal.classList.add('hidden');
}

async function handleGeneratePresentation() {
    presentationError.textContent = '';
    presentationError.classList.add('hidden');
    generatePresentationButton.disabled = true;
    generatePresentationButton.textContent = 'Generating...';

    const credId = parseInt(generatePresentationButton.dataset.credId, 10);
    const vcWrapper = allVCs.find(v => v.cred_id === credId);

    try {
        if (!vcWrapper) throw new Error("Could not find original credential data.");

        const vc = JSON.parse(vcWrapper.credential_data);
        const selectedClaims = Array.from(disclosureForm.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
        
        const disclosureFrame = {
            "@context": vc["@context"],
            "type": vc.type,
            "credentialSubject": { "@explicit": true, "id": {}, ...selectedClaims.reduce((acc, claim) => ({ ...acc, [claim]: {} }), {}) }
        };

        const storageData = await browser.storage.local.get('token');
        if (!storageData.token) throw new Error("Authentication token not found.");

        const response = await fetch(`${API_BASE_URL}/api/create_presentation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${storageData.token}`
            },
            body: JSON.stringify({ cred_id: credId, disclosure_frame: disclosureFrame })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server failed to generate the presentation.');
        }

        const presentation = await response.json();

        const blob = new Blob([JSON.stringify(presentation, null, 2)], { type: 'application/ld+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presentation-${credId}-${Date.now()}.jsonld`;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        
        closeDisclosureModal();

    } catch (error) {
        console.error("Error generating presentation:", error);
        presentationError.textContent = error.message;
        presentationError.classList.remove('hidden');
    } finally {
        generatePresentationButton.disabled = false;
        generatePresentationButton.textContent = 'Generate & Download';
    }
}

// --- Authentication and Initialization ---

async function handleLogin(e) {
    e.preventDefault();
    loginError.textContent = '';
    loginError.classList.add('hidden');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        if (!data.token) throw new Error('Login response did not include a token.');

        await browser.storage.local.set({ token: data.token, email: email });

        userEmailSpan.textContent = email;
        showView('dashboard');
        await fetchAndDisplayVCs();

    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
}

async function handleLogout() {
    await browser.storage.local.remove(['token', 'email']);
    allVCs = [];
    vcList.innerHTML = '';
    emailInput.value = '';
    passwordInput.value = '';
    loginError.textContent = '';
    loginError.classList.add('hidden');
    showView('login');
}

async function initialize() {
    const data = await browser.storage.local.get(['token', 'email']);
    if (data.token && data.email) {
        userEmailSpan.textContent = data.email;
        showView('dashboard');
        await fetchAndDisplayVCs();
    } else {
        showView('login');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initialize);
loginForm.addEventListener('submit', handleLogin);
logoutButton.addEventListener('click', handleLogout);

// Modal listeners
closeModalButton.addEventListener('click', closeDisclosureModal);
cancelPresentationButton.addEventListener('click', closeDisclosureModal);
generatePresentationButton.addEventListener('click', handleGeneratePresentation);
window.addEventListener('click', (event) => {
    if (event.target === disclosureModal) closeDisclosureModal();
});

// Use event delegation for dynamically created buttons
vcList.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('disclose-btn')) {
        const credId = parseInt(e.target.dataset.credId, 10);
        openDisclosureModal(credId);
    }
});

// Listener for the "Import Credential" button
uploadButtonLabel.addEventListener('click', (event) => {
    event.preventDefault();
    browser.tabs.create({
        url: browser.runtime.getURL('upload.html')
    });
});