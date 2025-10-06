// components/MediaCard.js

/**
 * Crea y devuelve un elemento de tarjeta de medio con su lógica interna.
 * @param {object} media - El objeto con los datos del archivo (name, url, type, id, etc.).
 * @param {object} options - Opciones de configuración para la tarjeta.
 * @param {boolean} options.isDraggable - Define si la tarjeta se puede arrastrar.
 * @param {function} options.onDelete - La función que se ejecutará al hacer clic en el botón de eliminar.
 * @returns {HTMLElement} El elemento HTML de la tarjeta.
 */
export function createMediaCard(media, options = {}) {
    const { isDraggable = false, onDelete = null } = options;

    const card = document.createElement('div');
    card.className = 'card overflow-hidden relative group';

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
        ${media.type.startsWith('video') ? `<video src="${media.url.split('&token=')[0]}&token=${media.url.split('&token=')[1]}" class="w-full h-40 object-cover" muted></video>` : `<img src="${media.url}" alt="${media.name}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/EEE/31343C?text=Error';">`}
        <div class="p-3"><p class="text-gray-700 text-sm truncate" title="${media.name}">${media.name}</p></div>
        ${onDelete ? `<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="delete-media-btn bg-red-600 hover:bg-red-700 text-white p-2 rounded-full">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>` : ''}
    `;

    // Lógica interna del componente: si se proporciona una función onDelete, se la asignamos al botón.
    if (onDelete) {
        const deleteBtn = card.querySelector('.delete-media-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete());
    }

    return card;
}