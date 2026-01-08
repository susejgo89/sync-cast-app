// views/screensView.js

import { db } from '../firebase-config.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, getDocs, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';

// DOM Elements
const addScreenBtn = document.getElementById('add-screen-btn');
const addScreenModal = document.getElementById('add-screen-modal');
const addScreenForm = document.getElementById('add-screen-form');
const newScreenNameInput = document.getElementById('new-screen-name');
const addScreenCancelBtn = document.getElementById('add-screen-cancel');
const pairingCodeModal = document.getElementById('pairing-code-modal');
const pairingCodeDisplay = document.getElementById('pairing-code-display');
const pairingCodeCloseBtn = document.getElementById('pairing-code-close');
const screensListContainer = document.getElementById('screens-list');
const qrContentModal = document.getElementById('qr-content-modal');
const qrContentMediaLibrary = document.getElementById('qr-content-media-library');
const qrContentCancelBtn = document.getElementById('qr-content-cancel');
const qrContentSaveBtn = document.getElementById('qr-content-save');
const scheduleModal = document.getElementById('schedule-modal');
const scheduleModalCloseBtn = document.getElementById('schedule-modal-close');
const addScheduleRuleForm = document.getElementById('add-schedule-rule-form');
const scheduleRulesListEl = document.getElementById('schedule-rules-list');

// State
let currentUserId = null;
let listenersAttached = false;
let allUserMedia = [];
let allVisualPlaylists = [];
let allMusicPlaylists = [];
let setCurrentQrId = () => {};
let currentScreenForSchedule = null;

function generateScheduleSummary(rules, type, allPlaylists, lang) {
    if (!rules || rules.length === 0) {
        return `<p class="text-xs text-center text-gray-400 p-2">${translations[lang].scheduleNoRules || 'No hay reglas de horario.'}</p>`;
    }

    const daysOfWeek = (lang === 'es') ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return rules.map(rule => {
        const playlistId = type === 'visual' ? rule.playlistId : rule.musicPlaylistId;
        const playlist = allPlaylists.find(p => p.id === playlistId);
        const daysStr = rule.days.map(d => daysOfWeek[d % 7]).join(', ');

        let content = `<p class="font-semibold truncate">${playlist ? playlist.name : (translations[lang].playlistDeleted || 'Playlist eliminada')}</p>`;
        if (type === 'music' && playlist) {
            content = `<p class="font-semibold truncate">🎵 ${playlist.name}</p>`;
        }

        return `<div class="text-xs p-2 bg-gray-100 rounded-md border">
                    ${content}
                    <p class="text-gray-500">${daysStr} | ${rule.startTime} - ${rule.endTime}</p>
                </div>`;
    }).join('');
}

