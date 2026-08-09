// define api endpoint
const WORKER_URL = 'https://api.heyfordy.dev/bheft';

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

const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const resetWeekBtn = document.getElementById('resetWeekBtn');
const weekLabel = document.getElementById('weekLabel');
const dateLabel = document.getElementById('dateLabel');

// store save timeouts for debounce
const saveDebounceMap = new Map();
// store the current state of entries for comparison
const currentEntriesMap = new Map();

// initialize auth token state
let authToken = localStorage.getItem('auth_token') || null;

// aktuelle Woche = offset 1 (entspricht /tw/1)
let currentOffset = 1;

// update UI based on authentication status
function updateAuthUi() {
    if (authToken) {
        authBtnText.textContent = '👋';
    } else {
        authBtnText.textContent = '✏️';
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
        const res = await fetch(`${WORKER_URL}?offset=${currentOffset}`, { headers });
        const data = await res.json();

        if (data.days) {
            // Erfolgreiche Daten lokal für Fallback sichern
            localStorage.setItem('cached_data', JSON.stringify(data));
            renderData(data);
        } else {
            throw new Error(data.error || 'Ungültiges Datenformat');
        }
    } catch (err) {
        // Fallback: Zeige letzte lokal gespeicherte Einträge an
        const cachedDataStr = localStorage.getItem('cached_data');

        if (cachedDataStr) {
            renderData(JSON.parse(cachedDataStr));
            console.warn('API nicht erreichbar. Lade letzten lokalen Stand.');
        } else {
            alert('Netzwerkfehler: Worker nicht erreichbar und kein Offline-Speicher vorhanden.');
            weekLabel.textContent = 'Fehler beim Laden';
        }
    } finally {
        loader.classList.add('hidden');
        refreshBtn.classList.remove('animate-spin');
    }
}

// generate html for day cards and update week info
function renderData(data) {
    daysContainer.innerHTML = '';
    currentEntriesMap.clear();

    // Update Header Infos
    if (currentOffset === 1) {
        weekLabel.textContent = `Aktuelle Woche (KW ${data.week || '?'})`;
        weekLabel.classList.add('text-blue-400');
        weekLabel.classList.remove('text-slate-200');
    } else {
        const offsetText = currentOffset < 1
            ? `${1 - currentOffset} zurück`
            : `${currentOffset - 1} vor`;
        weekLabel.textContent = `KW ${data.week || '?'} (${offsetText})`;
        weekLabel.classList.remove('text-blue-400');
        weekLabel.classList.add('text-slate-200');
    }

    if (data.from && data.to) {
        dateLabel.textContent = `${data.from} - ${data.to}`;
        dateLabel.classList.remove('hidden');
    } else {
        dateLabel.classList.add('hidden');
    }

    // Render Days
    data.days.forEach(day => {
        const entriesState = JSON.stringify(day.entries || []);
        currentEntriesMap.set(day.date, entriesState);

        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700';

        const entries = Array.isArray(day.entries) ? day.entries : [];
        const isSingle8h = entries.length === 1 &&
            (entries[0].hours === '8h:00min' || entries[0].hours === '8h:0min');

        let entriesHtml = '';

        if (entries.length === 0) {
            entriesHtml = `<div class="bg-slate-900 p-3 rounded-lg text-sm text-slate-600 italic">Noch kein Eintrag</div>`;
        } else if (isSingle8h) {
            // single 8h entry - text only, no per-entry time badge
            entriesHtml = `<div class="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 whitespace-pre-wrap">${escapeHtml(entries[0].text) || '<span class="text-slate-600 italic">Kein Text</span>'}</div>`;
        } else {
            // multiple entries or non-8h - show each with its time
            entriesHtml = entries.map(entry => `
                <div class="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 mb-2 last:mb-0">
                    <div class="flex justify-between items-start gap-2 mb-1">
                        <div class="whitespace-pre-wrap flex-1">${escapeHtml(entry.text) || '<span class="text-slate-600 italic">Kein Text</span>'}</div>
                        <span class="text-xs bg-slate-700 text-slate-300 py-0.5 px-2 rounded-full whitespace-nowrap">${entry.hours || ''}</span>
                    </div>
                </div>
            `).join('');
        }

        let notesSectionHtml = '';
        if (authToken) {
            const noteContent = day.note || '';
            notesSectionHtml = `
                <div class="mt-4">
                    <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1">Notizen</h3>
                    <textarea 
                        class="w-full bg-slate-700 border-none rounded-lg p-3 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-y" 
                        rows="3" 
                        placeholder="Notizen eingeben..."
                        data-date="${day.date}"
                    >${escapeHtml(noteContent)}</textarea>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h2 class="text-lg font-bold text-white">${day.day || ''} ${day.date}</h2>
                <span class="text-sm bg-blue-900 text-blue-200 py-1 px-3 rounded-full">${day.total || '0h:00min'}</span>
            </div>
            
            <div class="mb-1">
                <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1">Einträge</h3>
                ${entriesHtml}
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

// simple html escape
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// save note to backend database
async function saveNoteToWorker(date, text) {
    if (!authToken) return;

    const entriesState = currentEntriesMap.get(date) || '[]';

    try {
        await fetch(`${WORKER_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ date, text, entriesState })
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
            loadData(); // Lädt jetzt die Daten INKLUSIVE Notizen neu
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

// Week Navigation Events
prevWeekBtn.addEventListener('click', () => {
    currentOffset--;
    loadData();
});

nextWeekBtn.addEventListener('click', () => {
    currentOffset++;
    loadData();
});

resetWeekBtn.addEventListener('click', () => {
    if (currentOffset !== 1) {
        currentOffset = 1;
        loadData();
    }
});

// register service worker if supported
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Service Worker Registration failed', err));
}

// initialize application
updateAuthUi();
loadData();