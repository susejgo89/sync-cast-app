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
        card.className = 'card p-5 flex flex-col';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xl font-bold text-gray-800">${screen.name}</h4>
                    <p class="text-sm text-gray-500 mt-1"><span data-lang="code">${translations[currentLang].code}</span>: <span class="font-mono bg-gray-200 px-2 py-1 rounded">${screen.isPaired ? `✅ ${translations[currentLang].paired || 'Enlazada'}` : screen.pairingCode}</span></p>
                </div>
                <button data-screen-id="${screen.id}" class="delete-screen-btn text-gray-400 hover:text-red-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
            <div class="mt-3 flex items-center space-x-2">
                <div class="status-dot ${isOnline ? 'status-dot-online animate-pulse' : 'status-dot-offline'}"></div>
                <span class="text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}">
                    ${isOnline ? (translations[currentLang].online || 'Online') : (translations[currentLang].offline || 'Offline')}
                </span>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <!-- SECCIÓN PLAYLIST VISUAL -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">${translations[currentLang].visualPlaylist}</label>
                    <div class="flex items-center gap-4 mb-2">
                        <label class="flex items-center text-xs"><input type="radio" name="visual-scheduling-mode-${screen.id}" value="simple" class="scheduling-mode-radio" data-screen-id="${screen.id}" data-type="visual" ${!isVisualAdvanced ? 'checked' : ''}> <span class="ml-1">${translations[currentLang].simpleMode}</span></label>
                        <label class="flex items-center text-xs"><input type="radio" name="visual-scheduling-mode-${screen.id}" value="advanced" class="scheduling-mode-radio" data-screen-id="${screen.id}" data-type="visual" ${isVisualAdvanced ? 'checked' : ''}> <span class="ml-1">${translations[currentLang].advancedMode}</span></label>
                    </div>
                    <div class="simple-schedule-container ${isVisualAdvanced ? 'hidden' : ''}" data-type="visual">
                        <select data-screen-id="${screen.id}" class="playlist-select custom-select">
                            <option value="">${translations[currentLang].none}</option>
                            ${visualOptions}
                        </select>
                    </div>
                    <div class="advanced-schedule-container ${!isVisualAdvanced ? 'hidden' : ''}" data-type="visual">
                        <div class="schedule-summary-list space-y-2 mb-2 max-h-24 overflow-y-auto pr-1">
                            ${generateScheduleSummary(screen.visualScheduleRules, 'visual', visualPlaylists, currentLang)}
                        </div>
                        <button data-screen-id="${screen.id}" data-type="visual" class="manage-schedule-btn w-full btn-secondary text-sm">${translations[currentLang].manageSchedule}</button>
                    </div>
                </div>

                <!-- SECCIÓN PLAYLIST DE MÚSICA -->
                <div class="pt-4 border-t border-gray-100">
                    <label class="block text-sm font-medium text-gray-700 mb-2">${translations[currentLang].musicPlaylist}</label>
                     <div class="flex items-center gap-4 mb-2">
                        <label class="flex items-center text-xs"><input type="radio" name="music-scheduling-mode-${screen.id}" value="simple" class="scheduling-mode-radio" data-screen-id="${screen.id}" data-type="music" ${!isMusicAdvanced ? 'checked' : ''}> <span class="ml-1">${translations[currentLang].simpleMode}</span></label>
                        <label class="flex items-center text-xs"><input type="radio" name="music-scheduling-mode-${screen.id}" value="advanced" class="scheduling-mode-radio" data-screen-id="${screen.id}" data-type="music" ${isMusicAdvanced ? 'checked' : ''}> <span class="ml-1">${translations[currentLang].advancedMode}</span></label>
                    </div>
                    <div class="simple-schedule-container ${isMusicAdvanced ? 'hidden' : ''}" data-type="music">
                    <select data-screen-id="${screen.id}" class="music-playlist-select custom-select mt-1">
                        <option value="">${translations[currentLang].none}</option>
                        ${musicOptions}
                    </select>
                    </div>
                    <div class="advanced-schedule-container ${!isMusicAdvanced ? 'hidden' : ''}" data-type="music">
                        <div class="schedule-summary-list space-y-2 mb-2 max-h-24 overflow-y-auto pr-1">
                             ${generateScheduleSummary(screen.musicScheduleRules, 'music', musicPlaylists, currentLang)}
                        </div>
                        <button data-screen-id="${screen.id}" data-type="music" class="manage-schedule-btn w-full btn-secondary text-sm">${translations[currentLang].manageSchedule}</button>
                    </div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between">
                    <label for="clock-toggle-${screen.id}" class="block text-sm font-medium text-gray-700 cursor-pointer">${translations[currentLang].showClock}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="clock-toggle-${screen.id}" data-screen-id="${screen.id}" class="clock-toggle-checkbox" ${screen.showClock ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between mb-2">
                    <label for="weather-toggle-${screen.id}" class="block text-sm font-medium text-gray-700 cursor-pointer">${translations[currentLang].showWeather}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="weather-toggle-${screen.id}" data-screen-id="${screen.id}" class="weather-toggle-checkbox" ${screen.showWeather ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="${screen.showWeather ? '' : 'hidden'}">
                    <label for="weather-location-${screen.id}" class="block text-sm font-medium text-gray-700 sr-only">${translations[currentLang].weatherLocation}</label>
                    <input type="text" id="weather-location-${screen.id}" data-screen-id="${screen.id}" class="weather-location-input custom-select" value="${screen.weatherLocation || ''}" placeholder="${translations[currentLang].weatherLocationPlaceholder}">
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between mb-2">
                    <label for="news-toggle-${screen.id}" class="block text-sm font-medium text-gray-700 cursor-pointer">${translations[currentLang].showNews}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="news-toggle-${screen.id}" data-screen-id="${screen.id}" class="news-toggle-checkbox" ${screen.showNews ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="space-y-2 ${screen.showNews ? '' : 'hidden'}">
                    <div>
                        <label for="news-rss-url-${screen.id}" class="block text-sm font-medium text-gray-700 sr-only">${translations[currentLang].rssFeedUrl}</label>
                        <input type="url" id="news-rss-url-${screen.id}" data-screen-id="${screen.id}" class="news-rss-url-input custom-select" value="${screen.newsRssUrl || ''}" placeholder="${translations[currentLang].rssFeedUrlPlaceholder}">
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="flex-1">
                            <label for="news-limit-${screen.id}" class="block text-xs font-medium text-gray-500">${translations[currentLang].newsLimit}</label>
                            <input type="number" id="news-limit-${screen.id}" data-screen-id="${screen.id}" class="news-limit-input custom-select mt-1" value="${screen.newsLimit || 5}" min="1" max="20">
                        </div>
                        <div class="flex-1">
                            <label for="news-speed-${screen.id}" class="block text-xs font-medium text-gray-500">${translations[currentLang].newsSpeed}</label>
                            <input type="number" id="news-speed-${screen.id}" data-screen-id="${screen.id}" class="news-speed-input custom-select mt-1" value="${screen.newsSpeed || 7}" min="3" max="60">
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between">
                    <label for="show-qr-toggle-${screen.id}" class="block text-sm font-medium text-gray-700 cursor-pointer">${translations[currentLang].showQrOnScreen}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="show-qr-toggle-${screen.id}" data-screen-id="${screen.id}" class="show-qr-toggle-checkbox" ${screen.showQrOnPlayer ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="space-y-3 ${screen.showQrOnPlayer ? '' : 'hidden'}">
                    <div>
                        <label for="qr-text-${screen.id}" class="block text-sm font-medium text-gray-700 sr-only">${translations[currentLang].qrCodeText}</label>
                        <input type="text" id="qr-text-${screen.id}" data-screen-id="${screen.id}" class="qr-text-input custom-select mt-2" value="${screen.qrCodeText || ''}" placeholder="${translations[currentLang].qrTextPlaceholder}">
                    </div>
                    <button data-screen-id="${screen.id}" class="select-qr-content-btn w-full btn-secondary mt-3">${translations[currentLang].selectQrContent}</button>
                </div>
            </div>
        `;
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
                alert("Hubo un error al intentar añadir la pantalla.");
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
                    const isSelected = existingIds.includes(media.id);
                    const card = document.createElement('div');
                    card.className = `qr-media-card ${isSelected ? 'selected' : ''}`;
                    card.innerHTML = `
                        <img src="${media.url}" class="w-full h-32 object-cover">
                        <div class="checkbox-overlay"></div>
                        <input type="checkbox" data-media-id="${media.id}" class="hidden" ${isSelected ? 'checked' : ''}>
                    `;
                    card.addEventListener('click', () => card.classList.toggle('selected'));
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