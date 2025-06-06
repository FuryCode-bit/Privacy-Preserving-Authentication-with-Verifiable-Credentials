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
 * Renders a single Verifiable Credential item in the list.
 * NOW INCLUDES DETAILED INFORMATION FROM CREDENTIAL SUBJECT.
 * @param {object} vcWrapper - The credential wrapper object from the API.
 */
function renderVC(vcWrapper) {
    try {
        const credential = JSON.parse(vcWrapper.credential_data);
        const { cred_id } = vcWrapper; // The database ID is crucial.
        const { credentialSubject, type, issuanceDate, issuer } = credential;

        const li = document.createElement('li');
        li.className = 'vc-item';

        const vcType = type.filter(t => t !== 'VerifiableCredential').join(', ') || 'Credential';
        const formattedDate = new Date(issuanceDate).toLocaleDateString();

        // --- KEY CHANGE: Update the innerHTML to include the new fields ---
        li.innerHTML = `
            <h3>${vcType}</h3>
            <div class="vc-details">
                <p><strong>Course:</strong> ${credentialSubject.course || 'N/A'}</p>
                <p><strong>University:</strong> ${credentialSubject.university || 'N/A'}</p>
                <p><strong>Name:</strong> ${credentialSubject.name || 'N/A'}</p>
                <p><strong>Grade:</strong> ${credentialSubject.grade || 'N/A'}</p>
            </div>
            <div class="vc-meta">
                <p><strong>Issued On:</strong> ${formattedDate}</p>
            </div>
        `;
        
        // Add actions container (this logic remains the same)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'vc-actions';

        const discloseButton = document.createElement('button');
        discloseButton.textContent = 'Create Presentation';
        discloseButton.onclick = () => openDisclosureModal(cred_id);
        actionsDiv.appendChild(discloseButton);
        
        li.appendChild(actionsDiv);
        vcList.appendChild(li);

    } catch (error) {
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
            console.log("No token found. Forcing logout.");
            await handleLogout();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/list_credentials`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (response.status === 401 || response.status === 403) {
            console.log("Token invalid or expired. Forcing logout.");
            await handleLogout();
            return;
        }

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const credentials = await response.json();
        allVCs = credentials; // Cache the full credential objects

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
    disclosureForm.innerHTML = ''; // Clear previous form
    presentationError.textContent = ''; // Clear previous errors
    
    // Get all claims from the credentialSubject
    const claims = Object.keys(vc.credentialSubject);

    claims.forEach(claim => {
        // The subject 'id' is usually required, so we don't make it optional
        if (claim === 'id') return;

        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-group';
        checkboxDiv.innerHTML = `
            <label>
                <input type="checkbox" name="${claim}" value="${claim}" checked />
                ${claim}
            </label>
        `;
        disclosureForm.appendChild(checkboxDiv);
    });
    
    // Store the database cred_id on the button for the handler to use
    generatePresentationButton.dataset.credId = credId;
    disclosureModal.classList.remove('hidden');
}

function closeDisclosureModal() {
    disclosureModal.classList.add('hidden');
}

async function handleGeneratePresentation() {
    presentationError.textContent = '';
    generatePresentationButton.disabled = true;
    generatePresentationButton.textContent = 'Generating...';

    const credId = parseInt(generatePresentationButton.dataset.credId, 10);
    const vcWrapper = allVCs.find(v => v.cred_id === credId);

    try {
        if (!vcWrapper) throw new Error("Could not find original credential data.");

        const vc = JSON.parse(vcWrapper.credential_data);
        const selectedClaims = Array.from(disclosureForm.querySelectorAll('input[type="checkbox"]:checked'))
            .map(input => input.value);
        
        // Construct the disclosure frame for the backend
        const disclosureFrame = {
            "@context": vc["@context"],
            "type": vc.type,
            "credentialSubject": {
                "@explicit": true,
                "id": {}, // Always reveal the subject's ID by default
                ...selectedClaims.reduce((acc, claim) => {
                    acc[claim] = {};
                    return acc;
                }, {})
            }
        };

        const storageData = await browser.storage.local.get('token');
        if (!storageData.token) throw new Error("Authentication token not found.");

        const response = await fetch(`${API_BASE_URL}/api/create_presentation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${storageData.token}`
            },
            body: JSON.stringify({
                cred_id: credId,
                disclosure_frame: disclosureFrame
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server failed to generate the presentation.');
        }

        const presentation = await response.json();

        // Trigger a download for the generated presentation
        const blob = new Blob([JSON.stringify(presentation, null, 2)], { type: 'application/ld+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presentation-${credId}-${Date.now()}.jsonld`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        closeDisclosureModal();

    } catch (error) {
        console.error("Error generating presentation:", error);
        presentationError.textContent = error.message;
    } finally {
        generatePresentationButton.disabled = false;
        generatePresentationButton.textContent = 'Generate & Download';
    }
}


// --- Authentication and Initialization ---

async function handleLogin(e) {
    e.preventDefault();
    loginError.textContent = '';
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
closeModalButton.addEventListener('click', closeDisclosureModal);
generatePresentationButton.addEventListener('click', handleGeneratePresentation);

window.addEventListener('click', (event) => {
    if (event.target == disclosureModal) closeDisclosureModal();
});

// --- KEY CHANGE: Replace the old upload listener with this ---
// Instead of listening for a 'change' event, we listen for a 'click' on the label.
const uploadButton = document.querySelector('label[for="vc-upload"]');
uploadButton.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent the (now hidden) file input from opening
    browser.tabs.create({
        url: browser.runtime.getURL('upload.html')
    });
});