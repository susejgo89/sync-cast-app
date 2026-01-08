// views/playlistsView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion, setDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
let setCurrentQrId = () => {};
let getLang = () => 'es'; // Guardaremos la función aquí


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
    // Añadimos la clase 'group' para efectos hover coordinados y mejoramos sombras/bordes
    el.className = 'flex items-center bg-white/60 border border-white/50 shadow-sm p-3 rounded-xl cursor-grab mb-3 transition-all hover:bg-white/90 hover:shadow-md hover:scale-[1.01] group';
    el.draggable = true;
    el.dataset.index = index;
    const isEditable = item.type.startsWith('image') || item.type === 'iframe' || item.type === 'youtube' || item.type === 'clock' || item.type === 'weather' || item.type === 'qrcode';

    // Etiqueta legible para el tipo de contenido
    const typeLabel = item.type.startsWith('image') ? 'Imagen' : 
                      item.type.startsWith('video') ? 'Video' :
                      item.type === 'youtube' ? 'YouTube' :
                      item.type === 'iframe' ? 'Web' :
                      item.type === 'clock' ? 'Reloj' :
                      item.type === 'weather' ? 'Clima' :
                      item.type === 'qrcode' ? 'QR' : item.type.toUpperCase();

    // El cambio se hace dentro de esta plantilla de HTML
    el.innerHTML = `
        <div class="w-14 h-14 bg-gray-50 rounded-lg mr-4 flex-shrink-0 flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200 shadow-inner group-hover:border-violet-200 transition-colors">
            ${item.type.startsWith('image') ? `<img src="${item.url}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.onerror=null;this.src='https://placehold.co/160x100/EEE/31343C?text=Error';">` : ''}
            ${item.type.startsWith('video') ? `<svg class="w-6 h-6 text-violet-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5z"></path></svg>` : ''}
            ${item.type === 'youtube' ? `<svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>` : ''}
            ${item.type === 'iframe' ? `<svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-1.5-1.5a.5.5 0 01.707-.707l1.5 1.5a1 1 0 001.414 0l3-3z" clip-rule="evenodd"></path><path fill-rule="evenodd" d="M4.086 15.414a2 2 0 010-2.828l3-3a2 2 0 012.828 0l1.5 1.5a.5.5 0 01-.707.707l-1.5-1.5a1 1 0 00-1.414 0l-3 3a1 1 0 000 1.414 1 1 0 001.414 0l.5-.5a.5.5 0 11.707.707l-.5.5a2 2 0 01-2.828 0z" clip-rule="evenodd"></path></svg>` : ''}
            ${item.type === 'clock' ? `<svg class="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg>` : ''}
            ${item.type === 'weather' ? `<svg class="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M15.312 11.218a.5.5 0 01.688.718A6.979 6.979 0 0110 16a6.979 6.979 0 01-6-4.064.5.5 0 01.688-.718A5.979 5.979 0 0010 15a5.979 5.979 0 005.312-3.782zM10 4a.5.5 0 01.5.5v5a.5.5 0 01-1 0v-5A.5.5 0 0110 4z" clip-rule="evenodd"></path></svg>` : ''}
            ${item.type === 'qrcode' ? `<svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path><path d="M3 10v4M21 10v4M10 3h4M10 21h4"></path></svg>` : ''}
        </div>

        <div class="flex-grow min-w-0 flex flex-col justify-center">
            <p class="text-sm font-bold text-gray-800 truncate tracking-tight group-hover:text-violet-700 transition-colors" title="${item.name}">${item.name}</p>
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">${typeLabel}</p>
        </div>
        
        <div class="flex items-center gap-x-3 mx-2">
            ${isEditable ? `
                <div class="flex flex-col items-end">
                    <span class="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">${item.duration || 10}s</span>
                </div>
                <button class="edit-item-btn text-gray-400 hover:text-violet-600 p-2 rounded-full hover:bg-violet-50 transition-all" data-index="${index}" title="Editar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L14.732 5.232z"></path></svg>
                </button>
            ` : ''}
        </div>
        
        <button class="remove-item-btn text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all" data-index="${index}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
    `;

    el.addEventListener('dragstart', (e) => { draggedItem = el; e.dataTransfer.effectAllowed = 'move'; });
    return el;
}

function renderPlaylistItems(items, currentLang) {
    playlistContentArea.innerHTML = '';
    items.forEach((item, index) => playlistContentArea.appendChild(createPlaylistItemElement(item, index, currentLang)));
}

async function selectPlaylist(playlistId) {
    activePlaylistId = playlistId;
    const currentLang = getLang(); // Obtenemos el idioma desde la función guardada
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

    // Ocultamos el editor de duración al cambiar de playlist
    document.getElementById('edit-item-form').classList.add('hidden');
    document.getElementById('add-url-form').classList.remove('hidden');

    renderPlaylistItems(playlist.items || [], currentLang);
    renderVisualMediaLibrary();
    Array.from(playlistsList.children).forEach(child => {
        child.classList.toggle('active', child.dataset.playlistId === playlistId);
    });

    // --- LÓGICA PARA AÑADIR URL (MOVIDA AQUÍ) ---
    // Al moverla aquí, nos aseguramos de que se activa cada vez que se muestra el editor.
    const addUrlForm = document.getElementById('add-url-form');
    const urlInput = document.getElementById('url-input');

    // Usamos .cloneNode para eliminar listeners antiguos y evitar que se acumulen.
    const newForm = addUrlForm.cloneNode(true);
    addUrlForm.parentNode.replaceChild(newForm, addUrlForm);
    const newUrlInput = document.getElementById('url-input');

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Previene la recarga de la página.
        if (!activePlaylistId) {
            alert(translations[getLang()].selectPlaylistFirst || 'Por favor, selecciona una playlist primero.');
            return;
        }
        const url = newUrlInput.value.trim();
        if (!url) return;

        let itemData = {
            type: 'iframe',
            url: url,
            duration: 15,
            name: `Web: ${new URL(url).hostname}` // Añadimos un nombre por defecto
        };

        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(youtubeRegex);

        if (match && match[1]) {
            const videoId = match[1];
            itemData.type = 'youtube';
            itemData.url = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&modestbranding=1`;
            itemData.name = `YouTube: ${videoId}`;
        }

        await updateDoc(doc(db, 'playlists', activePlaylistId), { items: arrayUnion(itemData) });
        newUrlInput.value = '';
    });

}

