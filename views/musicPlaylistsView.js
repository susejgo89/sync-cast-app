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
    let currentUserId = userId; // CORRECCIÓN: Asignar el userId recibido a la variable de estado del módulo.
    let draggedItem = null; 

    // --- Lógica de Renderizado y Manipulación de Items ---

    // Crea un elemento de lista compacto para un audio, con drag-and-drop y botón de eliminar.
    function createCompactAudioItem(mediaData, index, onDeleteCallback) {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-between bg-white/60 border border-white/50 shadow-sm p-3 rounded-xl cursor-grab mb-3 transition-all hover:bg-white/90 hover:shadow-md hover:scale-[1.01] group';
        el.dataset.index = index;
        el.draggable = true;

        el.innerHTML = `
            <div class="flex items-center min-w-0 w-full">
                <div class="w-10 h-10 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0 text-violet-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>
                </div>
                <div class="flex flex-col min-w-0">
                    <p class="text-sm font-bold text-gray-800 truncate tracking-tight group-hover:text-violet-700 transition-colors" title="${mediaData.name}">${mediaData.name}</p>
                    <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Audio</p>
                </div>
            </div>
            <button class="remove-item-btn text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all ml-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
            item.className = `list-button-item ${p.id === activePlaylistId ? 'active' : ''}`;
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

    async function addAudioToPlaylist(mediaInfo) {
        if (!activePlaylistId) return;
        const playlistRef = doc(db, 'musicPlaylists', activePlaylistId);
        await updateDoc(playlistRef, { items: arrayUnion(mediaInfo.id) });
    }
    
    function renderAudioLibrary() {
        // LA MAGIA: Filtramos para mostrar SOLO archivos de audio
        const audioFiles = getMediaData().filter(media => media.type.startsWith('audio'));
        
        playlistMediaLibrary.innerHTML = audioFiles.length === 0 ? `<p class="text-gray-500 col-span-full text-center">${translations[getLang()].emptyAudioLibrary}</p>` : '';
        audioFiles.forEach(media => {
            const card = createMediaCard(media, { 
                isDraggable: true,
                onAdd: () => addAudioToPlaylist(media)
            });
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
                    alert(translations[getLang()].onlyAudioFiles);
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