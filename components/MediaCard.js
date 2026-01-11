// components/mediaCard.js

/**
 * Crea y devuelve un elemento de tarjeta de medio con su lógica interna.
 * @param {object} media - El objeto con los datos del archivo (name, url, type, id, etc.).
 * @param {object} options - Opciones de configuración para la tarjeta.
 * @param {boolean} options.isDraggable - Define si la tarjeta se puede arrastrar.
 * @param {function} options.onDelete - La función que se ejecutará al hacer clic en el botón de eliminar.
 * @param {boolean} options.isSelectable - Define si la tarjeta se puede seleccionar (para modales).
 * @param {boolean} options.isSelected - Define si la tarjeta está seleccionada inicialmente.
 * @param {function} options.onAdd - La función que se ejecutará al hacer clic en el botón de añadir (para playlists).
 * @returns {HTMLElement} El elemento HTML de la tarjeta.
 */
export function createMediaCard(media, options = {}) {
    const { isDraggable = false, onDelete = null, isSelectable = false, isSelected = false, onAdd = null } = options;

    const card = document.createElement('div');
    card.className = 'card card-glass overflow-hidden relative group';

    if (isDraggable) {
        card.draggable = true;
        card.dataset.mediaInfo = JSON.stringify(media);
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('application/json', card.dataset.mediaInfo);
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    }

    card.innerHTML = `
        ${media.type.startsWith('image/') ? 
            `<img src="${media.url}" alt="${media.name}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/EEE/31343C?text=Error';">` :
         media.type.startsWith('video/') ? 
            `<video src="${media.url}#t=0.5" class="w-full h-40 object-cover bg-gray-800" muted preload="metadata"></video>` :
         media.type.startsWith('audio/') ?
            `<div class="w-full h-40 bg-gray-800 flex items-center justify-center"><svg class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg></div>` :
            `<div class="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-500">?</div>`}
        <div class="p-3 h-16 flex items-start">
            <p class="text-gray-700 text-sm line-clamp-2" title="${media.name}">${media.name}</p>
        </div>
        ${onDelete ? `<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="delete-media-btn bg-red-600 hover:bg-red-700 text-white p-2 rounded-full">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>` : ''}
        ${onAdd ? `<div class="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button class="add-media-btn bg-violet-600 hover:bg-violet-700 text-white p-2 rounded-full shadow-md transition-transform transform hover:scale-110 flex items-center justify-center" title="Añadir a Playlist">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
        </div>` : ''}
        ${isSelectable ? `
            <div class="selection-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 transition-opacity">
                <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <svg class="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
            </div>
        ` : ''}
    `;

    if (isSelectable) {
        card.classList.add('cursor-pointer');
        card.dataset.mediaId = media.id; // Guardamos el ID para facilitar la selección
        if (isSelected) card.classList.add('selected');
        card.addEventListener('click', () => card.classList.toggle('selected'));
    }

    // Lógica interna del componente: si se proporciona una función onDelete, se la asignamos al botón.
    if (onDelete) {
        const deleteBtn = card.querySelector('.delete-media-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete());
    }

    if (onAdd) {
        const addBtn = card.querySelector('.add-media-btn');
        if (addBtn) addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            onAdd();
        });
    }

    return card;
}