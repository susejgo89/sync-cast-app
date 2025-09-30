// views/screensView.js

import { db } from '../firebase-config.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// State
let currentUserId = null;
let listenersAttached = false;
let allUserMedia = [];
let currentScreenForQr = null;

function renderScreens(screens, visualPlaylists, musicPlaylists, currentLang, userMedia) {
    allUserMedia = userMedia;
    screensListContainer.innerHTML = screens.length === 0 ? `<p class="text-gray-500 col-span-full text-center">No hay pantallas registradas.</p>` : '';
    screens.forEach(screen => {
        const visualOptions = visualPlaylists.map(p => `<option value="${p.id}" ${screen.playlistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        const musicOptions = musicPlaylists.map(p => `<option value="${p.id}" ${screen.musicPlaylistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

        // --- LÓGICA DE ESTADO ONLINE/OFFLINE ---
        const lastSeen = screen.lastSeen?.toDate();
        const now = new Date();
        // Consideramos online si el último latido fue hace menos de 2.5 minutos (150 segundos) para dar un margen.
        const isOnline = lastSeen && (now.getTime() - lastSeen.getTime()) / 1000 < 150;

        const card = document.createElement('div');
        card.className = 'card p-5 flex flex-col';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xl font-bold text-gray-800">${screen.name}</h4>
                    <p class="text-sm text-gray-500 mt-1"><span data-lang="code">${translations[currentLang].code}</span>: <span class="font-mono bg-gray-200 px-2 py-1 rounded">${screen.isPaired ? (translations[currentLang].paired || 'Enlazada') : screen.pairingCode}</span></p>
                </div>
                <button data-screen-id="${screen.id}" class="delete-screen-btn text-gray-400 hover:text-red-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
            <div class="mt-3 flex items-center space-x-2">
                <div class="status-dot ${isOnline ? 'status-dot-online animate-pulse' : 'status-dot-offline'}"></div>
                <span class="text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}">
                    ${isOnline ? (translations[currentLang].online || 'Online') : (translations[currentLang].offline || 'Offline')}
                </span>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700">${translations[currentLang].visualPlaylist || 'Playlist Visual'}</label>
                    <select data-screen-id="${screen.id}" class="playlist-select custom-select mt-1">
                        <option value="">${translations[currentLang].none}</option>
                        ${visualOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">${translations[currentLang].musicPlaylist || 'Playlist de Música'}</label>
                    <select data-screen-id="${screen.id}" class="music-playlist-select custom-select mt-1">
                        <option value="">${translations[currentLang].none}</option>
                        ${musicOptions}
                    </select>
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

function loadScreens(userId, visualPlaylists, musicPlaylists, currentLang, userMedia, onUpdate) {
    const q = query(collection(db, 'screens'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const screens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ahora pasamos todos los parámetros a la función que dibuja
        renderScreens(screens, visualPlaylists, musicPlaylists, currentLang, userMedia);
        onUpdate(screens); // Notificamos al script principal sobre los cambios
    });
}

export function initScreensView(userId, getPlaylists, getMusicPlaylists, getLang, getMedia, onUpdateCallback) {
    currentUserId = userId;

    if (!listenersAttached) {
        addScreenBtn.addEventListener('click', () => {
            addScreenModal.classList.add('active');
        });

        addScreenCancelBtn.addEventListener('click', () => addScreenModal.classList.remove('active'));
        pairingCodeCloseBtn.addEventListener('click', () => pairingCodeModal.classList.remove('active'));

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
                    qrCodeItems: [], // Inicializamos el campo para el contenido del QR
                    playlistId: null,
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

        qrContentSaveBtn.addEventListener('click', async () => {
            if (!currentScreenForQr) return;

            const selectedIds = [];
            qrContentMediaLibrary.querySelectorAll('.qr-media-card.selected input').forEach(checkbox => {
                selectedIds.push(checkbox.dataset.mediaId);
            });

            const screenRef = doc(db, 'screens', currentScreenForQr);
            await updateDoc(screenRef, { qrCodeItems: selectedIds });

            qrContentModal.classList.remove('active');
        });

        screensListContainer.addEventListener('click', async (e) => {
            const selectBtn = e.target.closest('.select-qr-content-btn');
            if (selectBtn) {
                const screenId = selectBtn.dataset.screenId;
                currentScreenForQr = screenId;

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
                updateDoc(screenRef, { playlistId });
            }
        
            // Si se cambió el menú de playlist de música
            if (e.target.classList.contains('music-playlist-select')) {
                const musicPlaylistId = e.target.value || null;
                updateDoc(screenRef, { musicPlaylistId });
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

    let unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang(), getMedia(), onUpdateCallback);

    return {
        unsubscribe: () => unsubscribe(),
        rerender: () => {
            unsubscribe();
            unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang(), getMedia(), onUpdateCallback);
        }
    };
}