// define api endpoint
const WORKER_URL = 'https://berichtsheft.elias1731.workers.dev';

// get dom elements
const daysContainer = document.getElementById('daysContainer');
const refreshBtn = document.getElementById('refreshBtn');
const loader = document.getElementById('loader');

// fetch data from api
async function loadData() {
    daysContainer.innerHTML = '';
    loader.classList.remove('hidden');
    refreshBtn.classList.add('animate-spin');

    try {
        // execute fetch request
        const res = await fetch(WORKER_URL);
        const data = await res.json();

        // check if days array exists
        if (data.days) {
            // render day cards
            renderDays(data.days);
        } else {
            // show error alert
            alert('Fehler beim Laden: Ungültiges Datenformat');
        }
    } catch (err) {
        // handle fetch error
        alert('Netzwerkfehler: Worker nicht erreichbar.');
    } finally {
        // reset loading state
        loader.classList.add('hidden');
        refreshBtn.classList.remove('animate-spin');
    }
}

// generate html for days
function renderDays(days) {
    days.forEach(day => {
        // create card container
        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700';

        // define storage keys
        const localNoteKey = `note_${day.date}`;
        const lastTextKey = `lastText_${day.date}`;

        // load saved data
        let storedNote = localStorage.getItem(localNoteKey) || '';
        let lastApiText = localStorage.getItem(lastTextKey) || '';

        // combine entry texts
        const apiText = day.entries.map(e => e.text).join('\n\n');

        // clear notes on text change
        if (lastApiText !== apiText && apiText.trim() !== '') {
            storedNote = '';
            localStorage.removeItem(localNoteKey);
        }
        
        // save current api text
        localStorage.setItem(lastTextKey, apiText);

        // set inner html
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h2 class="text-lg font-bold text-white">${day.day} ${day.date}</h2>
                <span class="text-sm bg-blue-900 text-blue-200 py-1 px-3 rounded-full">${day.total}</span>
            </div>
            
            <div class="mb-4">
                <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1">📋 Einträge</h3>
                <div class="bg-slate-900 p-3 rounded-lg text-sm text-slate-300 min-h-[40px] whitespace-pre-wrap">${apiText || '<span class="text-slate-600 italic">Noch kein Eintrag</span>'}</div>
            </div>

            <div>
                <h3 class="text-xs uppercase text-slate-400 font-semibold mb-1">📝Notizen</h3>
                <textarea 
                    class="w-full bg-slate-700 border-none rounded-lg p-3 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-y" 
                    rows="3" 
                    placeholder="Notizen eingeben..."
                    data-date="${day.date}"
                >${storedNote}</textarea>
            </div>
        `;

        // append card to dom
        daysContainer.appendChild(card);
    });

    // bind textarea events
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const dateStr = e.target.getAttribute('data-date');
            localStorage.setItem(`note_${dateStr}`, e.target.value);
        });
    });
}

// bind refresh button
refreshBtn.addEventListener('click', loadData);

// init service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Service Worker Registration failed', err));
}

// start initial fetch
loadData();