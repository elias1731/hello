const el = (id) => document.getElementById(id);

// API configuration
const API_GROUPS = "https://api.heyfordy.de/newwfc";
const API_JSON = "https://api.heyfordy.de/dx_app/json";
const MII_API_URL = "https://api.heyfordy.de/dx_app/mii";
const MAX_MIIS_PER_REQUEST = 24;
const MII_EXPIRE_TIME = 1000 * 60 * 60 * 24; 
const RELOAD_TIME = 5000; 

// Application state
let RELOAD_TIMER = null; let cur_rooms = []; let all_players = [];
let FAVORITES = []; let USER_PROFILE = null; let CURRENT_VIEW_MODE = 'mobile';
let PERSISTENT_PROFILES = {};

// Modal control
const updateScrollLock = () => document.body.classList.toggle('no-scroll', document.querySelectorAll('.modal:not(.hidden)').length > 0);
const toggle_modal = (m) => { el(m).classList.toggle('hidden'); updateScrollLock(); };
const toggle_settings_modal = () => toggle_modal('settings-modal');
const toggle_favorites_modal = () => { render_favorites_list(); toggle_modal('favorites-modal'); }
const toggle_user_profile_modal = () => { update_user_profile_modal_state(); toggle_modal('user-profile-modal'); }
const hide_player_info_modal = () => { el('player-info-modal').classList.add('hidden'); updateScrollLock(); };
const toggle_info_modal = () => toggle_modal('info-modal');

// Close modals on background click
document.addEventListener('click', (e) => {
    document.querySelectorAll('.modal').forEach(m => { if (e.target === m) { m.classList.add('hidden'); updateScrollLock(); } });
});

// Cache management
function load_persistent_data() {
    FAVORITES = JSON.parse(localStorage.getItem("mkw_favorites") || "[]");
    USER_PROFILE = JSON.parse(localStorage.getItem("mkw_user_profile") || "null");
}
function save_persistent_data() {
    localStorage.setItem("mkw_favorites", JSON.stringify(FAVORITES));
    localStorage.setItem("mkw_user_profile", JSON.stringify(USER_PROFILE));
}

// Mii fetching and caching logic from rr.js
function get_cached_mii_image(fc){ const c=`mii_img_${fc}`; const s=localStorage.getItem(c); if(!s) return null; try { const a=JSON.parse(s); return a[0]; } catch(e){ return null; } }
function set_cached_mii_image(fc, img){ if (!fc || !img) return; const c = `mii_img_${fc}`; const finalImg = format_mii_src(img); try { localStorage.setItem(c, JSON.stringify([finalImg, Date.now()])); } catch(e) {} }
function format_mii_src(img) { if (!img) return './assets/loading.gif'; if (img.startsWith('http') || img.startsWith('data:image')) return img; return `data:image/png;base64,${img}`; }
function apply_mii_image(fc, img){ const els=document.querySelectorAll(`img[mii-data-fc="${fc}"]`); if(!els||els.length===0) return; let src = format_mii_src(img); for(const el of els) el.src=src; }

