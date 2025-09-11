import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { translations } from './utils/translations.js';

// --- DOM Elements ---
const pairingScreen = document.getElementById('pairing-screen');
const contentScreen = document.getElementById('content-screen');
const pairingCodeInputs = document.getElementById('pairing-code-inputs');
const inputs = pairingCodeInputs.querySelectorAll('.pairing-input');
const pairBtn = document.getElementById('pair-btn');
const messageBox = document.getElementById('player-message-box');

// --- State ---
let currentPlaylistItems = [];
let currentItemIndex = 0;
let unsubscribeScreenListener = null; 
let unsubscribePlaylistListener = null;// Para detener el listener si es necesario

// --- Language Function ---
function setLanguage(lang) {
    // ... (la función setLanguage que ya teníamos)
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
}

// --- Playback Logic ---

// Función principal que inicia la reproducción del contenido
function startContentPlayback(screenId) {
    pairingScreen.classList.add('hidden');
    contentScreen.classList.remove('hidden');

    const screenDocRef = doc(db, 'screens', screenId);

    if (unsubscribeScreenListener) unsubscribeScreenListener();

    // 1. PRIMER LISTENER: Vigila el documento de la PANTALLA
    unsubscribeScreenListener = onSnapshot(screenDocRef, (screenSnap) => {
        // Si el listener de la playlist ya está activo, lo detenemos para reiniciarlo.
        if (unsubscribePlaylistListener) unsubscribePlaylistListener();

        if (!screenSnap.exists()) {
            console.error("Error: La pantalla con este ID fue eliminada. Reiniciando.");
            localStorage.removeItem('nexusplay_screen_id');
            window.location.reload();
            return;
        }

        const playlistId = screenSnap.data().playlistId;

        if (playlistId) {
            const playlistDocRef = doc(db, 'playlists', playlistId);

            // 2. SEGUNDO LISTENER: Vigila el documento de la PLAYLIST asignada
            unsubscribePlaylistListener = onSnapshot(playlistDocRef, (playlistSnap) => {
                if (playlistSnap.exists()) {
                    currentPlaylistItems = playlistSnap.data().items || [];
                    currentItemIndex = 0;

                    if (currentPlaylistItems.length > 0) {
                        console.log("Playlist actualizada. Reiniciando reproducción.");
                        playNextItem();
                    } else {
                        displayMessage("La playlist está vacía.");
                    }
                } else {
                    displayMessage("Error: La playlist asignada no fue encontrada.");
                }
            });
        } else {
            displayMessage("No hay ninguna playlist asignada a esta pantalla.");
        }
    });
}

// Muestra el siguiente item en la lista
function playNextItem() { // Ya no necesita ser 'async'
    if (currentPlaylistItems.length === 0) return;

    // Reinicia el bucle si llegamos al final
    if (currentItemIndex >= currentPlaylistItems.length) {
        currentItemIndex = 0;
    }

    // Obtenemos el objeto completo del item directamente del array
    const itemData = currentPlaylistItems[currentItemIndex];

    // Verificamos que el objeto exista y lo mostramos
    if (itemData) {
        displayMedia(itemData);
    }

    currentItemIndex++;
}

// Muestra un archivo (imagen o video) en la pantalla
function displayMedia(item) {
    contentScreen.innerHTML = ''; // Limpiamos la pantalla

    if (item.type.startsWith('image')) {
        const img = document.createElement('img');
        img.src = item.url;
        img.className = 'w-full h-full object-contain'; // object-contain para que se vea completa
        contentScreen.appendChild(img);
        
        // Esperamos la duración definida y luego pasamos al siguiente item
        const durationInSeconds = item.duration || 10;
        setTimeout(playNextItem, durationInSeconds * 1000);

    } else if (item.type.startsWith('video')) {
        const video = document.createElement('video');
        video.src = item.url;
        video.className = 'w-full h-full object-contain';
        video.autoplay = true;
        video.muted = true; // El autoplay en navegadores a menudo requiere que el video esté silenciado
        
        // Cuando el video termina, pasamos al siguiente item
        video.onended = playNextItem;
        
        contentScreen.appendChild(video);
    }
}

