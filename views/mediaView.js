// Contenido completo para views/mediaView.js

import { db, storage } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';
import { createMediaCard } from '../components/MediaCard.js';

let unsubscribeMedia = null;

// Esta es la función que se exporta y que script.js busca
export function initMediaView(userId, getLang, onUpdateCallback) {
    const fileUploadInput = document.getElementById('file-upload');
    const imagesGallery = document.getElementById('media-gallery-images');
    const videosGallery = document.getElementById('media-gallery-videos');
    const audioGallery = document.getElementById('media-gallery-audio');

    function uploadFile(file) {
        if (!file || !userId) return;
        const storagePath = `media/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-progress-bar');
        progressContainer.classList.remove('hidden');

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressBar.style.width = progress + '%';
            }, 
            (error) => {
                console.error("Error al subir el archivo:", error);
                progressContainer.classList.add('hidden');
                alert("Error al subir el archivo.");
            }, 
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                    await addDoc(collection(db, 'media'), {
                        userId: userId,
                        name: file.name,
                        url: downloadURL,
                        type: file.type,
                        storagePath: storagePath,
                        createdAt: serverTimestamp()
                    });
                    progressContainer.classList.add('hidden');
                    fileUploadInput.value = '';
                });
            }
        );
    }

    function deleteMediaFile(docId, storagePath) {
        deleteObject(ref(storage, storagePath))
            .catch(err => console.log("El archivo en Storage no existía, se procede a borrar el documento.", err))
            .finally(() => {
                deleteDoc(doc(db, "media", docId));
            });
    };

    fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // --- PASO DE DEPURACIÓN ---
    // Vamos a ver qué tipo de archivo nos está dando el navegador
    console.log("Archivo seleccionado:", file);
    console.log("Tipo de archivo detectado:", file.type);
    // --------------------------

    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg', 'audio/wav'];

    if (!allowedTypes.includes(file.type)) {
        // Mostramos el tipo de archivo detectado en el error para saber cuál es
        alert(`Tipo de archivo no permitido (${file.type}). Sube imágenes (jpg, png), videos (mp4) o audio (mp3).`);
        e.target.value = '';
        return;
    }
    
    // --- CORRECCIÓN CLAVE ---
    // Usamos 'userId', que es el parámetro que recibe la función initMediaView.
    // La variable 'currentUserId' no existe en este archivo.
    uploadFile(file); 
});

    const q = query(collection(db, 'media'), where('userId', '==', userId));
    unsubscribeMedia = onSnapshot(q, (snapshot) => {
        const userMediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        
        const images = userMediaData.filter(m => m.type.startsWith('image/'));
        const videos = userMediaData.filter(m => m.type.startsWith('video/'));
        const audio = userMediaData.filter(m => m.type.startsWith('audio/'));

        const renderCategory = (galleryEl, items, noItemsKey) => {
            galleryEl.innerHTML = '';
            if (items.length === 0) {
                galleryEl.innerHTML = `<p class="placeholder-text text-gray-400 col-span-full">${translations[getLang()][noItemsKey]}</p>`;
                return;
            }
            items.forEach(media => {
                const card = createMediaCard(media, {
                    isDraggable: true,
                    onDelete: () => {
                        showConfirmModal(
                            translations[getLang()].confirmDeleteTitle, 
                            `${translations[getLang()].confirmDeleteMsg} "${media.name}"?`,
                            () => deleteMediaFile(media.id, media.storagePath)
                        );
                    }
                });
                galleryEl.appendChild(card);
            });
        };

        renderCategory(imagesGallery, images, 'noImages');
        renderCategory(videosGallery, videos, 'noVideos');
        renderCategory(audioGallery, audio, 'noAudio');

        onUpdateCallback(userMediaData); // Notifica al script principal que los medios han cambiado
    });

    return unsubscribeMedia;
}