// define api endpoint
const WORKER_URL = 'https://berichtsheft.elias1731.workers.dev';

// get dom elements
const daysContainer = document.getElementById('daysContainer');
const refreshBtn = document.getElementById('refreshBtn');
const loader = document.getElementById('loader');
const authBtn = document.getElementById('authBtn');
const authBtnText = document.getElementById('authBtnText');
const loginModal = document.getElementById('loginModal');
const passwordInput = document.getElementById('passwordInput');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');
const submitLoginBtn = document.getElementById('submitLoginBtn');

// store save timeouts for debounce
const saveDebounceMap = new Map();

// initialize auth token state
let authToken = localStorage.getItem('auth_token') || null;

// update UI based on authentication status
function updateAuthUi() {
    if (authToken) {
        authBtnText.textContent = 'Abmelden';
    } else {
        authBtnText.textContent = 'Anmelden';
    }
}

// fetch data from worker
async function loadData() {
    daysContainer.innerHTML = '';
    loader.classList.remove('hidden');
    refreshBtn.classList.add('animate-spin');

    // prepare request headers
    const headers = {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const res = await fetch(WORKER_URL, { headers });
        const data = await res.json();

        if (data.days) {
            renderDays(data.days);
        } else {
            alert('Fehler beim Laden: Ungültiges Datenformat');
        }
    } catch (err) {
        alert('Netzwerkfehler: Worker nicht erreichbar.');
    } finally {
        loader.classList.add('hidden');
        refreshBtn.classList.remove('animate-spin');
    }
}

// generate html for day cards
function renderDays(days) {
    daysContainer.innerHTML = '';

    days.forEach(day => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700';

        const apiText = Array.isArray(day.entries) ? day.entries.map(e => e.text).join('\n\n') : '';

        let notesSectionHtml = '';
        if (authToken) {
            const noteContent = day.note || '';
            notesSectionHtml = `
                <div>
                    <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1"> Notizen</h3>
                    <textarea 
                        class="w-full bg-slate-700 border-none rounded-lg p-3 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-y" 
                        rows="3" 
                        placeholder="Notizen eingeben..."
                        data-date="${day.date}"
                    >${noteContent}</textarea>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h2 class="text-lg font-bold text-white">${day.day || ''} ${day.date}</h2>
                <span class="text-sm bg-blue-900 text-blue-200 py-1 px-3 rounded-full">${day.total || ''}</span>
            </div>
            
            <div class="mb-4">
                <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1">  Einträge</h3>
                <div class="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 min-h-[40px] whitespace-pre-wrap">${apiText || '<span class="text-slate-600 italic">Noch kein Eintrag</span>'}</div>
            </div>
            ${notesSectionHtml}
        `;

        daysContainer.appendChild(card);
    });

    // attach input listeners for notes textareas
    if (authToken) {
        document.querySelectorAll('textarea[data-date]').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const dateStr = e.target.getAttribute('data-date');
                const text = e.target.value;

                if (saveDebounceMap.has(dateStr)) {
                    clearTimeout(saveDebounceMap.get(dateStr));
                }

                saveDebounceMap.set(dateStr, setTimeout(() => {
                    saveNoteToWorker(dateStr, text);
                }, 500));
            });
        });
    }
}

// save note to backend database
async function saveNoteToWorker(date, text) {
    if (!authToken) return;

    try {
        await fetch(`${WORKER_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ date, text })
        });
    } catch (err) {
        console.error('Failed to save note', err);
    }
}

// handle login action
async function handleLogin() {
    const password = passwordInput.value;
    if (!password) return;

    try {
        const res = await fetch(`${WORKER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            const data = await res.json();
            authToken = data.token;
            localStorage.setItem('auth_token', authToken);
            loginModal.classList.add('hidden');
            passwordInput.value = '';
            updateAuthUi();
            loadData();
        } else {
            alert('Falsches Passwort!');
        }
    } catch (err) {
        alert('Fehler beim Anmelden.');
    }
}

// bind UI action events
authBtn.addEventListener('click', () => {
    if (authToken) {
        authToken = null;
        localStorage.removeItem('auth_token');
        updateAuthUi();
        loadData();
    } else {
        loginModal.classList.remove('hidden');
        passwordInput.focus();
    }
});

cancelLoginBtn.addEventListener('click', () => {
    loginModal.classList.add('hidden');
    passwordInput.value = '';
});

submitLoginBtn.addEventListener('click', handleLogin);

passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});

refreshBtn.addEventListener('click', loadData);

// register service worker if supported
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Service Worker Registration failed', err));
}

// initialize application
updateAuthUi();
loadData();