// Contenido completo para views/musicPlaylistsView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';
import { createMediaCard } from '../components/mediaCard.js';

export function initMusicPlaylistsView(userId, getLang, onUpdateCallback, getMediaData) {
    const viewSection = document.getElementById('music-playlists-section');
if (!viewSection) {
    console.error("No se encontró la sección de playlists de música.");
    return null;
}

const addPlaylistBtn = viewSection.querySelector('#add-music-playlist-btn');
const playlistsList = viewSection.querySelector('#music-playlists-list');
const playlistEditor = viewSection.querySelector('#music-playlist-editor');
const playlistPlaceholder = viewSection.querySelector('#music-playlist-placeholder');
const playlistEditorTitle = viewSection.querySelector('#music-playlist-editor-title');
const deletePlaylistBtn = viewSection.querySelector('#delete-music-playlist-btn');
const playlistContentArea = viewSection.querySelector('#music-playlist-content-area');
const playlistMediaLibrary = viewSection.querySelector('#music-playlist-media-library');

// Seleccionamos los elementos correctos del modal de playlists de música
const addMusicPlaylistModal = document.getElementById('add-music-playlist-modal');
const addMusicPlaylistForm = document.getElementById('add-music-playlist-form');
const newMusicPlaylistNameInput = document.getElementById('new-music-playlist-name');
const addMusicPlaylistCancelBtn = document.getElementById('add-music-playlist-cancel');


    let activePlaylistId = null;
    let userMusicPlaylists = [];
    let listenersAttached = false;
    let currentUserId = userId;

    // --- Lógica de Renderizado y Manipulación de Items ---

    // Función para manejar la eliminación de un item de la playlist
    async function handleRemoveItem(itemToRemove) {
        if (!activePlaylistId) return;

        const lang = getLang();
        showConfirmModal(
            translations[lang].confirmRemoveItemTitle,
            `${translations[lang].confirmRemoveItemMsg} "${itemToRemove.name}"?`,
            async () => {
                const playlistRef = doc(db, 'musicPlaylists', activePlaylistId);
                await updateDoc(playlistRef, {
                    items: arrayRemove(itemToRemove) // Usa arrayRemove para quitar el objeto exacto del array
                });
            }
        );
    }

    // Crea el elemento HTML para un solo audio en la lista de la playlist
    function createAudioPlaylistItemElement(item, index) {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-lg';
        el.dataset.index = index;

        el.innerHTML = `
            <div class="flex items-center min-w-0">
                <svg class="w-8 h-8 text-gray-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>
                <p class="text-sm truncate text-gray-700" title="${item.name}">${item.name}</p>
            </div>
            <button class="remove-item-btn text-red-400 hover:text-red-600 p-1">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        
        el.querySelector('.remove-item-btn').addEventListener('click', () => handleRemoveItem(item));

        return el;
    }

    function renderMusicPlaylists() {
        playlistsList.innerHTML = '';
        userMusicPlaylists.forEach(p => {
            const item = document.createElement('div');
            item.className = `p-3 rounded-lg cursor-pointer transition-colors ${p.id === activePlaylistId ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;
            item.textContent = p.name;
            item.dataset.playlistId = p.id;
            item.addEventListener('click', () => selectMusicPlaylist(p.id));
            playlistsList.appendChild(item);
        });
    }

    async function selectMusicPlaylist(playlistId) {
        activePlaylistId = playlistId;
        renderMusicPlaylists(); // Re-render para resaltar la selección
        
        playlistEditor.classList.remove('hidden');
        playlistPlaceholder.classList.add('hidden');
        
        const playlist = userMusicPlaylists.find(p => p.id === playlistId);
        playlistEditorTitle.textContent = `${translations[getLang()].editingMusicPlaylist}: ${playlist.name}`;
        
        // Renderizar items y la biblioteca de audio
        renderPlaylistItems(playlist.items || []);
        renderAudioLibrary();
    }
    
    function renderAudioLibrary() {
        // LA MAGIA: Filtramos para mostrar SOLO archivos de audio
        const audioFiles = getMediaData().filter(media => media.type.startsWith('audio'));
        
        playlistMediaLibrary.innerHTML = audioFiles.length === 0 ? `<p class="text-gray-500 col-span-full text-center">${translations[getLang()].emptyAudioLibrary}</p>` : '';
        audioFiles.forEach(media => {
            const card = createMediaCard(media, { isDraggable: true });
            playlistMediaLibrary.appendChild(card);
        });
    }

    // Dibuja la lista de audios que pertenecen a la playlist activa
    function renderPlaylistItems(items) {
        playlistContentArea.innerHTML = '';
        if (items && items.length > 0) {
            items.forEach((item, index) => {
                playlistContentArea.appendChild(createAudioPlaylistItemElement(item, index));
            });
        } else {
            playlistContentArea.innerHTML = `<p class="text-gray-500 text-center p-4">Arrastra audios aquí para añadirlos a la playlist.</p>`;
        }
    }

    if (!listenersAttached) {
    // ---- Lógica para CREAR una nueva playlist de música ----
    addPlaylistBtn.addEventListener('click', () => {
        newMusicPlaylistNameInput.value = '';
        addMusicPlaylistModal.classList.add('active');
    });

    addMusicPlaylistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const playlistName = newMusicPlaylistNameInput.value.trim();
        if (!playlistName) return;

        await addDoc(collection(db, 'musicPlaylists'), {
            userId: userId,
            name: playlistName,
            items: [],
            createdAt: serverTimestamp()
        });
        addMusicPlaylistModal.classList.remove('active');
    });

    addMusicPlaylistCancelBtn.addEventListener('click', () => {
        addMusicPlaylistModal.classList.remove('active');
    });

    // ---- Lógica para ELIMINAR una playlist de música ----
    deletePlaylistBtn.addEventListener('click', () => {
        if (activePlaylistId) {
            const lang = getLang();
            const playlist = userMusicPlaylists.find(p => p.id === activePlaylistId);
            showConfirmModal(
                translations[lang].confirmDeleteTitle || "Eliminar Playlist", 
                `${translations[lang].confirmDeleteMsg || '¿Seguro que quieres eliminar la playlist'} "${playlist.name}"?`, 
                () => {
                    deleteDoc(doc(db, 'musicPlaylists', activePlaylistId)).then(() => { 
                        activePlaylistId = null; 
                        playlistEditor.classList.add('hidden'); 
                        playlistPlaceholder.classList.remove('hidden'); 
                    });
                }
            );
        }
    });
    
    // ---- Lógica para ARRASTRAR Y SOLTAR audios ----
    playlistContentArea.addEventListener('dragover', e => {
        e.preventDefault();
        playlistContentArea.classList.add('drag-over');
    });

    playlistContentArea.addEventListener('dragleave', () => {
        playlistContentArea.classList.remove('drag-over');
    });

    playlistContentArea.addEventListener('drop', async e => {
        e.preventDefault();
        playlistContentArea.classList.remove('drag-over');
        const mediaInfoStr = e.dataTransfer.getData('application/json');

        if (mediaInfoStr && activePlaylistId) {
            const mediaInfo = JSON.parse(mediaInfoStr);

            if (!mediaInfo.type.startsWith('audio')) {
                alert("Solo puedes añadir archivos de audio a esta playlist.");
                return;
            }

            // Preparamos un objeto limpio para guardar en la playlist
            const itemToAdd = {
                id: mediaInfo.id,
                name: mediaInfo.name,
                url: mediaInfo.url,
                type: mediaInfo.type
            };

            const playlistRef = doc(db, 'musicPlaylists', activePlaylistId);
            await updateDoc(playlistRef, {
                items: arrayUnion(itemToAdd) // Usamos arrayUnion para añadir el objeto al array de forma segura
            });
        }
    });

    listenersAttached = true;
}

    // Listener principal para la colección 'musicPlaylists'
    return onSnapshot(query(collection(db, 'musicPlaylists'), where('userId', '==', userId)), snapshot => {
        userMusicPlaylists = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // Ordena por fecha de creación

        renderMusicPlaylists();
        
        // Si hay una playlist activa, la refrescamos para mostrar cambios (items añadidos/quitados)
        if (activePlaylistId) {
            const activeData = userMusicPlaylists.find(p => p.id === activePlaylistId);
            if (activeData) {
                renderPlaylistItems(activeData.items || []);
            } else { // Si la playlist activa fue eliminada, reseteamos la vista
                activePlaylistId = null;
                playlistEditor.classList.add('hidden');
                playlistPlaceholder.classList.remove('hidden');
            }
        }
    });
}