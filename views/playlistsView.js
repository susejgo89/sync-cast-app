// views/playlistsView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';
import { createMediaCard } from '../components/mediaCard.js';

// DOM Elements specific to this view
const addPlaylistBtn = document.getElementById('add-playlist-btn');
const playlistsList = document.getElementById('playlists-list');
const playlistEditor = document.getElementById('playlist-editor');
const playlistPlaceholder = document.getElementById('playlist-placeholder');
const playlistEditorTitle = document.getElementById('playlist-editor-title');
const deletePlaylistBtn = document.getElementById('delete-playlist-btn');
const playlistContentArea = document.getElementById('playlist-content-area');
const playlistMediaLibrary = document.getElementById('playlist-media-library');
const addPlaylistModal = document.getElementById('add-playlist-modal');
const addPlaylistForm = document.getElementById('add-playlist-form');
const newPlaylistNameInput = document.getElementById('new-playlist-name');
const addPlaylistCancelBtn = document.getElementById('add-playlist-cancel');

// State
let currentUserId = null;
let activePlaylistId = null;
let draggedItem = null;
let onPlaylistsUpdate = () => {}; // Callback function
let getMediaData = () => [];
let listenersAttached = false;


function renderVisualMediaLibrary() {
    if (!playlistMediaLibrary) return;
    // Filtra por medios que NO son de audio
    const visualMedia = getMediaData().filter(media => !media.type.startsWith('audio/'));
    
    playlistMediaLibrary.innerHTML = '';
    visualMedia.forEach(media => {
        const card = createMediaCard(media, { isDraggable: true });
        playlistMediaLibrary.appendChild(card);
    });
}

function createPlaylistItemElement(item, index, currentLang) {
    const el = document.createElement('div');
    el.className = 'flex items-center bg-gray-200 p-2 rounded-lg cursor-grab';
    el.draggable = true;
    el.dataset.index = index;
    const isImage = item.type.startsWith('image');

    // El cambio se hace dentro de esta plantilla de HTML
    el.innerHTML = `
        <div class="w-16 h-10 bg-black rounded-md mr-3 flex-shrink-0">
            ${isImage ? `<img src="${item.url}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/160x100/EEE/31343C?text=Error';">` : `<video src="${item.url}" class="w-full h-full object-cover"></video>`}
        </div>

        <div class="flex-grow min-w-0">
            <p class="text-sm truncate text-gray-700" title="${item.name}">${item.name}</p>
        </div>
        
        ${isImage ? `
            <div class="flex items-center gap-x-1 mx-3">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                
                <input type="number" value="${item.duration || 10}" min="1" class="duration-input w-12 bg-gray-300 text-gray-800 text-center rounded-md p-1" data-index="${index}">
                
                <span class="text-sm font-semibold text-gray-600">s</span>
            </div>
        ` : ''}
        
        <button class="remove-item-btn text-red-400 hover:text-red-600 p-1" data-index="${index}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;

    el.addEventListener('dragstart', (e) => { draggedItem = el; e.dataTransfer.effectAllowed = 'move'; });
    return el;
}

function renderPlaylistItems(items, currentLang) {
    playlistContentArea.innerHTML = '';
    items.forEach((item, index) => playlistContentArea.appendChild(createPlaylistItemElement(item, index, currentLang)));
}

async function selectPlaylist(playlistId, currentLang) {
    activePlaylistId = playlistId;
    const playlistDoc = await getDoc(doc(db, 'playlists', playlistId));
    if (!playlistDoc.exists()) {
        activePlaylistId = null;
        playlistEditor.classList.add('hidden');
        playlistPlaceholder.classList.remove('hidden');
        return;
    }
    const playlist = playlistDoc.data();
    playlistEditor.classList.remove('hidden');
    playlistPlaceholder.classList.add('hidden');
    playlistEditorTitle.textContent = `${translations[currentLang].editing}: ${playlist.name}`;
    renderPlaylistItems(playlist.items || [], currentLang);
    renderVisualMediaLibrary();
    Array.from(playlistsList.children).forEach(child => {
        child.classList.toggle('bg-violet-600', child.dataset.playlistId === playlistId);
        child.classList.toggle('text-white', child.dataset.playlistId === playlistId);
        child.classList.toggle('bg-gray-100', child.dataset.playlistId !== playlistId);
        child.classList.toggle('text-gray-800', child.dataset.playlistId !== playlistId);
    });
}

function loadPlaylists(userId, currentLang) {
    const q = query(collection(db, 'playlists'), where('userId', '==', userId));
    
    // onSnapshot escucha cambios en la base de datos en tiempo real
    return onSnapshot(q, snapshot => {
        const sortedDocs = snapshot.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        const userPlaylistsData = sortedDocs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 1. Dibuja la lista de playlists de la izquierda (esto ya lo hacías)
        playlistsList.innerHTML = '';
        userPlaylistsData.forEach(p => {
            const item = document.createElement('div');
            item.className = `p-3 rounded-lg cursor-pointer transition-colors ${p.id === activePlaylistId ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;
            item.textContent = p.name;
            item.dataset.playlistId = p.id;
            item.addEventListener('click', () => selectPlaylist(p.id, currentLang));
            playlistsList.appendChild(item);
        });
        
        // 2. (ESTA ES LA PARTE NUEVA)
        // Si hay una playlist activa, la volvemos a dibujar para reflejar cualquier cambio
        if (activePlaylistId) {
            const activeData = userPlaylistsData.find(p => p.id === activePlaylistId);
            if (activeData) {
                // Si la playlist activa todavía existe, redibuja su contenido
                renderPlaylistItems(activeData.items || [], currentLang);
            } else {
                // Si la playlist activa fue eliminada, reseteamos la vista
                activePlaylistId = null;
                playlistEditor.classList.add('hidden');
                playlistPlaceholder.classList.remove('hidden');
            }
        }
        
        onPlaylistsUpdate(userPlaylistsData); 
    });
}

