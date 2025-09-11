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

function renderScreens(screens, playlists, currentLang) {
    screensListContainer.innerHTML = screens.length === 0 ? `<p class="text-gray-500 col-span-full text-center">No hay pantallas registradas.</p>` : '';
    screens.forEach(screen => {
        const playlistOptions = playlists.map(p => `<option value="${p.id}" ${screen.playlistId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

        const card = document.createElement('div');
        card.className = 'card p-5 flex flex-col';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xl font-bold text-gray-800">${screen.name}</h4>
                    <p class="text-sm text-gray-500 mt-1"><span data-lang="code">${translations[currentLang].code}</span>: <span class="font-mono bg-gray-200 px-2 py-1 rounded">${screen.pairingCode}</span></p>
                </div>
                <button data-screen-id="${screen.id}" class="delete-screen-btn text-gray-400 hover:text-red-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <label class="block text-sm font-medium text-gray-700" data-lang="assignedPlaylist">${translations[currentLang].assignedPlaylist}</label>
                <select data-screen-id="${screen.id}" class="playlist-select mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm rounded-md">
                    <option value="">${translations[currentLang].none}</option>
                    ${playlistOptions}
                </select>
            </div>
        `;
        screensListContainer.appendChild(card);
    });
}

function loadScreens(userId, playlists, currentLang) {
    const q = query(collection(db, 'screens'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const screens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderScreens(screens, playlists, currentLang);
    });
}

export function initScreensView(userId, getPlaylists, getLang) {
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
            if (e.target.classList.contains('playlist-select')) {
                const screenId = e.target.dataset.screenId;
                const playlistId = e.target.value || null;
                updateDoc(doc(db, 'screens', screenId), { playlistId });
            }
        });
        listenersAttached = true;
    }

    let unsubscribe = loadScreens(userId, getPlaylists(), getLang());

    return {
        unsubscribe: () => unsubscribe(),
        rerender: () => {
            unsubscribe();
            unsubscribe = loadScreens(userId, getPlaylists(), getLang());
        }
    };
}