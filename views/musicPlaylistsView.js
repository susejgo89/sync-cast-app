// Contenido completo para views/musicPlaylistsView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';
import { createMediaCard } from '../components/MediaCard.js';

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
    let currentUserId = userId; // CORRECCIÓN: Asignar el userId recibido a la variable de estado del módulo.
    let draggedItem = null; 

    // --- Lógica de Renderizado y Manipulación de Items ---

    // Crea un elemento de lista compacto para un audio, con drag-and-drop y botón de eliminar.
    function createCompactAudioItem(mediaData, index, onDeleteCallback) {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-lg cursor-grab';
        el.dataset.index = index;
        el.draggable = true;

        el.innerHTML = `
            <div class="flex items-center min-w-0">
                <svg class="w-6 h-6 text-gray-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>
                <p class="text-sm truncate text-gray-700" title="${mediaData.name}">${mediaData.name}</p>
            </div>
            <button class="remove-item-btn text-red-400 hover:text-red-600 p-1">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        
        el.querySelector('.remove-item-btn').addEventListener('click', onDeleteCallback);

        el.addEventListener('dragstart', (e) => {
            draggedItem = el;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('opacity-50'), 0);
        });

        el.addEventListener('dragend', () => {
            draggedItem = null;
            el.classList.remove('opacity-50');
        });

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

async function renderPlaylistItems(itemIds) {
        playlistContentArea.innerHTML = '';
        if (!itemIds || itemIds.length === 0) {
            playlistContentArea.innerHTML = `<p class="text-gray-500 text-center p-4">Arrastra audios aquí.</p>`;
            return;
        };

        // Usamos un bucle for...of con índice para manejar el async/await correctamente
        let index = 0;
        for (const item of itemIds) {
            const idToFetch = (typeof item === 'string') ? item : item.id;

            if (!idToFetch) {
                index++;
                continue;
            }

            const mediaDoc = await getDoc(doc(db, 'media', idToFetch));
            
            if (mediaDoc.exists()) {
                const mediaData = { id: mediaDoc.id, ...mediaDoc.data() };

                const onDelete = () => {
                    const lang = getLang();
                    showConfirmModal(
                        translations[lang].confirmRemoveItemTitle || "Quitar Audio", 
                        `${translations[lang].confirmRemoveItemMsg || '¿Seguro que quieres quitar este audio de la playlist?'}`,
                        () => {
                            const playlistRef = doc(db, 'musicPlaylists', activePlaylistId);
                            // Usamos el ID para eliminarlo del array
                            updateDoc(playlistRef, { items: arrayRemove(idToFetch) });
                        }
                    );
                };

                // Usamos la nueva función para crear un elemento compacto
                const itemElement = createCompactAudioItem(mediaData, index, onDelete);
                playlistContentArea.appendChild(itemElement);
            }
            index++;
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
            userId: currentUserId, // CORRECCIÓN: Usar la variable correcta que sí tiene el ID del usuario.
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
    
        if (!activePlaylistId) return;
    
        const playlistRef = doc(db, 'musicPlaylists', activePlaylistId);
    
        // CASO 1: REORDENANDO UN AUDIO QUE YA ESTÁ EN LA LISTA
        if (draggedItem) {
            const activePlaylist = userMusicPlaylists.find(p => p.id === activePlaylistId);
            if (!activePlaylist) return;
            // Creamos una copia mutable del array de items desde el estado local
            let items = [...(activePlaylist.items || [])];
    
            const fromIndex = parseInt(draggedItem.dataset.index);
            const toEl = e.target.closest('[data-index]');
            const toIndex = toEl ? parseInt(toEl.dataset.index) : items.length;
    
            const [removed] = items.splice(fromIndex, 1);
            items.splice(toIndex, 0, removed);
    
            await updateDoc(playlistRef, { items: items });
        }
        // CASO 2: AÑADIENDO UN NUEVO AUDIO DESDE LA BIBLIOTECA
        else {
            const mediaInfoStr = e.dataTransfer.getData('application/json');
            if (mediaInfoStr) {
                const mediaInfo = JSON.parse(mediaInfoStr);
                if (!mediaInfo.type.startsWith('audio')) {
                    alert("Solo puedes añadir archivos de audio a esta playlist.");
                    return;
                }
                await updateDoc(playlistRef, { items: arrayUnion(mediaInfo.id) });
            }
        }
        draggedItem = null;
    });

    listenersAttached = true;
}

    // Listener principal para la colección 'musicPlaylists'
    return onSnapshot(query(collection(db, 'musicPlaylists'), where('userId', '==', userId)), snapshot => {
        userMusicPlaylists = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // Ordena por fecha de creación

        // Notifica al script principal que los datos han cambiado
        onUpdateCallback(userMusicPlaylists);

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