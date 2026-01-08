export function createMediaCard(media, options = {}) {
    const { isDraggable = false } = options;
    const isVideo = media.type.startsWith('video');
    
    const card = document.createElement('div');
    // Estilos base de la tarjeta
    card.className = 'media-card relative rounded-lg overflow-hidden shadow-sm bg-white border border-gray-200 transition-all duration-200 hover:shadow-md group';
    
    if (isDraggable) {
        card.draggable = true;
        card.classList.add('cursor-move');
        // Datos para el drag & drop
        card.dataset.id = media.id;
        card.dataset.type = media.type;
        card.dataset.url = media.url;
        card.dataset.name = media.name;
        if (media.duration) card.dataset.duration = media.duration;
    }

    // Generar miniatura (Thumbnail)
    const thumbSrc = isVideo ? `${media.url}#t=0.5` : media.url;
    let thumbElement;
    
    if (isVideo) {
        thumbElement = document.createElement('video');
        thumbElement.src = thumbSrc;
        thumbElement.muted = true;
        thumbElement.playsInline = true;
        thumbElement.preload = 'metadata'; // Importante para ver el frame del video
        thumbElement.className = 'w-full h-32 object-cover pointer-events-none bg-gray-100';
    } else {
        thumbElement = document.createElement('img');
        thumbElement.src = thumbSrc;
        thumbElement.loading = 'lazy';
        thumbElement.className = 'w-full h-32 object-cover pointer-events-none bg-gray-100';
    }

    // Información (Nombre)
    const infoDiv = document.createElement('div');
    infoDiv.className = 'p-2';
    const nameP = document.createElement('p');
    nameP.className = 'text-xs font-medium text-gray-700 truncate';
    nameP.textContent = media.name;
    nameP.title = media.name;
    infoDiv.appendChild(nameP);

    // Checkbox oculto (necesario para la selección en modales)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'hidden';
    checkbox.dataset.mediaId = media.id;

    // Ensamblar tarjeta
    card.appendChild(thumbElement);
    card.appendChild(infoDiv);
    card.appendChild(checkbox);

    return card;
}