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
const searchInput = document.getElementById('search-input');

// Modal Elements
const disclosureModal = document.getElementById('disclosure-modal');
const disclosureForm = document.getElementById('disclosure-form');
const closeModalButton = document.querySelector('.close-button');
const cancelPresentationButton = document.getElementById('cancel-presentation-button');
const generatePresentationButton = document.getElementById('generate-presentation-button');
const presentationError = document.getElementById('presentation-error');

// --- State ---
let allVCs = [];

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
 * Finds a document by its ID and triggers a browser download.
 */
function handleDownload(docId) {
    const docWrapper = allVCs.find(v => v.cred_id === docId);
    if (!docWrapper) {
        alert("Error: Could not find the document data to download.");
        return;
    }

    try {
        const documentJson = JSON.parse(docWrapper.credential_data);
        const blob = new Blob([JSON.stringify(documentJson, null, 2)], { type: 'application/ld+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Create a user-friendly filename
        const category = docWrapper.category || 'document';
        a.download = `${category.toLowerCase()}-${docId}.jsonld`;
        
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error("Error preparing document for download:", error);
        alert("An error occurred while preparing the download.");
    }
}

function renderSingleVC(docWrapper) {
    try {
        const documentData = JSON.parse(docWrapper.credential_data);
        const { cred_id, category, issued_at } = docWrapper;
        
        const li = document.createElement('li');
        li.className = `vc-item vc-category-${category.toLowerCase()}`;

        let docTitle, mainContent = '';
        const formattedDate = new Date(issued_at).toLocaleDateString();
        const downloadButtonHtml = `<button class="btn btn-secondary btn-sm download-btn" data-cred-id="${cred_id}">Download</button>`;
        let actions = downloadButtonHtml;

        // Logic for a standard VP
        if (category === 'VP') {
            const vcsInVp = Array.isArray(documentData.verifiableCredential) ? documentData.verifiableCredential : [];
            
            if (vcsInVp.length > 0) {
                const firstVc = vcsInVp[0];
                const specificType = firstVc.type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
                docTitle = `Presentation: ${specificType}`;
                
                const subject = firstVc.credentialSubject || {};
                mainContent = `
                    <p><strong>Course:</strong> ${subject.course || 'N/A'}</p>
                    <p><strong>University:</strong> ${subject.university || 'N/A'}</p>
                    <p><strong>Name:</strong> ${subject.name || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${subject.grade || 'N/A'}</p>
                `;
            } else {
                docTitle = 'Verifiable Presentation';
                mainContent = `<p class="text-muted">This presentation is empty.</p>`;
            }
        } else { // Logic for a standard VC
            const { type } = documentData;
            docTitle = type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
            const subject = documentData.credentialSubject || {};
            mainContent = `
                <p><strong>Course:</strong> ${subject.course || 'N/A'}</p>
                <p><strong>University:</strong> ${subject.university || 'N/A'}</p>
                <p><strong>Name:</strong> ${subject.name || 'N/A'}</p>
                <p><strong>Grade:</strong> ${subject.grade || 'N/A'}</p>
            `;
            actions = `<button class="btn btn-primary btn-sm disclose-btn" data-cred-id="${cred_id}">Create VP</button>` + downloadButtonHtml;
        }
        
        li.innerHTML = `
            <div class="vc-item-header">
                <span class="vc-category-badge">${category}</span>
                ${docTitle}
            </div>
            <div class="vc-item-body">${mainContent}</div>
            <div class="vc-item-footer">
                <span>Stored: ${formattedDate}</span>
                <div class="vc-actions">${actions}</div>
            </div>
        `;
        vcList.appendChild(li);

    } catch (error) {
        console.error("Failed to parse or render document:", error, docWrapper);
    }
}

/**
 * Renders the list of documents, filtered by a search term.
 */
function displayFilteredVCs(searchTerm = '') {
    vcList.innerHTML = '';

    const filtered = allVCs.filter(docWrapper => {
        try {
            const doc = JSON.parse(docWrapper.credential_data);
            const category = docWrapper.category || 'VC';
            let title = '';
            if (category === 'VP') {
                const vcsInVp = Array.isArray(doc.verifiableCredential) ? doc.verifiableCredential : [];
                if (vcsInVp.length > 0) {
                    title = vcsInVp[0].type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
                }
            } else {
                title = doc.type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
            }
            return title.toLowerCase().includes(searchTerm.toLowerCase());
        } catch (e) {
            return false;
        }
    });

    if (filtered.length === 0) {
        if (searchTerm) {
            noVcsMessage.textContent = `No documents found for "${searchTerm}".`;
        } else {
            noVcsMessage.textContent = `You do not have any credentials.`;
        }
        noVcsMessage.classList.remove('hidden');
    } else {
        noVcsMessage.classList.add('hidden');
        filtered.forEach(renderSingleVC);
    }
}


/**
 * Fetches the list of credentials from the backend and displays them.
 */
async function fetchAndDisplayVCs() {
    vcList.innerHTML = '';
    loadingMessage.classList.remove('hidden');
    noVcsMessage.classList.add('hidden');
    allVCs = [];

    try {
        const storageData = await browser.storage.local.get('token');
        const token = storageData.token;
        if (!token) { await handleLogout(); return; }

        const response = await fetch(`${API_BASE_URL}/api/holder/list_credentials`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) { await handleLogout(); return; }

        const credentials = await response.json();
        allVCs = credentials;
        displayFilteredVCs();
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

        if (claim === 'id') return;

        // Createa the new row and toggle switch structure
        const disclosureRow = document.createElement('div');
        disclosureRow.className = 'disclosure-row';

        const uniqueId = `toggle-${claim}-${credId}`;

        disclosureRow.innerHTML = `
            <span class="claim-name">${claim}</span>
            <label class="toggle-switch" for="${uniqueId}">
                <input type="checkbox" id="${uniqueId}" name="${claim}" value="${claim}" checked>
                <span class="toggle-slider"></span>
            </label>
        `;

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

        if (selectedClaims.length === 0) {
            presentationError.textContent = "You must select at least one claim to reveal.";
            presentationError.classList.remove('hidden');
        return;
        }

        const disclosureFrame = {
            "@context": vc["@context"],
            "type": vc.type,
            "credentialSubject": { "@explicit": true, "id": {}, ...selectedClaims.reduce((acc, claim) => ({ ...acc, [claim]: {} }), {}) }
        };

        const storageData = await browser.storage.local.get('token');
        if (!storageData.token) throw new Error("Authentication token not found.");

        const response = await fetch(`${API_BASE_URL}/api/holder/create_presentation`, {
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

// Event delegation for dynamically created buttons
vcList.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('disclose-btn')) {
        const credId = parseInt(e.target.dataset.credId, 10);
        openDisclosureModal(credId);
    }
        else if (e.target && e.target.classList.contains('download-btn')) {
        const credId = parseInt(e.target.dataset.credId, 10);
        handleDownload(credId);
    }
});

// Listener for the search input
searchInput.addEventListener('input', (e) => {
    displayFilteredVCs(e.target.value);
});

// Listener for the "Import Credential" button
uploadButtonLabel.addEventListener('click', (event) => {
    event.preventDefault();
    browser.tabs.create({
        url: browser.runtime.getURL('upload.html')
    });
});