function loadPlaylists(userId) {
    const q = query(collection(db, 'playlists'), where('userId', '==', userId));
    
    // onSnapshot escucha cambios en la base de datos en tiempo real
    return onSnapshot(q, snapshot => {
        const currentLang = getLang();
        const sortedDocs = snapshot.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        const userPlaylistsData = sortedDocs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 1. Dibuja la lista de playlists de la izquierda (esto ya lo hacías)
        playlistsList.innerHTML = '';
        userPlaylistsData.forEach(p => {
            const item = document.createElement('div');
            item.className = `list-button-item ${p.id === activePlaylistId ? 'active' : ''}`;
            item.textContent = p.name;
            item.dataset.playlistId = p.id;
            item.addEventListener('click', () => selectPlaylist(p.id));
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

export function initPlaylistsView(userId, langGetter, onUpdateCallback, mediaDataGetter, setQrIdCallback) {
    currentUserId = userId;
    onPlaylistsUpdate = onUpdateCallback;
    getLang = langGetter; // Guardamos la función para usarla en todo el módulo
    getMediaData = mediaDataGetter;
    setCurrentQrId = setQrIdCallback;

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

        // Lógica para el botón de añadir reloj (MOVIDA AQUÍ)
        const addClockBtn = document.getElementById('add-clock-item-btn');
        addClockBtn.addEventListener('click', async () => {
            if (!activePlaylistId) {
                alert(translations[getLang()].selectPlaylistFirst || 'Por favor, selecciona una playlist primero.');
                return;
            }
            const clockItem = { 
                type: 'clock', 
                name: 'Reloj Digital (Local)', 
                duration: 10,
                timezone: 'local' // 'local' para la hora del dispositivo
            };
            await updateDoc(doc(db, 'playlists', activePlaylistId), { items: arrayUnion(clockItem) });
        });

        const addWeatherBtn = document.getElementById('add-weather-item-btn');
        addWeatherBtn.addEventListener('click', async () => {
            if (!activePlaylistId) {
                alert(translations[getLang()].selectPlaylistFirst || 'Por favor, selecciona una playlist primero.');
                return;
            }
            const weatherItem = { 
                type: 'weather', 
                name: 'Resumen del Clima', 
                duration: 15,
                location: '' // Añadimos la propiedad de ubicación
            };
            await updateDoc(doc(db, 'playlists', activePlaylistId), { items: arrayUnion(weatherItem) });
        });

        const addQrBtn = document.getElementById('add-qr-fullscreen-item-btn');
        addQrBtn.addEventListener('click', async () => {
            if (!activePlaylistId) {
                alert(translations[getLang()].selectPlaylistFirst);
                return;
            }
            const qrItem = { 
                type: 'qrcode', 
                name: 'Código QR Pantalla Completa', 
                duration: 15,
                text: translations[getLang()].scanForMenu || 'Escanea para más info',
                qrType: 'url',
                qrUrl: '',
                qrMenuId: `qr_${Date.now()}`
            };

            // Creamos el documento en qrContents por adelantado para evitar errores de permisos
            const qrContentRef = doc(db, 'qrMenus', qrItem.qrMenuId);
            await setDoc(qrContentRef, {
                // CORRECCIÓN: Añadimos el userId para cumplir con las reglas de seguridad.
                userId: currentUserId, 
                items: []
            });

            // Añadimos el item a la playlist
            await updateDoc(doc(db, 'playlists', activePlaylistId), { items: arrayUnion(qrItem) });
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
            playlistContentArea.classList.remove('drag-over');
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

        document.getElementById('edit-item-cancel').addEventListener('click', () => {
            document.getElementById('edit-item-form').classList.add('hidden');
            document.getElementById('add-url-form').classList.remove('hidden');
        });

        playlistContentArea.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-item-btn');
            if (editBtn) {
                const index = parseInt(editBtn.dataset.index);
                const playlistRef = doc(db, 'playlists', activePlaylistId);
                const playlistDoc = await getDoc(playlistRef);
                if (!playlistDoc.exists()) return;
                const items = playlistDoc.data().items || [];
                const item = items[index];

                if (item) {
                    document.getElementById('add-url-form').classList.add('hidden');
                    const editForm = document.getElementById('edit-item-form');
                    editForm.classList.remove('hidden');
                    document.getElementById('edit-item-name').textContent = item.name;
                    document.getElementById('edit-item-duration').value = item.duration || 10;
                    document.getElementById('edit-item-index').value = index;

                    // Mostramos el campo de ubicación SOLO si es un item de clima
                    const locationContainer = document.getElementById('edit-item-location-container');
                    const qrContainer = document.getElementById('edit-item-qr-container');

                    if (item.type === 'weather') {
                        document.getElementById('edit-item-location').value = item.location || '';
                        locationContainer.classList.remove('hidden');
                        qrContainer.classList.add('hidden');
                    } else if (item.type === 'qrcode') {
                        document.getElementById('edit-item-qr-text').value = item.text || '';
                        const qrTypeSelect = document.getElementById('edit-item-qr-type');
                        const qrUrlContainer = document.getElementById('edit-item-qr-url-container');
                        const qrMenuContainer = document.getElementById('edit-item-qr-menu-container');
                        
                        qrTypeSelect.value = item.qrType || 'url';
                        
                        if (qrTypeSelect.value === 'url') {
                            document.getElementById('edit-item-qr-url').value = item.qrUrl || '';
                            qrUrlContainer.classList.remove('hidden');
                            qrMenuContainer.classList.add('hidden');
                        } else { // menu
                            qrUrlContainer.classList.add('hidden');
                            qrMenuContainer.classList.remove('hidden');
                        }

                        qrContainer.classList.remove('hidden');
                        locationContainer.classList.add('hidden');

                    } else {
                        locationContainer.classList.add('hidden');
                        qrContainer.classList.add('hidden');
                    }
                }
            }
        });

        document.getElementById('edit-item-qr-type').addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('edit-item-qr-url-container').classList.toggle('hidden', type !== 'url');
            document.getElementById('edit-item-qr-menu-container').classList.toggle('hidden', type !== 'menu');
        });

        document.getElementById('edit-item-qr-select-media-btn').addEventListener('click', async () => {
            const index = parseInt(document.getElementById('edit-item-index').value);
            const playlistRef = doc(db, 'playlists', activePlaylistId);
            const playlistSnap = await getDoc(playlistRef);
            if (!playlistSnap.exists()) return;
            const items = playlistSnap.data().items || [];
            const item = items[index];

            if (item && item.qrMenuId) {
                // Notificamos al script principal el ID del QR que estamos editando
                setCurrentQrId(item.qrMenuId);
                document.dispatchEvent(new CustomEvent('openQrContentModal', { detail: { qrMenuId: item.qrMenuId } }));
                document.getElementById('qr-content-modal').classList.add('active');
            }
        });

        document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const index = parseInt(document.getElementById('edit-item-index').value);
            const playlistRef = doc(db, 'playlists', activePlaylistId);
            const playlistDoc = await getDoc(playlistRef);
            if (!playlistDoc.exists()) return;
            let items = playlistDoc.data().items || [];
            
            if (items[index]) {
                items[index].duration = parseInt(document.getElementById('edit-item-duration').value);
                if (items[index].type === 'weather') {
                    items[index].location = document.getElementById('edit-item-location').value.trim();
                } 
                else if (items[index].type === 'qrcode') {
                    items[index].text = document.getElementById('edit-item-qr-text').value.trim();
                    items[index].qrType = document.getElementById('edit-item-qr-type').value;
                    items[index].qrUrl = document.getElementById('edit-item-qr-url').value.trim();
                }
                await updateDoc(playlistRef, { items });
            }
            // En lugar de simular un click, llamamos directamente a la lógica de cierre para más control
            document.getElementById('edit-item-form').classList.add('hidden');
            document.getElementById('add-url-form').classList.remove('hidden');
        });

        listenersAttached = true;
    }

    const unsubscribe = loadPlaylists(userId);

    return {
        unsubscribe: unsubscribe,
        rerenderLibrary: renderVisualMediaLibrary
    };
}