function renderScreens(screens, visualPlaylists, musicPlaylists, currentLang, userMedia, groups) {
    allUserMedia = userMedia;
    allVisualPlaylists = visualPlaylists;
    allMusicPlaylists = musicPlaylists;
    screensListContainer.innerHTML = screens.length === 0 ? `<p class="text-gray-500 col-span-full text-center">No hay pantallas registradas.</p>` : '';
    screens.forEach(screen => {
        const visualOptions = visualPlaylists.map(p => `<option value="${p.id}" ${screen.playlistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        const musicOptions = musicPlaylists.map(p => `<option value="${p.id}" ${screen.musicPlaylistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

        // --- LÓGICA DE ESTADO ONLINE/OFFLINE ---
        const lastSeen = screen.lastSeen?.toDate();
        const now = new Date();
        // Consideramos online si el último latido fue hace menos de 2.5 minutos (150 segundos) para dar un margen.
        const isOnline = lastSeen && (now.getTime() - lastSeen.getTime()) / 1000 < 150;

        // Modos de programación independientes
        const isVisualAdvanced = screen.visualSchedulingMode === 'advanced';
        const isMusicAdvanced = screen.musicSchedulingMode === 'advanced';

        const card = document.createElement('div');
        card.className = 'card card-glass p-0 flex flex-col overflow-hidden group transition-all duration-300 hover:shadow-xl';
        
        // --- HEADER SECTION ---
        const headerHtml = `
            <div class="p-5 border-b border-white/20 bg-white/30 relative">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            </div>
                            <div class="absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold text-gray-800 leading-tight">${screen.name}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">${translations[currentLang].code}:</span>
                                <span class="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">${screen.isPaired ? `✅ ${translations[currentLang].paired || 'Enlazada'}` : screen.pairingCode}</span>
                            </div>
                        </div>
                    </div>
                    <button data-screen-id="${screen.id}" class="delete-screen-btn text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;

        // --- CONTENT SECTION (PLAYLISTS) ---
        const contentHtml = `
            <div class="p-5 space-y-5 bg-white/40">
                <h5 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Contenido
                </h5>
                
                <!-- Visual Playlist -->
                <div class="bg-white/60 rounded-lg p-3 border border-white/50 shadow-sm">
                    <div class="flex justify-between items-center mb-2">
                        <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-400"></span> ${translations[currentLang].visualPlaylist}
                        </label>
                        <div class="flex bg-gray-100 rounded p-0.5">
                            <button class="px-2 py-0.5 text-[10px] font-medium rounded ${!isVisualAdvanced ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} scheduling-mode-btn" data-mode="simple" data-type="visual" data-screen-id="${screen.id}">${translations[currentLang].simpleMode}</button>
                            <button class="px-2 py-0.5 text-[10px] font-medium rounded ${isVisualAdvanced ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} scheduling-mode-btn" data-mode="advanced" data-type="visual" data-screen-id="${screen.id}">${translations[currentLang].advancedMode}</button>
                        </div>
                    </div>
                    
                    <div class="simple-schedule-container ${isVisualAdvanced ? 'hidden' : ''}" data-type="visual">
                        <select data-screen-id="${screen.id}" class="playlist-select custom-select text-sm w-full bg-transparent border-gray-200 focus:bg-white transition-colors">
                            <option value="">${translations[currentLang].none}</option>
                            ${visualOptions}
                        </select>
                    </div>
                    <div class="advanced-schedule-container ${!isVisualAdvanced ? 'hidden' : ''}" data-type="visual">
                        <div class="schedule-summary-list space-y-1 mb-2 max-h-20 overflow-y-auto text-xs">
                            ${generateScheduleSummary(screen.visualScheduleRules, 'visual', visualPlaylists, currentLang)}
                        </div>
                        <button data-screen-id="${screen.id}" data-type="visual" class="manage-schedule-btn w-full py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded transition-colors">${translations[currentLang].manageSchedule}</button>
                    </div>
                </div>

                <!-- Music Playlist -->
                <div class="bg-white/60 rounded-lg p-3 border border-white/50 shadow-sm">
                    <div class="flex justify-between items-center mb-2">
                        <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-pink-400"></span> ${translations[currentLang].musicPlaylist}
                        </label>
                        <div class="flex bg-gray-100 rounded p-0.5">
                            <button class="px-2 py-0.5 text-[10px] font-medium rounded ${!isMusicAdvanced ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} scheduling-mode-btn" data-mode="simple" data-type="music" data-screen-id="${screen.id}">${translations[currentLang].simpleMode}</button>
                            <button class="px-2 py-0.5 text-[10px] font-medium rounded ${isMusicAdvanced ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'} scheduling-mode-btn" data-mode="advanced" data-type="music" data-screen-id="${screen.id}">${translations[currentLang].advancedMode}</button>
                        </div>
                    </div>

                    <div class="simple-schedule-container ${isMusicAdvanced ? 'hidden' : ''}" data-type="music">
                        <select data-screen-id="${screen.id}" class="music-playlist-select custom-select text-sm w-full bg-transparent border-gray-200 focus:bg-white transition-colors">
                            <option value="">${translations[currentLang].none}</option>
                            ${musicOptions}
                        </select>
                    </div>
                    <div class="advanced-schedule-container ${!isMusicAdvanced ? 'hidden' : ''}" data-type="music">
                        <div class="schedule-summary-list space-y-1 mb-2 max-h-20 overflow-y-auto text-xs">
                             ${generateScheduleSummary(screen.musicScheduleRules, 'music', musicPlaylists, currentLang)}
                        </div>
                        <button data-screen-id="${screen.id}" data-type="music" class="manage-schedule-btn w-full py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded transition-colors">${translations[currentLang].manageSchedule}</button>
                    </div>
                </div>
            </div>
        `;

        // --- WIDGETS SECTION ---
        const widgetsHtml = `
            <div class="p-5 bg-white/20 border-t border-white/20 flex-grow">
                <h5 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    Widgets
                </h5>
                <div class="space-y-3">
                    <!-- Clock -->
                    <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="p-1.5 bg-indigo-100 text-indigo-600 rounded-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                            <span class="text-sm font-medium text-gray-700">${translations[currentLang].showClock}</span>
                        </div>
                        <label class="toggle-switch scale-75 origin-right">
                            <input type="checkbox" id="clock-toggle-${screen.id}" data-screen-id="${screen.id}" class="clock-toggle-checkbox" ${screen.showClock ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Weather -->
                    <div class="group">
                        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="p-1.5 bg-sky-100 text-sky-600 rounded-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg></div>
                                <span class="text-sm font-medium text-gray-700">${translations[currentLang].showWeather}</span>
                            </div>
                            <label class="toggle-switch scale-75 origin-right">
                                <input type="checkbox" id="weather-toggle-${screen.id}" data-screen-id="${screen.id}" class="weather-toggle-checkbox" ${screen.showWeather ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="${screen.showWeather ? 'block' : 'hidden'} px-2 pb-2 pt-1 animate-fadeIn">
                            <input type="text" id="weather-location-${screen.id}" data-screen-id="${screen.id}" class="weather-location-input w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none transition-all" value="${screen.weatherLocation || ''}" placeholder="${translations[currentLang].weatherLocationPlaceholder}">
                        </div>
                    </div>

                    <!-- News -->
                    <div class="group">
                        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="p-1.5 bg-orange-100 text-orange-600 rounded-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg></div>
                                <span class="text-sm font-medium text-gray-700">${translations[currentLang].showNews}</span>
                            </div>
                            <label class="toggle-switch scale-75 origin-right">
                                <input type="checkbox" id="news-toggle-${screen.id}" data-screen-id="${screen.id}" class="news-toggle-checkbox" ${screen.showNews ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="${screen.showNews ? 'block' : 'hidden'} px-2 pb-2 pt-1 space-y-2 animate-fadeIn">
                            <input type="url" id="news-rss-url-${screen.id}" data-screen-id="${screen.id}" class="news-rss-url-input w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none transition-all" value="${screen.newsRssUrl || ''}" placeholder="${translations[currentLang].rssFeedUrlPlaceholder}">
                            <div class="flex gap-2">
                                <input type="number" id="news-limit-${screen.id}" data-screen-id="${screen.id}" class="news-limit-input w-1/2 text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none" value="${screen.newsLimit || 5}" min="1" max="20" placeholder="Limit">
                                <input type="number" id="news-speed-${screen.id}" data-screen-id="${screen.id}" class="news-speed-input w-1/2 text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none" value="${screen.newsSpeed || 7}" min="3" max="60" placeholder="Speed (s)">
                            </div>
                        </div>
                    </div>

                    <!-- Currency -->
                    <div class="group">
                        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="p-1.5 bg-emerald-100 text-emerald-600 rounded-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                                <span class="text-sm font-medium text-gray-700">${translations[currentLang].showCurrency}</span>
                            </div>
                            <label class="toggle-switch scale-75 origin-right">
                                <input type="checkbox" id="currency-toggle-${screen.id}" data-screen-id="${screen.id}" class="currency-toggle-checkbox" ${screen.showCurrency ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="${screen.showCurrency ? 'block' : 'hidden'} px-2 pb-2 pt-1 animate-fadeIn">
                            <select id="currency-country-${screen.id}" data-screen-id="${screen.id}" class="currency-country-select w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
                                <option value="PY" ${screen.currencyCountry === 'PY' ? 'selected' : ''}>Paraguay (PYG)</option>
                                <option value="AR" ${screen.currencyCountry === 'AR' ? 'selected' : ''}>Argentina (ARS)</option>
                                <option value="BR" ${screen.currencyCountry === 'BR' ? 'selected' : ''}>Brasil (BRL)</option>
                                <option value="US" ${screen.currencyCountry === 'US' ? 'selected' : ''}>Estados Unidos (USD)</option>
                                <option value="UY" ${screen.currencyCountry === 'UY' ? 'selected' : ''}>Uruguay (UYU)</option>
                                <option value="CL" ${screen.currencyCountry === 'CL' ? 'selected' : ''}>Chile (CLP)</option>
                                <option value="CO" ${screen.currencyCountry === 'CO' ? 'selected' : ''}>Colombia (COP)</option>
                                <option value="VE" ${screen.currencyCountry === 'VE' ? 'selected' : ''}>Venezuela (VES)</option>
                                <option value="MX" ${screen.currencyCountry === 'MX' ? 'selected' : ''}>México (MXN)</option>
                                <option value="PE" ${screen.currencyCountry === 'PE' ? 'selected' : ''}>Perú (PEN)</option>
                                <option value="BO" ${screen.currencyCountry === 'BO' ? 'selected' : ''}>Bolivia (BOB)</option>
                            </select>
                        </div>
                    </div>

                    <!-- QR Code -->
                    <div class="group">
                        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="p-1.5 bg-gray-100 text-gray-600 rounded-md"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg></div>
                                <span class="text-sm font-medium text-gray-700">${translations[currentLang].showQrOnScreen}</span>
                            </div>
                            <label class="toggle-switch scale-75 origin-right">
                                <input type="checkbox" id="show-qr-toggle-${screen.id}" data-screen-id="${screen.id}" class="show-qr-toggle-checkbox" ${screen.showQrOnPlayer ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="${screen.showQrOnPlayer ? 'block' : 'hidden'} px-2 pb-2 pt-1 space-y-2 animate-fadeIn">
                            <input type="text" id="qr-text-${screen.id}" data-screen-id="${screen.id}" class="qr-text-input w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white/80 focus:bg-white focus:ring-1 focus:ring-gray-500 outline-none transition-all" value="${screen.qrCodeText || ''}" placeholder="${translations[currentLang].qrTextPlaceholder}">
                            <button data-screen-id="${screen.id}" class="select-qr-content-btn w-full py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors">${translations[currentLang].selectQrContent}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = headerHtml + contentHtml + widgetsHtml;
        screensListContainer.appendChild(card);

    });
}

function loadScreens(userId, visualPlaylists, musicPlaylists, currentLang, userMedia, onUpdate, groups) {
    const q = query(collection(db, 'screens'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const screens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ahora pasamos todos los parámetros a la función que dibuja
        renderScreens(screens, visualPlaylists, musicPlaylists, currentLang, userMedia, groups);
        onUpdate(screens); // Notificamos al script principal sobre los cambios
    });
}

export function initScreensView(userId, getPlaylists, getMusicPlaylists, getLang, getMedia, onUpdateCallback, getGroups, setQrIdCallback) {
    currentUserId = userId;

    if (!listenersAttached) {
        addScreenBtn.addEventListener('click', () => {
            addScreenModal.classList.add('active');
        });

        addScreenCancelBtn.addEventListener('click', () => addScreenModal.classList.remove('active'));
        pairingCodeCloseBtn.addEventListener('click', () => pairingCodeModal.classList.remove('active'));
        scheduleModalCloseBtn.addEventListener('click', () => scheduleModal.classList.remove('active'));

        addScreenForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const lang = getLang(); // Obtiene el idioma actual
                const userDocRef = doc(db, 'users', currentUserId); // Usa el currentUserId que ya tenemos
                let userDocSnap = await getDoc(userDocRef);
        
                if (!userDocSnap.exists()) {
                    const auth = getAuth();
                    const user = auth.currentUser; // Obtiene el usuario autenticado
                    await setDoc(userDocRef, {
                        email: user.email,
                        createdAt: serverTimestamp(),
                        screenLimit: 3
                    });
                    userDocSnap = await getDoc(userDocRef); // Re-fetch after creation
                }
                const screenLimit = userDocSnap.data()?.screenLimit || 3;
        
                const screensQuery = query(collection(db, 'screens'), where('userId', '==', currentUserId));
                const screensSnapshot = await getDocs(screensQuery);
                const currentScreenCount = screensSnapshot.size;
        
                if (currentScreenCount >= screenLimit) {
                    const limitMsg = translations[lang].screenLimitReached.replace('{limit}', screenLimit);
                    const updateMsg = translations[lang].updatePlanPrompt;
                    alert(`${limitMsg}\n${updateMsg}`);
                    return;
                }
        
                const screenName = newScreenNameInput.value.trim();
                if (!screenName) return;
        
                const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                await addDoc(collection(db, 'screens'), {
                    userId: currentUserId,
                    name: screenName,
                    pairingCode: pairingCode,
                    qrEnabled: false,
                    qrCodeItems: [],
                    playlistId: null,
                    visualSchedulingMode: 'simple',
                    visualScheduleRules: [],
                    musicSchedulingMode: 'simple',
                    musicScheduleRules: [],
                    lastScheduledAt: null,
                    isPaired: false,
                    createdAt: serverTimestamp()
                });
        
                newScreenNameInput.value = '';
                addScreenModal.classList.remove('active');
                pairingCodeDisplay.textContent = pairingCode;
                pairingCodeModal.classList.add('active');
        
            } catch (error) {
                console.error("Error al añadir pantalla:", error);
                alert(translations[getLang()].errorAddingScreen);
            }
        });

        qrContentCancelBtn.addEventListener('click', () => qrContentModal.classList.remove('active'));

        addScheduleRuleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentScreenForSchedule) return;
            const scheduleType = currentScreenForSchedule.type;

            const playlistId = scheduleType === 'visual' ? document.getElementById('rule-playlist-select').value : null;
            const musicPlaylistId = scheduleType === 'music' ? document.getElementById('rule-music-playlist-select').value : null;
            const startTime = document.getElementById('rule-start-time').value;
            const endTime = document.getElementById('rule-end-time').value;
            const days = Array.from(document.querySelectorAll('#rule-days-checkboxes input:checked')).map(cb => parseInt(cb.value));

            if (!playlistId && !musicPlaylistId) {
                alert(translations[getLang()].scheduleCompleteFields);
                return;
            }

            const newRule = { playlistId, musicPlaylistId, days, startTime, endTime };
            const fieldToUpdate = scheduleType === 'visual' ? 'visualScheduleRules' : 'musicScheduleRules';
            const screenRef = doc(db, 'screens', currentScreenForSchedule.id);            
            await updateDoc(screenRef, { [fieldToUpdate]: arrayUnion(newRule), lastScheduledAt: serverTimestamp() });

            addScheduleRuleForm.reset();
        });

        scheduleRulesListEl.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-rule-btn');
            if (deleteBtn && currentScreenForSchedule) {
                const scheduleType = currentScreenForSchedule.type;
                const ruleIndex = parseInt(deleteBtn.dataset.index);
                const screenRef = doc(db, 'screens', currentScreenForSchedule.id);
                const screenSnap = await getDoc(screenRef);
                if (screenSnap.exists()) {
                    const fieldName = scheduleType === 'visual' ? 'visualScheduleRules' : 'musicScheduleRules';
                    const rules = screenSnap.data()[fieldName] || [];
                    const ruleToDelete = rules[ruleIndex];
                    if (ruleToDelete) {
                        await updateDoc(screenRef, { [fieldName]: arrayRemove(ruleToDelete), lastScheduledAt: serverTimestamp() });
                    }
                }
            }
        });

        screensListContainer.addEventListener('click', async (e) => {
            const manageBtn = e.target.closest('.manage-schedule-btn');
            if (manageBtn) {
                const screenId = manageBtn.dataset.screenId;
                const scheduleType = manageBtn.dataset.type; // 'visual' or 'music'
                currentScreenForSchedule = { id: screenId, type: scheduleType };

                const playlistSelect = document.getElementById('rule-playlist-select');
                const musicPlaylistSelect = document.getElementById('rule-music-playlist-select');

                if (scheduleType === 'visual') {
                    playlistSelect.innerHTML = allVisualPlaylists.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
                    playlistSelect.parentElement.style.display = 'block';
                    musicPlaylistSelect.parentElement.style.display = 'none';
                } else { // music
                    musicPlaylistSelect.innerHTML = allMusicPlaylists.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
                    playlistSelect.parentElement.style.display = 'none';
                    musicPlaylistSelect.parentElement.style.display = 'block';
                }

                // Populate days checkboxes
                const daysContainer = document.getElementById('rule-days-checkboxes');
                const lang = getLang();
                const daysOfWeek = (lang === 'es') ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                daysContainer.innerHTML = daysOfWeek.map((day, index) => `
                    <label class="flex items-center"><input type="checkbox" value="${index + 1}" class="h-4 w-4 rounded border-gray-300"> <span class="ml-2">${day}</span></label>
                `).join('');

                // Render existing rules
                const screenRef = doc(db, 'screens', screenId);
                const screenSnap = await getDoc(screenRef);
                if (screenSnap.exists()) {
                    const fieldName = scheduleType === 'visual' ? 'visualScheduleRules' : 'musicScheduleRules';
                    renderScheduleRules(screenSnap.data()[fieldName] || [], scheduleType);
                }

                scheduleModal.classList.add('active');
            }
        });

        screensListContainer.addEventListener('click', async (e) => {
            const selectBtn = e.target.closest('.select-qr-content-btn');
            if (selectBtn) {
                const screenId = selectBtn.dataset.screenId;
                setCurrentQrId(screenId); // Notificamos al script principal el ID de la pantalla

                const screenRef = doc(db, 'screens', screenId);
                const screenSnap = await getDoc(screenRef);
                const existingIds = screenSnap.data()?.qrCodeItems || [];

                const visualMedia = allUserMedia.filter(media => !media.type.startsWith('audio/'));
                qrContentMediaLibrary.innerHTML = '';
                visualMedia.forEach(media => {
                    const isVideo = media.type.startsWith('video');
                    const isSelected = existingIds.includes(media.id);
                    const card = document.createElement('div');
                    // Usamos la misma clase que en el otro modal de QR para reutilizar los estilos
                    card.className = `qr-media-card-selectable relative rounded-lg overflow-hidden shadow-sm cursor-pointer border-2 border-transparent ${isSelected ? 'selected' : ''}`;

                    // CORRECCIÓN 2: Usar <video> para miniaturas de video, <img> para imágenes.
                    const thumbElement = isVideo
                        ? `<video src="${media.url}#t=0.5" class="w-full h-32 object-cover pointer-events-none" muted playsinline></video>`
                        : `<img src="${media.url}" class="w-full h-32 object-cover pointer-events-none">`;

                    card.innerHTML = `
                        ${thumbElement}
                        <div class="absolute inset-0 bg-black bg-opacity-0 transition-all duration-200 flex items-center justify-center check-overlay">
                            <svg class="w-10 h-10 text-white opacity-0 scale-75 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <input type="checkbox" data-media-id="${media.id}" class="hidden" ${isSelected ? 'checked' : ''}>
                    `;
                    // CORRECCIÓN 1: La lógica de selección ya existe en script.js, solo necesitamos la estructura correcta.
                    // El listener principal en script.js se encargará del toggle.
                    qrContentMediaLibrary.appendChild(card);
                });
                qrContentModal.classList.add('active');
            }
        });

        screensListContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-screen-btn');
            if (deleteBtn) {
                const screenId = deleteBtn.dataset.screenId;
                showConfirmModal('Eliminar Pantalla', '¿Seguro que quieres eliminar esta pantalla?', () => {
                    deleteDoc(doc(db, 'screens', screenId));
                });
            }

            // Listener para los botones de modo de programación (Simple/Avanzado)
            const modeBtn = e.target.closest('.scheduling-mode-btn');
            if (modeBtn) {
                const screenId = modeBtn.dataset.screenId;
                const type = modeBtn.dataset.type;
                const mode = modeBtn.dataset.mode;
                updateDoc(doc(db, 'screens', screenId), { [`${type}SchedulingMode`]: mode, lastScheduledAt: serverTimestamp() });
            }
        });

        screensListContainer.addEventListener('change', (e) => {
            const screenId = e.target.dataset.screenId;
            if (!screenId) return; // Si el elemento no tiene un ID de pantalla, no hacemos nada.
            const screenRef = doc(db, 'screens', screenId);
            
            // Si se cambió el menú de playlist visual
            if (e.target.classList.contains('playlist-select')) {
                const playlistId = e.target.value || null;
                updateDoc(screenRef, { playlistId, lastScheduledAt: serverTimestamp() });
            }

            // Si se cambió el modo de programación
            if (e.target.classList.contains('scheduling-mode-radio')) {
                const type = e.target.dataset.type;
                const mode = e.target.value;
                updateDoc(screenRef, { [`${type}SchedulingMode`]: mode, lastScheduledAt: serverTimestamp() });
            }
        
            // Si se cambió el menú de playlist de música
            if (e.target.classList.contains('music-playlist-select')) {
                const musicPlaylistId = e.target.value || null;
                updateDoc(screenRef, { musicPlaylistId, lastScheduledAt: serverTimestamp() });
            }

            // Si se cambió el toggle del reloj
            if (e.target.classList.contains('clock-toggle-checkbox')) {
                updateDoc(screenRef, { showClock: e.target.checked });
            }

            // Si se cambió el toggle del clima
            if (e.target.classList.contains('weather-toggle-checkbox')) {
                updateDoc(screenRef, { showWeather: e.target.checked });
            }

            // Si se cambió el toggle de noticias
            if (e.target.classList.contains('news-toggle-checkbox')) {
                updateDoc(screenRef, { showNews: e.target.checked });
            }

            // Si se cambió la URL del RSS (al perder el foco)
            if (e.target.classList.contains('news-rss-url-input')) {
                updateDoc(screenRef, { newsRssUrl: e.target.value.trim() });
            }

            // Si se cambió el toggle de "Mostrar QR en Pantalla"
            if (e.target.classList.contains('show-qr-toggle-checkbox')) {
                const isEnabled = e.target.checked;
                updateDoc(screenRef, { showQrOnPlayer: isEnabled, qrEnabled: isEnabled });
            }

            // Si se cambió el límite de noticias
            if (e.target.classList.contains('news-limit-input')) {
                updateDoc(screenRef, { newsLimit: Number(e.target.value) });
            }

            // Si se cambió la velocidad de las noticias
            if (e.target.classList.contains('news-speed-input')) {
                updateDoc(screenRef, { newsSpeed: Number(e.target.value) });
            }

            // Si se cambió el toggle de cotizaciones
            if (e.target.classList.contains('currency-toggle-checkbox')) {
                updateDoc(screenRef, { showCurrency: e.target.checked });
            }

            // Si se cambió el país de referencia
            if (e.target.classList.contains('currency-country-select')) {
                updateDoc(screenRef, { currencyCountry: e.target.value });
            }
        });

        // Usamos 'blur' para los inputs de texto, es más fiable que 'change'.
        screensListContainer.addEventListener('blur', (e) => {
            const screenId = e.target.dataset.screenId;
            if (!screenId) return;
            const screenRef = doc(db, 'screens', screenId);
            if (e.target.classList.contains('weather-location-input')) {
                updateDoc(screenRef, { weatherLocation: e.target.value.trim() });
            }
            if (e.target.classList.contains('qr-text-input')) {
                updateDoc(screenRef, { qrCodeText: e.target.value.trim() });
            }
        }, true); // El 'true' es importante para que el evento se capture correctamente.

        listenersAttached = true;
    }

    function renderScheduleRules(rules, type) {
        const lang = getLang();
        const daysOfWeek = (lang === 'es') ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        scheduleRulesListEl.innerHTML = rules.length === 0 ? `<p class="text-gray-500 text-center">No hay reglas de horario.</p>` : '';
        rules.forEach((rule, index) => {
            const playlistId = type === 'visual' ? rule.playlistId : rule.musicPlaylistId;
            const playlistList = type === 'visual' ? allVisualPlaylists : allMusicPlaylists;
            const playlist = playlistList.find(p => p.id === playlistId);
            const daysStr = rule.days.map(d => daysOfWeek[d % 7]).join(', ');
            const ruleEl = document.createElement('div');
            ruleEl.className = 'bg-white p-3 rounded-md border flex justify-between items-center';
            
            const playlistName = playlist ? playlist.name : (translations[lang].playlistDeleted || 'Playlist eliminada');

            ruleEl.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold">${type === 'music' ? '🎵 ' : ''}${playlistName}</p>
                    <p class="text-sm text-gray-600">${daysStr}</p>
                    <p class="text-sm text-gray-600">${rule.startTime} - ${rule.endTime}</p>
                </div>
                <button data-index="${index}" class="delete-rule-btn text-red-500 hover:text-red-700 p-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            `;
            scheduleRulesListEl.appendChild(ruleEl);
        });
    }

    let unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang(), getMedia(), onUpdateCallback, getGroups());

    setCurrentQrId = setQrIdCallback;
    return {
        unsubscribe: () => unsubscribe(),
        rerender: () => {
            unsubscribe();
            unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang(), getMedia(), onUpdateCallback, getGroups());
        }
    };
}