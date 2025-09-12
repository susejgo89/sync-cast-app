import { db } from './firebase-config.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Registrar el Service Worker para la PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('Service Worker registrado con éxito:', registration))
            .catch(error => console.log('Error al registrar el Service Worker:', error));
    }

    const contentViewer = document.getElementById('content-viewer');
    const screenNameEl = document.getElementById('screen-name');

    const params = new URLSearchParams(window.location.search);
    const screenId = params.get('id');

    if (!screenId) {
        screenNameEl.textContent = "Error";
        contentViewer.innerHTML = `<p class="text-center text-red-500">No se ha especificado una pantalla.</p>`;
        return;
    }

    const screenRef = doc(db, 'screens', screenId);

    onSnapshot(screenRef, async (screenSnap) => {
        if (!screenSnap.exists() || !screenSnap.data().qrEnabled) {
            screenNameEl.textContent = "Contenido no disponible";
            contentViewer.innerHTML = `<p class="text-center text-gray-500">Este contenido no está disponible o ha sido desactivado.</p>`;
            return;
        }

        const screenData = screenSnap.data();
        screenNameEl.textContent = screenData.name;
        document.title = screenData.name; // Actualiza el título de la página

        const mediaIds = screenData.qrCodeItems || [];
        contentViewer.innerHTML = ''; // Limpia el contenido anterior

        if (mediaIds.length === 0) {
            contentViewer.innerHTML = `<p class="text-center text-gray-500">No hay contenido para mostrar.</p>`;
            return;
        }

        for (const mediaId of mediaIds) {
            const mediaRef = doc(db, 'media', mediaId);
            const mediaSnap = await getDoc(mediaRef);
            if (mediaSnap.exists()) {
                const mediaData = mediaSnap.data();
                const img = document.createElement('img');
                img.src = mediaData.url;
                img.alt = mediaData.name;
                img.className = 'w-full h-auto rounded-lg shadow-md';
                contentViewer.appendChild(img);
            }
        }
    });
});