export function initPlaylistsView(userId, getLang, onUpdateCallback, mediaDataGetter) {
    currentUserId = userId;
    onPlaylistsUpdate = onUpdateCallback;
    getMediaData = mediaDataGetter;

    if (!listenersAttached) {
        addPlaylistBtn.addEventListener('click', () => addPlaylistModal.classList.add('active'));
        addPlaylistCancelBtn.addEventListener('click', () => addPlaylistModal.classList.remove('active'));

        addPlaylistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const playlistName = newPlaylistNameInput.value.trim();
            if (!playlistName) return;
            await addDoc(collection(db, 'playlists'), {
                userId: currentUserId,
                name: playlistName,
                items: [],
                createdAt: serverTimestamp()
            });
            newPlaylistNameInput.value = '';
            addPlaylistModal.classList.remove('active');
        });

        deletePlaylistBtn.addEventListener('click', () => { 
            if (activePlaylistId) {
                showConfirmModal("Eliminar Playlist", "¿Seguro que quieres eliminar esta playlist?", () => {
                    deleteDoc(doc(db, 'playlists', activePlaylistId)).then(() => { 
                        activePlaylistId = null; 
                        playlistEditor.classList.add('hidden'); 
                        playlistPlaceholder.classList.remove('hidden'); 
                    });
                });
            }
        });

        playlistContentArea.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; playlistContentArea.classList.add('drag-over'); });
        playlistContentArea.addEventListener('dragleave', () => playlistContentArea.classList.remove('drag-over'));

        playlistContentArea.addEventListener('drop', async e => {
            e.preventDefault();
            const mediaInfoStr = e.dataTransfer.getData('application/json');
            const playlistRef = doc(db, 'playlists', activePlaylistId);
            const playlistDoc = await getDoc(playlistRef);
            if (!playlistDoc.exists()) return;
            let items = playlistDoc.data().items || [];

            if (mediaInfoStr) {
                const mediaInfo = JSON.parse(mediaInfoStr);
                items.push({ name: mediaInfo.name, url: mediaInfo.url, type: mediaInfo.type, duration: 10 });
            } else if (draggedItem) {
                const fromIndex = parseInt(draggedItem.dataset.index);
                const toEl = e.target.closest('[data-index]');
                const toIndex = toEl ? parseInt(toEl.dataset.index) : items.length - 1;
                const [removed] = items.splice(fromIndex, 1);
                items.splice(toIndex, 0, removed);
            }
            await updateDoc(playlistRef, { items });
            draggedItem = null;
        });

        playlistContentArea.addEventListener('change', async (e) => {
            if (e.target.classList.contains('duration-input')) {
                const index = parseInt(e.target.dataset.index);
                const newDuration = parseInt(e.target.value);
                if (newDuration < 1) return;
                const playlistRef = doc(db, 'playlists', activePlaylistId);
                const playlistDoc = await getDoc(playlistRef);
                if (playlistDoc.exists()) {
                    let items = playlistDoc.data().items || [];
                    if (items[index]) items[index].duration = newDuration;
                    await updateDoc(playlistRef, { items });
                }
            }
        });

       playlistContentArea.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.remove-item-btn');
    if (removeBtn) {
        const indexToRemove = parseInt(removeBtn.dataset.index);
        const playlistRef = doc(db, 'playlists', activePlaylistId);
        const playlistDoc = await getDoc(playlistRef);

        if (playlistDoc.exists()) {
            let items = playlistDoc.data().items || [];
            const itemToRemove = items[indexToRemove];

            if (itemToRemove) {
                // Usamos getLang() para obtener el idioma actual
                const lang = getLang(); 
                showConfirmModal(
                    translations[lang].confirmRemoveItemTitle || "Confirmar Eliminación",
                    `${translations[lang].confirmRemoveItemMsg || '¿Seguro que quieres quitar'} "${itemToRemove.name}"?`,
                    async () => {
                        items.splice(indexToRemove, 1);
                        await updateDoc(playlistRef, { items });
                    }
                );
            }
        }
    }
});

        listenersAttached = true;
    }

    const unsubscribe = loadPlaylists(userId, getLang());

    return {
        unsubscribe: unsubscribe,
        rerenderLibrary: renderVisualMediaLibrary
    };
}