// Función para mostrar mensajes en la pantalla de contenido (ej. errores)
function displayMessage(text) {
    contentScreen.innerHTML = `<div class="w-full h-full flex items-center justify-center text-3xl text-neutral-500">${text}</div>`;
}


// --- Pairing Logic (la que ya teníamos, con una pequeña modificación) ---
inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
        if (input.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
        checkIfAllInputsAreFilled();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

inputs[0].addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace('-', '').trim();
    if (pastedText.length === 6) {
        inputs.forEach((input, index) => {
            input.value = pastedText[index] || '';
        });
        checkIfAllInputsAreFilled();
        pairBtn.focus();
    }
});

function checkIfAllInputsAreFilled() {
    const allFilled = [...inputs].every(input => input.value.length === 1);
    if (allFilled) {
        pairBtn.classList.remove('hidden');
    } else {
        pairBtn.classList.add('hidden');
    }
}

pairBtn.addEventListener('click', async () => {
    const pairingCode = [...inputs].map(input => input.value).join('').toUpperCase();
    const lang = document.documentElement.lang || 'es';

    pairBtn.disabled = true;
    pairBtn.textContent = translations[lang].verifying || "Verificando...";
    messageBox.classList.add('hidden');

    try {
        const screensRef = collection(db, 'screens');
        const q = query(screensRef, where("pairingCode", "==", pairingCode));
        const querySnapshot = await getDocs(q); // Aquí se define querySnapshot

        if (querySnapshot.empty) {
            messageBox.textContent = translations[lang].invalidCode || "Código no válido. Por favor, inténtalo de nuevo.";
            messageBox.classList.remove('hidden', 'bg-emerald-500');
            messageBox.classList.add('bg-red-500');
            
            pairBtn.disabled = false;
            pairBtn.textContent = translations[lang].pairDeviceBtn || "Enlazar Dispositivo";
            inputs.forEach(input => input.value = '');
            inputs[0].focus();

        } else {
            const screenDoc = querySnapshot.docs[0];
            const screenId = screenDoc.id;

            localStorage.setItem('nexusplay_screen_id', screenId);

            const screenDocRef = doc(db, 'screens', screenId);
            await updateDoc(screenDocRef, {
                isPaired: true,
                pairingCode: null 
            });

            // Mostramos el mensaje de éxito y llamamos a la función de reproducción
            messageBox.textContent = translations[lang].pairingSuccess || "¡Dispositivo enlazado con éxito! Cargando contenido...";
            messageBox.classList.remove('hidden', 'bg-red-500');
            messageBox.classList.add('bg-emerald-500');

            setTimeout(() => {
                // Llamamos a la función principal para empezar a mostrar contenido
                startContentPlayback(screenId);
            }, 2000);
        }

    } catch (error) {
        console.error("Error al verificar el código:", error);
        messageBox.textContent = "Error de conexión. Inténtalo de nuevo.";
        messageBox.classList.remove('hidden');
        messageBox.classList.add('bg-red-500');
        pairBtn.disabled = false;
        pairBtn.textContent = translations[lang].pairDeviceBtn || "Enlazar Dispositivo";
    }
});


// --- Initialization ---
function init() {
    const userLang = navigator.language.split('-')[0];
    setLanguage(userLang);

    // Comprobamos si el dispositivo ya está enlazado
    const savedScreenId = localStorage.getItem('nexusplay_screen_id');
    if (savedScreenId) {
        // Si ya lo está, iniciamos la reproducción directamente
        startContentPlayback(savedScreenId);
    } else {
        // Si no, mostramos la pantalla de emparejamiento
        pairingScreen.classList.remove('hidden');
        inputs[0].focus();
    }
}

init();