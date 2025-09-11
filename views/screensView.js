// views/screensView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// State
let currentUserId = null;
let listenersAttached = false;

function renderScreens(screens, visualPlaylists, musicPlaylists, currentLang) {
    screensListContainer.innerHTML = screens.length === 0 ? `<p class="text-gray-500 col-span-full text-center">No hay pantallas registradas.</p>` : '';
    screens.forEach(screen => {
        const visualOptions = visualPlaylists.map(p => `<option value="${p.id}" ${screen.playlistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        // --- LÍNEA NUEVA ---
        const musicOptions = musicPlaylists.map(p => `<option value="${p.id}" ${screen.musicPlaylistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

        const card = document.createElement('div');
        card.className = 'card p-5 flex flex-col';
        
        // --- HTML MODIFICADO ---
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xl font-bold text-gray-800">${screen.name}</h4>
                    <p class="text-sm text-gray-500 mt-1"><span data-lang="code">${translations[currentLang].code}</span>: <span class="font-mono bg-gray-200 px-2 py-1 rounded">${screen.pairingCode || 'Enlazada'}</span></p>
                </div>
                <button data-screen-id="${screen.id}" class="delete-screen-btn text-gray-400 hover:text-red-600">...</button>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700">${translations[currentLang].visualPlaylist || 'Playlist Visual'}</label>
                    <select data-screen-id="${screen.id}" class="playlist-select mt-1 block w-full ... rounded-md">
                        <option value="">${translations[currentLang].none}</option>
                        ${visualOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">${translations[currentLang].musicPlaylist || 'Playlist de Música'}</label>
                    <select data-screen-id="${screen.id}" class="music-playlist-select mt-1 block w-full ... rounded-md">
                        <option value="">${translations[currentLang].none}</option>
                        ${musicOptions}
                    </select>
                </div>
            </div>
        `;
        screensListContainer.appendChild(card);
    });
}

function loadScreens(userId, visualPlaylists, musicPlaylists, currentLang) {
    const q = query(collection(db, 'screens'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const screens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ahora pasamos todos los parámetros a la función que dibuja
        renderScreens(screens, visualPlaylists, musicPlaylists, currentLang);
    });
}

export function initScreensView(userId, getPlaylists, getMusicPlaylists, getLang) {
    currentUserId = userId;

    if (!listenersAttached) {
         addScreenBtn.addEventListener('click', async () => {
    try {
        const lang = getLang(); // Obtenemos el idioma actual
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const screenLimit = userDocSnap.data()?.screenLimit || 0;

        const screensQuery = query(collection(db, 'screens'), where('userId', '==', userId));
        const screensSnapshot = await getDocs(screensQuery);
        const currentScreenCount = screensSnapshot.size;

        if (currentScreenCount >= screenLimit) {
            // Usamos las traducciones para el mensaje de error
            const limitMsg = translations[lang].screenLimitReached.replace('{limit}', screenLimit);
            const updateMsg = translations[lang].updatePlanPrompt;
            alert(`${limitMsg}\n${updateMsg}`);
            return;
        }

        // Usamos la traducción para el prompt
        const screenName = prompt(translations[lang].addScreenPrompt);
        if (screenName) {
            const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await addDoc(collection(db, 'screens'), {
                userId: userId,
                name: screenName,
                pairingCode: pairingCode,
                playlistId: null,
                createdAt: serverTimestamp()
            });

            // Usamos las traducciones para el mensaje de éxito
            const successMsg = translations[lang].screenCreatedSuccess.replace('{name}', screenName);
            const pairingMsg = translations[lang].pairingCodeInstruction;
            alert(`${successMsg}\n\n${pairingMsg} ${pairingCode}`);
        }

    } catch (error) {
        console.error("Error al añadir pantalla:", error);
        alert("Hubo un error al intentar añadir la pantalla.");
    }
});
        addScreenCancelBtn.addEventListener('click', () => addScreenModal.classList.remove('active'));
        pairingCodeCloseBtn.addEventListener('click', () => pairingCodeModal.classList.remove('active'));

        addScreenForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const screenName = newScreenNameInput.value.trim();
            if (!screenName) return;
            const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await addDoc(collection(db, 'screens'), {
                userId: currentUserId,
                name: screenName,
                pairingCode: pairingCode,
                playlistId: null,
                createdAt: serverTimestamp()
            });
            newScreenNameInput.value = '';
            addScreenModal.classList.remove('active');
            pairingCodeDisplay.textContent = pairingCode;
            pairingCodeModal.classList.add('active');
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
});
        listenersAttached = true;
    }

    let unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang());

    return {
        unsubscribe: () => unsubscribe(),
        rerender: () => {
            unsubscribe();
            unsubscribe = loadScreens(userId, getPlaylists(), getMusicPlaylists(), getLang());
        }
    };
}