async function fetch_mii_images(miiDataArray, fcToMap = null){ 
    let u=[...new Set(miiDataArray)].filter(Boolean);
    for(let i=0; i<u.length; i+=MAX_MIIS_PER_REQUEST){
        const b=u.slice(i, i+MAX_MIIS_PER_REQUEST);
        try {
            const r=await fetch(MII_API_URL,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
            if(!r.ok) continue; const d=await r.json();
            for(const mData of Object.keys(d)){
                if(d[mData] && fcToMap) { apply_mii_image(fcToMap, d[mData]); set_cached_mii_image(fcToMap, d[mData]); }
            }
        } catch(e){}
    }
}

// Data normalization
function normalize_player(p) {
    let miiData = p.mii;
    if (Array.isArray(miiData) && miiData.length > 0) miiData = miiData[0].data;
    return {
        fc: p.FC || p.fc,
        name: p['+name'] || p.name || "Unknown player",
        ev: p.ev || "5000",
        eb: p.eb || "5000",
        mii: miiData || null,
        rk: p.rk || "",
        numplayers: p.numplayers || "0",
        mtype: p.dwc_mtype || "0"
    };
}

// Modal info logic
async function show_player_info_modal(fc) {
    const mc = el('player-info-content'); el('player-info-modal').classList.remove('hidden'); updateScrollLock();
    const active = normalize_player(all_players.find(x => x.FC === fc) || { FC: fc });
    const miiSrc = format_mii_src(get_cached_mii_image(fc));

    mc.innerHTML = `
        <div class="player-info-modal-header">
            <img class="player-mii-large" src="${miiSrc}" alt="Mii" mii-data-fc="${fc}">
            <div>
                <div class="player-name">${active.name}</div>
                <div class="player-fc">${fc}</div>
            </div>
        </div>
        <div class="player-info-modal-stats-grid">
            <div class="stat-item"><span class="stat-label">VR</span><span class="stat-value">${active.ev}</span></div>
            <div class="stat-item"><span class="stat-label">BR</span><span class="stat-value">${active.eb}</span></div>
        </div>
        <div class="player-info-modal-buttons">
            <button class="modal-close-btn" onclick="set_user_from_modal('${fc}')">Set as Profile</button>
            <button class="modal-close-btn" style="background:#555" onclick="toggle_favorite_from_modal('${fc}')">
                ${FAVORITES.some(f => f.fc === fc) ? "Remove Favorite" : "Add Favorite"}
            </button>
        </div>
    `;
    if (active.mii) fetch_mii_images([active.mii], fc);
}

// User Profile & Favorites
function manual_add_favorite() {
    const fc = el('fav-manual-fc').value.trim();
    if (!/^\d{4}-\d{4}-\d{4}$/.test(fc)) return alert("Format: ####-####-####");
    if (!FAVORITES.some(f => f.fc === fc)) { FAVORITES.push({ fc, name: "Unknown" }); save_persistent_data(); render_favorites_list(); reload_rooms(); }
}
function manual_set_user() {
    const fc = el('user-manual-fc').value.trim();
    if (!/^\d{4}-\d{4}-\d{4}$/.test(fc)) return alert("Format: ####-####-####");
    USER_PROFILE = { fc }; save_persistent_data(); update_user_profile_modal_state(); reload_rooms();
}
function set_user_from_modal(fc) { USER_PROFILE = { fc }; save_persistent_data(); hide_player_info_modal(); update_user_profile_modal_state(); reload_rooms(); }
function toggle_favorite_from_modal(fc) {
    const idx = FAVORITES.findIndex(f => f.fc === fc);
    if (idx > -1) FAVORITES.splice(idx, 1); else FAVORITES.push({ fc, name: "Unknown" });
    save_persistent_data(); hide_player_info_modal(); reload_rooms();
}
function logout_user() { USER_PROFILE = null; save_persistent_data(); location.reload(); }

function update_user_profile_modal_state() {
    const lv = el('user-login-view'), pv = el('user-profile-view'), dc = el('user-profile-display');
    if (USER_PROFILE) {
        lv.classList.add('hidden'); pv.classList.remove('hidden');
        const miiSrc = format_mii_src(get_cached_mii_image(USER_PROFILE.fc));
        dc.innerHTML = `<div class="player-info-modal-header"><img class="player-mii-large" src="${miiSrc}" alt="Mii" mii-data-fc="${USER_PROFILE.fc}"><div><div class="player-name">Your Profile</div><div class="player-fc">${USER_PROFILE.fc}</div></div></div>`;
    } else { pv.classList.add('hidden'); lv.classList.remove('hidden'); }
}
function render_favorites_list() {
    const lc = el('favorites-list');
    if (FAVORITES.length === 0) { lc.innerHTML = '<p>No favorites added yet.</p>'; return; }
    lc.innerHTML = FAVORITES.map(f => `<div class="player-row" onclick="show_player_info_modal('${f.fc}')"><img class="player-mii" src="${format_mii_src(get_cached_mii_image(f.fc))}" mii-data-fc="${f.fc}"><div class="player-info"><div class="player-name">${f.fc}</div></div><button class="remove-favorite-btn" onclick="event.stopPropagation(); remove_favorite('${f.fc}')">X</button></div>`).join('');
}
function remove_favorite(fc) { FAVORITES = FAVORITES.filter(f => f.fc !== fc); save_persistent_data(); render_favorites_list(); reload_rooms(); }

// Settings
function apply_theme(t) { document.body.classList.remove("theme-dark", "theme-blue"); document.body.classList.add(t === "dark" ? "theme-dark" : "theme-blue"); }
function on_darkmode_change() { const c = el("darkmode-checkbox").checked; localStorage.setItem("mkw_dark", c); apply_theme(c ? "dark" : "blue"); }
function on_checkbox(){ const s = el("timeout-checkbox").checked; localStorage.setItem("mkw_auto", s); if(RELOAD_TIMER) clearInterval(RELOAD_TIMER); if(s) RELOAD_TIMER = setInterval(fetch_data, RELOAD_TIME); }
function on_private_checkbox() { localStorage.setItem("mkw_show_friend", el("private-checkbox").checked); reload_rooms(); }
function on_header_stats_change() { localStorage.setItem("mkw_header", el("header-stats-checkbox").checked); reload_rooms(); }
function on_sort_order_change() { localStorage.setItem("mkw_sort", el("sort-order-select").value); reload_rooms(); }
function on_openhost_checkbox() { localStorage.setItem("mkw_openhost", el("openhost-checkbox").checked); reload_rooms(); }
function set_view_mode(m) { CURRENT_VIEW_MODE = m; localStorage.setItem("mkw_view", m); apply_view_styling(); }
function apply_view_styling() { 
    document.body.classList.toggle('desktop-view', CURRENT_VIEW_MODE === 'desktop');
    el('view-mode-mobile-btn').classList.toggle('active', CURRENT_VIEW_MODE === 'mobile');
    el('view-mode-desktop-btn').classList.toggle('active', CURRENT_VIEW_MODE === 'desktop');
}

// Fetching
async function fetch_data() {
    try {
        const [gRes, jRes] = await Promise.all([fetch(API_GROUPS), fetch(API_JSON)]);
        const groups = await gRes.json();
        const json = await jRes.json();
        all_players = json.mariokartwii || [];
        const deluxeRegions = ["760", "866", "205"];
        cur_rooms = Array.isArray(groups) ? groups.filter(g => g.rk && deluxeRegions.some(r => g.rk.includes(r))) : [];
        reload_rooms();
    } catch(e) { el("loading").textContent = "Error loading NewWFC data."; }
}

function reload_rooms() {
    const rc = el("rooms-container"); rc.innerHTML = "";
    const showFriend = el("private-checkbox").checked;
    const userFc = USER_PROFILE?.fc;
    const favFcs = FAVORITES.map(f => f.fc);

    let visibleRooms = cur_rooms.filter(r => {
        if (r.type === "anybody") return true;
        const pKeys = Object.keys(r.players);
        const hasSpecial = pKeys.some(k => r.players[k].fc === userFc || favFcs.includes(r.players[k].fc));
        return showFriend || hasSpecial;
    });

    const sort = el("sort-order-select").value;
    visibleRooms.sort((a, b) => {
        const ca = Object.keys(a.players).length, cb = Object.keys(b.players).length;
        return sort === "player_count" ? cb - ca : new Date(a.created) - new Date(b.created);
    });

    let totalPlayers = 0;
    visibleRooms.forEach(room => {
        totalPlayers += Object.keys(room.players).length;
        render_room_card(room, rc);
    });

    render_online_pseudo_room(rc);

    const showHeader = el("header-stats-checkbox").checked;
    el("header-stats").classList.toggle("hidden", !showHeader);
    el("header-stats-content").innerHTML = `<span class="excited">${visibleRooms.length}</span> Rooms • <span class="excited">${totalPlayers}</span> Players`;
    el("loading").style.display = "none";
}

function render_room_card(room, container) {
    const pKeys = Object.keys(room.players);
    const mode = (room.rk && room.rk.startsWith("vs")) ? "🏁 Global VS Room" : "🎈 Global Battle Room";
    const headerText = room.type === "anybody" ? `🌎 | ${mode}` : "🔒 | 👥 Friend Room";
    
    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `<div class="room-card-header"><span class="room-name">${headerText}</span></div><div class="room-details"><span class="${room.suspend ? 'course-selection' : 'joinable'}">${room.suspend ? '🗺️ Voting' : '✅ Joinable'}</span> • <span class="room-player-count excited">${pKeys.length}</span> Players</div><div class="player-list"></div><div class="room-card-footer">ID: ${room.id}</div>`;
    
    const list = card.querySelector(".player-list");
    pKeys.forEach(k => render_player_row(room.players[k], list));
    container.appendChild(card);
}

function render_player_row(p, container, statusOverride = null) {
    const norm = normalize_player(p);
    const isUser = USER_PROFILE && norm.fc === USER_PROFILE.fc;
    const isFav = FAVORITES.some(f => f.fc === norm.fc);
    
    const row = document.createElement("div");
    row.className = "player-row";
    if (isUser) row.style.borderLeft = "4px solid #00cc66"; else if (isFav) row.style.borderLeft = "4px solid #00aeff";
    
    row.onclick = () => show_player_info_modal(norm.fc);
    row.innerHTML = `<img class="player-mii" src="${format_mii_src(get_cached_mii_image(norm.fc))}" mii-data-fc="${norm.fc}"><div class="player-info"><div class="player-name">${norm.name}</div><div class="player-fc">${norm.fc}</div></div><div class="player-vrbr">${statusOverride || norm.ev + ' VR'}</div>`;
    container.appendChild(row);

    if (norm.mii && !get_cached_mii_image(norm.fc)) fetch_mii_images([norm.mii], norm.fc);
}

function render_online_pseudo_room(container) {
    const inRoomFcs = cur_rooms.flatMap(r => Object.values(r.players).map(p => p.fc));
    const onlineOnly = all_players.filter(p => !inRoomFcs.includes(p.FC));
    if (onlineOnly.length === 0) return;

    const processed = onlineOnly.map(p => {
        const n = normalize_player(p);
        let status = 'online', priority = 2;
        if (n.rk && n.numplayers === "0") { status = '<span class="searching-status">Searching...</span>'; priority = 1; }
        else if (n.mtype === "2" && n.numplayers === "0") { status = '<span class="searching-status">Hosting Friend...</span>'; priority = 1; }
        else if (n.mtype === "3" && n.numplayers === "0") { status = '<span class="searching-status">Joining Friend...</span>'; priority = 1; }
        return { p, status, priority };
    }).sort((a, b) => a.priority - b.priority || a.p['+name'].localeCompare(b.p['+name']));

    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `<div class="room-card-header"><span class="room-name">👤 | Online Players</span></div><div class="room-details"><span class="room-player-count excited">${onlineOnly.length}</span> Players</div><div class="player-list"></div>`;
    
    const list = card.querySelector(".player-list");
    processed.forEach(obj => render_player_row(obj.p, list, obj.status));
    container.appendChild(card);
}

function on_load() {
    el('settings-btn').onclick = toggle_settings_modal;
    el('user-profile-btn').onclick = toggle_user_profile_modal;
    load_persistent_data();
    el("darkmode-checkbox").checked = localStorage.getItem("mkw_dark") === "true";
    apply_theme(el("darkmode-checkbox").checked ? "dark" : "blue");
    el("timeout-checkbox").checked = localStorage.getItem("mkw_auto") !== "false";
    el("private-checkbox").checked = localStorage.getItem("mkw_show_friend") !== "false";
    el("header-stats-checkbox").checked = localStorage.getItem("mkw_header") !== "false";
    el("openhost-checkbox").checked = localStorage.getItem("mkw_openhost") === "true";
    CURRENT_VIEW_MODE = localStorage.getItem("mkw_view") || "mobile";
    apply_view_styling();
    fetch_data();
    on_checkbox();
}
window.onload = on_load;