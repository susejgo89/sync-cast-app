import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { translations } from './utils/translations.js';
import { WEATHER_API_KEY } from './weather-config.js';

// --- DOM Elements ---
const pairingScreen = document.getElementById('pairing-screen');
const contentScreen = document.getElementById('content-screen');
const pairingCodeInputs = document.getElementById('pairing-code-inputs');
const inputs = pairingCodeInputs.querySelectorAll('.pairing-input');
const pairBtn = document.getElementById('pair-btn');
const messageBox = document.getElementById('player-message-box');

// --- Audio Autoplay Overlay ---
const audioOverlay = document.createElement('div');
audioOverlay.id = 'audio-overlay';
audioOverlay.style.cssText = `
    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.75); color: white;
    display: none; /* Initially hidden */
    flex-direction: column; align-items: center; justify-content: center;
    text-align: center; font-size: 2rem; cursor: pointer; z-index: 10000; padding: 2rem;
`;
audioOverlay.innerHTML = `
    <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 6v12a1 1 0 01-1.707.707L5.586 15z"></path></svg>
    <h3 data-lang="enableAudioTitle">Audio Desactivado</h3>
    <p class="text-lg mt-2" data-lang="enableAudioMsg">Haz click para activar el sonido.</p>
`;
document.body.appendChild(audioOverlay);

function showAudioOverlay() {
    audioOverlay.style.display = 'flex';
    const lang = document.documentElement.lang || 'es';
    const titleEl = audioOverlay.querySelector('[data-lang="enableAudioTitle"]');
    const msgEl = audioOverlay.querySelector('[data-lang="enableAudioMsg"]');
    if (translations[lang]) {
        titleEl.textContent = translations[lang].enableAudioTitle;
        msgEl.textContent = translations[lang].enableAudioMsg;
    }
}

audioOverlay.addEventListener('click', () => {
    audioOverlay.style.display = 'none';
    if (currentMusicPlaylistItems.length > 0 && audioPlayer.paused) {
        playNextMusicItem();
    }
}, { once: true });

// --- Widgets Container ---
const widgetsContainer = document.createElement('div');
widgetsContainer.id = 'widgets-container';
widgetsContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
`;
document.body.appendChild(widgetsContainer);

// --- Clock Widget ---
const clockWidget = document.createElement('div');
clockWidget.id = 'clock-widget';
clockWidget.style.cssText = `
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 10px 20px;
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    text-align: right;
    display: none; /* Initially hidden */
    text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
    transition: opacity 0.5s;
`;
clockWidget.innerHTML = `
    <div id="clock-time" style="font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 700; line-height: 1;"></div>
    <div id="clock-date" style="font-size: clamp(0.75rem, 2vw, 1rem); margin-top: 4px;"></div>
`;
widgetsContainer.appendChild(clockWidget);

function updateClock() {
    const now = new Date();
    const lang = document.documentElement.lang || 'es';
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');

    if (!timeEl || !dateEl) return;

    timeEl.textContent = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false });
    dateEl.textContent = now.toLocaleDateString(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);

// --- Weather Widget ---
const weatherWidget = document.createElement('div');
weatherWidget.id = 'weather-widget';
weatherWidget.style.cssText = `
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 12px 25px;
    border-radius: 12px;
    font-family: 'Inter', sans-serif;
    text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
    transition: opacity 0.5s;
    display: none; /* Initially hidden, will be flex */
    align-items: center;
    gap: 15px;
`;
widgetsContainer.appendChild(weatherWidget);

let weatherInterval = null;

async function updateWeather(location, lang) {
    if (!location || !WEATHER_API_KEY || WEATHER_API_KEY === 'TU_API_KEY_DE_OPENWEATHERMAP') {
        weatherWidget.style.display = 'none';
        return;
    }

    // Mapea el idioma de la app al que entiende la API del clima
    const apiLang = lang === 'pt' ? 'pt_br' : lang;

    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${WEATHER_API_KEY}&units=metric&lang=${apiLang}`);
        if (!response.ok) {
            if (response.status === 401) {
                const errorMsg = translations[lang]?.weatherApiUnauthorized || "Error 401: API Key no válida o inactiva. Revisa tu clave y espera unas horas si es nueva.";
                throw new Error(errorMsg); // Lanzamos un error más descriptivo
            }
            throw new Error(`Weather API response not OK: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        weatherWidget.innerHTML = `
            <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="${data.weather[0].description}" style="width: 60px; height: 60px; filter: drop-shadow(0 0 4px rgba(0,0,0,0.6));">
            <div>
                <div style="font-size: 2.2rem; font-weight: 700; line-height: 1;">${Math.round(data.main.temp)}°C</div>
                <div style="font-size: 1rem; text-transform: capitalize; margin-top: 4px;">${data.weather[0].description}</div>
            </div>
        `;
        weatherWidget.style.display = 'flex';
    } catch (error) {
        console.error("Error al obtener el clima:", error.message);
        weatherWidget.style.display = 'none'; // Oculta el widget si hay un error
    }
}

// --- News Widget (RSS) ---
const newsWidget = document.createElement('div');
newsWidget.id = 'news-widget';
newsWidget.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.85); /* Blanco semitransparente (más opaco) */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px); /* Para Safari */
    color: #1f2937; /* Gris más oscuro para mejor contraste */
    padding: 12px 25px;
    font-family: 'Inter', sans-serif;
    text-shadow: none;
    transition: opacity 0.5s;
    display: none; /* Initially hidden, will be flex */
    align-items: center;
    z-index: 1000;
    border-top: 1px solid rgba(255, 255, 255, 0.2); /* Borde superior translúcido */
    box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.1); /* Sombra superior para definir el borde */
`;
newsWidget.innerHTML = `
    <h4 id="news-widget-title" style="
        background-color: #7c3aed;
        color: white;
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        margin-right: 15px;
        text-transform: uppercase;
        flex-shrink: 0;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        border-bottom: 2px solid #6d28d9;
    "></h4>
    <div id="news-content" style="font-size: 1.2rem; font-weight: 500; overflow: hidden; white-space: nowrap; flex-grow: 1;">
        <span id="news-ticker-item" style="transition: opacity 0.4s ease-in-out; opacity: 1;">Cargando noticias...</span>
    </div>
`;
document.body.appendChild(newsWidget);

let newsIntervals = { fetch: null, rotate: null };

function handleNewsWidget(settings) {
    const { show, url, limit = 5, speed = 7 } = settings;

    // Limpiamos cualquier intervalo anterior
    clearInterval(newsIntervals.fetch);
    clearInterval(newsIntervals.rotate);
    newsIntervals.rotate = null; // Resetea el tracker de rotación

    if (!show || !url) {
        newsWidget.style.display = 'none';
        return;
    }
    newsWidget.style.display = 'flex';

    // Actualizamos el título del widget con la traducción correcta
    const widgetTitleEl = document.getElementById('news-widget-title');
    if (widgetTitleEl) {
        const lang = document.documentElement.lang || 'es';
        widgetTitleEl.textContent = translations[lang]?.newsWidgetDefaultTitle || 'Últimas Noticias';
    }

    // Resetea el texto a "Cargando..." cada vez que se activa
    const tickerItem = document.getElementById('news-ticker-item');
    if (tickerItem) {
        tickerItem.textContent = "Cargando noticias...";
    }

    let newsItems = [];
    let currentNewsIndex = -1;

    const fetchAndParseRss = async () => {
        const lang = document.documentElement.lang || 'es';
        // Lista de proxies. Si uno falla, intentará con el siguiente.
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://thingproxy.freeboard.io/fetch/${url}`
        ];

        try {
            let response;
            let data;

            // Intenta con el primer proxy, si falla, intenta con el segundo.
            try {
                response = await fetch(proxies[0]);
                if (!response.ok) throw new Error('Primer proxy falló');
                data = await response.json();
            } catch (e) {
                response = await fetch(proxies[1]);
                data = await response.json(); // thingproxy no envuelve en 'contents'
            }
            
            const contents = data.contents || data; // allorigins usa 'contents', thingproxy no.
            if (!contents) throw new Error("El proxy no devolvió contenido.");

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contents, "application/xml");

            const parseError = xmlDoc.querySelector("parsererror");
            if (parseError) {
                console.error("Error al parsear el XML del RSS:", parseError.textContent);
                throw new Error("InvalidXML"); // Custom error para capturarlo abajo
            }

            // Buscamos <item> (RSS) y si no, <entry> (Atom) para mayor compatibilidad
            let items = Array.from(xmlDoc.querySelectorAll("item"));
            if (items.length === 0) {
                items = Array.from(xmlDoc.querySelectorAll("entry"));
            }
            
            const newNews = items.slice(0, limit).map(item => item.querySelector("title")?.textContent.trim()).filter(Boolean);
            
            newsItems = newNews.length > 0 ? newNews : [translations[lang]?.rssNoNewsInFeed || "No se encontraron noticias en el feed."];
        } catch (error) {
            console.error("Error al obtener o procesar el feed RSS:", error);
            if (error instanceof SyntaxError || error.message === "InvalidXML") {
                newsItems = [translations[lang]?.rssInvalidFormat || "Error: Formato de RSS no válido o URL incorrecta."];
            } else {
                newsItems = [translations[lang]?.rssFetchError || "Error al cargar el feed."];
            }
        } finally {
            // Este bloque se asegura de que la rotación comience, incluso si hubo un error, para mostrar el mensaje.
            if (newsItems.length > 0 && newsIntervals.rotate === null) {
                rotateNews(); // Primera rotación inmediata
                newsIntervals.rotate = setInterval(rotateNews, speed * 1000);
            }
        }
    };

    const rotateNews = () => {
        const tickerItem = document.getElementById('news-ticker-item');
        if (!tickerItem || newsItems.length === 0) return;

        tickerItem.style.opacity = 0;
        setTimeout(() => {
            currentNewsIndex = (currentNewsIndex + 1) % newsItems.length;
            tickerItem.textContent = newsItems[currentNewsIndex];
            tickerItem.style.opacity = 1;
        }, 400); // Coincide con la duración de la transición
    };

    fetchAndParseRss(); // Primera llamada
    newsIntervals.fetch = setInterval(fetchAndParseRss, 30 * 60 * 1000); // Refresca cada 30 mins
}

// --- QR Code Widget ---
const qrCodeWidget = document.createElement('div');
qrCodeWidget.id = 'qr-code-widget';
qrCodeWidget.style.cssText = `
    position: fixed;
    bottom: 120px; /* Aumentado para no superponerse con el widget de noticias */
    left: 20px;
    background-color: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    display: none; /* Initially hidden */
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 1000;
`;
qrCodeWidget.innerHTML = `
    <div id="player-qrcode"></div>
    <p id="qr-code-text" style="font-weight: 600; color: #374151; text-align: center;"></p>
`;
document.body.appendChild(qrCodeWidget);

function handleQrCodeWidget(screenId, settings) {
    const { show, enabled, text } = settings;
    const lang = document.documentElement.lang || 'es';
    const qrContainer = document.getElementById('player-qrcode');

    if (show && enabled) {
        qrContainer.innerHTML = ''; // Limpia el QR anterior para evitar duplicados
        new QRCode(qrContainer, { text: `${window.location.origin}/viewer.html?screenId=${screenId}`, width: 128, height: 128 });no 
        
        // Usa el texto personalizado si existe, si no, usa el de las traducciones.
        const displayText = text && text.trim() !== '' ? text : (translations[lang]?.scanForMenu || "Escanea para más info");
        document.getElementById('qr-code-text').textContent = displayText;
        qrCodeWidget.style.display = 'flex';
    } else {
        qrCodeWidget.style.display = 'none';
    }
}

// --- State ---
let currentPlaylistItems = [];
let currentItemIndex = 0;
let unsubscribeScreenListener = null; 
let unsubscribePlaylistListener = null;
let unsubscribeMusicPlaylistListener = null; // Listener para la playlist de música
let currentVisualPlaylistId = null; 
let scheduleCheckInterval = null;
let currentMusicPlaylistId = null;

let currentMusicPlaylistItems = [];
let currentMusicItemIndex = 0;
const audioPlayer = new Audio(); // Nuestro reproductor de música dedicado
audioPlayer.loop = false; // El bucle lo manejaremos con código

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

/**
 * Reinicia el estado del reproductor, lo limpia y lo devuelve a la pantalla de emparejamiento.
 */
function resetPlayer() {
    console.log("Pantalla eliminada o inválida. Reiniciando a la pantalla de emparejamiento.");
    
    // Detenemos cualquier listener para que no intente reconectar
    if (unsubscribeScreenListener) unsubscribeScreenListener();
    if (unsubscribePlaylistListener) unsubscribePlaylistListener();
    if (unsubscribeMusicPlaylistListener) unsubscribeMusicPlaylistListener();

    // Limpiamos el ID guardado y recargamos la página.
    localStorage.removeItem('nexusreplay_screen_id');    
    window.location.replace(window.location.origin + window.location.pathname); // Método más robusto para recargar
}

async function playNextMusicItem() {
    if (currentMusicPlaylistItems.length === 0) {
        audioPlayer.pause();
        return;
    }
    if (currentMusicItemIndex >= currentMusicPlaylistItems.length) {
        currentMusicItemIndex = 0; // Reinicia el bucle
    }

    const itemId = currentMusicPlaylistItems[currentMusicItemIndex];
    currentMusicItemIndex++; // Incrementa para la siguiente llamada

    if (!itemId) {
        // Si el item es inválido, salta al siguiente
        playNextMusicItem();
        return;
    }

    try {
        const mediaDoc = await getDoc(doc(db, 'media', itemId));
        if (mediaDoc.exists()) {
            audioPlayer.src = mediaDoc.data().url;
            // El evento 'onended' se encargará de llamar a la siguiente canción
            await audioPlayer.play();
        } else {
            console.warn(`Audio con ID ${itemId} no encontrado. Saltando.`);
            // Si el audio no existe, intenta reproducir el siguiente inmediatamente
            playNextMusicItem();
        }
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            console.warn("La reproducción automática de audio fue bloqueada. Esperando interacción del usuario.");
            showAudioOverlay();
        } else {
            console.error("Error al intentar reproducir audio:", error);
            setTimeout(playNextMusicItem, 1000);
        }
    }
}
audioPlayer.onended = playNextMusicItem;

// --- Playback Logic ---

// Función principal que inicia la reproducción del contenido
function startContentPlayback(screenId) {
    pairingScreen.classList.add('hidden');
    contentScreen.classList.remove('hidden');
    const screenDocRef = doc(db, 'screens', screenId);
    if (unsubscribeScreenListener) unsubscribeScreenListener();

    unsubscribeScreenListener = onSnapshot(screenDocRef, (screenSnap) => {
        if (!screenSnap.exists()) {
            resetPlayer(); // La pantalla fue eliminada, reiniciamos el reproductor.
            return;
        }

        const screenData = screenSnap.data();

        // --- Controlar Widget de QR ---
        handleQrCodeWidget(screenId, { show: screenData.showQrOnPlayer, enabled: screenData.qrEnabled, text: screenData.qrCodeText });

        // --- Controlar Widget de Noticias ---
        handleNewsWidget({ show: screenData.showNews, url: screenData.newsRssUrl, limit: screenData.newsLimit, speed: screenData.newsSpeed });

        // Controlar visibilidad del reloj
        if (clockWidget) {
            clockWidget.style.display = screenData.showClock ? 'block' : 'none';
        }

        // --- Controlar visibilidad y actualización del Clima ---
        if (weatherInterval) {
            clearInterval(weatherInterval);
            weatherInterval = null;
        }
        if (screenData.showWeather && screenData.weatherLocation) {
            const lang = document.documentElement.lang || 'es';
            updateWeather(screenData.weatherLocation, lang); // Primera llamada inmediata
            // Actualiza el clima cada 30 minutos
            weatherInterval = setInterval(() => updateWeather(screenData.weatherLocation, lang), 1800000); 
        } else {
            weatherWidget.style.display = 'none';
        }
        
        // --- LÓGICA DE PROGRAMACIÓN (CON GRUPOS Y HORARIOS) ---
        clearInterval(scheduleCheckInterval); // Limpia el intervalo anterior

        const checkSchedule = () => {
            const now = new Date();
            const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
            const currentTime = now.toTimeString().slice(0, 5);

            let finalVisualPlaylistId;
            let finalMusicPlaylistId;

            // JERARQUÍA 1: La pantalla está gestionada por un grupo.
            if (screenData.managedByGroup) {
                // Prioridad 1.1: Regla de horario del grupo.
                if (screenData.schedulingMode === 'advanced' && screenData.scheduleRules) {
                    const activeRule = screenData.scheduleRules.find(r => r.days.includes(dayOfWeek) && currentTime >= r.startTime && currentTime < r.endTime);
                    if (activeRule) {
                        finalVisualPlaylistId = activeRule.playlistId || null;
                        finalMusicPlaylistId = activeRule.musicPlaylistId || null;
                    } else {
                        // Si no hay regla activa, usa la configuración simple del grupo.
                        finalVisualPlaylistId = screenData.playlistId;
                        finalMusicPlaylistId = screenData.musicPlaylistId;
                    }
                } else {
                    // Prioridad 1.2: Configuración simple del grupo.
                    finalVisualPlaylistId = screenData.playlistId;
                    finalMusicPlaylistId = screenData.musicPlaylistId;
                }
            } else {
                // JERARQUÍA 2: La pantalla se gestiona individualmente.
                finalVisualPlaylistId = screenData.playlistId; // Por defecto, la simple.
                finalMusicPlaylistId = screenData.musicPlaylistId; // Por defecto, la simple.

                // Prioridad 2.1: Reglas de horario individuales.
                if (screenData.visualSchedulingMode === 'advanced' && screenData.visualScheduleRules) {
                    const activeRule = screenData.visualScheduleRules.find(r => r.days.includes(dayOfWeek) && currentTime >= r.startTime && currentTime < r.endTime);
                    if (activeRule) finalVisualPlaylistId = activeRule.playlistId || null;
                }
                if (screenData.musicSchedulingMode === 'advanced' && screenData.musicScheduleRules) {
                    const activeRule = screenData.musicScheduleRules.find(r => r.days.includes(dayOfWeek) && currentTime >= r.startTime && currentTime < r.endTime);
                    if (activeRule) finalMusicPlaylistId = activeRule.musicPlaylistId || null;
                }
            }

            // Cargar las playlists si han cambiado
            if (finalVisualPlaylistId !== currentVisualPlaylistId) {
                loadVisualPlaylist(finalVisualPlaylistId);
            }
            if (finalMusicPlaylistId !== currentMusicPlaylistId) {
                loadMusicPlaylist(finalMusicPlaylistId);
            }
        };

        checkSchedule();
        scheduleCheckInterval = setInterval(checkSchedule, 60000);
    });
}

function loadVisualPlaylist(playlistId) {
    currentVisualPlaylistId = playlistId;
    if (unsubscribePlaylistListener) unsubscribePlaylistListener();

    if (playlistId) {
        const playlistDocRef = doc(db, 'playlists', playlistId);
        unsubscribePlaylistListener = onSnapshot(playlistDocRef, (playlistSnap) => {
            if (playlistSnap.exists()) {
                currentPlaylistItems = playlistSnap.data().items || [];
                currentItemIndex = 0;
                playNextItem();
            } else {
                displayMessage("Error: La playlist visual no fue encontrada.");
            }
        });
    } else {
        currentPlaylistItems = [];
        playNextItem(); // Esto mostrará el mensaje de "No hay playlist asignada"
    }
}

function loadMusicPlaylist(playlistId) {
    currentMusicPlaylistId = playlistId;
    if (unsubscribeMusicPlaylistListener) unsubscribeMusicPlaylistListener();

    if (playlistId) {
        const musicPlaylistDocRef = doc(db, 'musicPlaylists', playlistId);
        unsubscribeMusicPlaylistListener = onSnapshot(musicPlaylistDocRef, (musicPlaylistSnap) => {
            if (musicPlaylistSnap.exists()) {
                currentMusicPlaylistItems = musicPlaylistSnap.data().items || [];
                currentMusicItemIndex = 0;
                playNextMusicItem();
            } else {
                audioPlayer.pause();
                currentMusicPlaylistItems = [];
            }
        });
    } else {
        audioPlayer.pause();
        currentMusicPlaylistItems = [];
    }
}

// Muestra el siguiente item en la lista
function playNextItem() { // Ya no necesita ser 'async'
    if (currentPlaylistItems.length === 0) {
        // Si la lista está vacía, muestra un mensaje y termina.
        displayMessage("No hay ninguna playlist visual asignada.");
        return;
    }

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
    contentScreen.innerHTML = ''; 

    if (item.type.startsWith('image')) {
        // Si la música estaba en pausa (ej. por un video anterior) y hay una playlist, la reanudamos.
        if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
            audioPlayer.volume = 1; // Nos aseguramos que el volumen esté al máximo.
            audioPlayer.play().catch(e => {
                // Si el error es por autoplay, el overlay ya debería estar visible.
                if (e.name !== 'NotAllowedError') {
                    console.error("Error al reanudar audio para imagen:", e);
                }
            });
        } else {
            // Si no estaba en pausa, solo nos aseguramos de que el volumen esté al máximo.
            audioPlayer.volume = 1;
        }

        const img = document.createElement('img');
        img.src = item.url;
        img.className = 'w-full h-full object-contain';
        contentScreen.appendChild(img);
        
        const durationInSeconds = item.duration || 10;
        setTimeout(playNextItem, durationInSeconds * 1000);

    } else if (item.type.startsWith('video')) {
        // Pausamos la música de fondo para dar prioridad al audio del video.
        if (!audioPlayer.paused) {
            audioPlayer.pause();
        }

        const video = document.createElement('video');
        // Añadimos un parámetro único para evitar errores de caché del navegador (net::ERR_CACHE_OPERATION_NOT_SUPPORTED)
        video.src = `${item.url}&_cacheBust=${new Date().getTime()}`;
        video.className = 'w-full h-full object-contain';
        video.autoplay = true;
        video.muted = false; // Permitimos el sonido del video
        
        const resumeMusicAndPlayNext = () => {
            if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
                audioPlayer.play().catch(e => console.error("Error al reanudar audio:", e));
            }
            playNextItem();
        };
        
        video.onended = resumeMusicAndPlayNext;
        video.onerror = () => {
            console.error("Error al cargar o reproducir el video:", item.url);
            resumeMusicAndPlayNext(); // Si hay un error, también reanudamos y pasamos al siguiente.
        };
        
        contentScreen.appendChild(video);

    } else if (item.type === 'weather') {
        // Si hay música de fondo, la reanudamos si estaba pausada.
        if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
            audioPlayer.play().catch(e => console.error("Error al reanudar audio para clima:", e));
        }

        const weatherContainer = document.createElement('div');
        weatherContainer.className = 'w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600 text-white p-8';
        weatherContainer.innerHTML = `<div class="text-3xl font-light">Cargando pronóstico...</div>`;
        contentScreen.appendChild(weatherContainer);

        const fetchAndDisplayWeather = async () => {
            let location = item.location; // Prioridad 1: la ubicación del propio item.

            // Si el item no tiene ubicación, usamos la de la pantalla como alternativa.
            if (!location) {
                const screenDocRef = doc(db, 'screens', localStorage.getItem('nexusplay_screen_id'));
                const screenSnap = await getDoc(screenDocRef);
                if (screenSnap.exists()) {
                    location = screenSnap.data().weatherLocation;
                }
            }

            const lang = document.documentElement.lang || 'es';
            if (!location || !WEATHER_API_KEY || WEATHER_API_KEY === 'TU_API_KEY_DE_OPENWEATHERMAP') {
                weatherContainer.innerHTML = `<div class="text-3xl font-light">Ubicación no configurada.</div>`; // Mensaje de error
                return;
            }

            try {
                const apiLang = lang === 'pt' ? 'pt_br' : lang;
                const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${WEATHER_API_KEY}&units=metric&lang=${apiLang}`);
                if (!response.ok) throw new Error('No se pudo obtener el pronóstico.');
                const data = await response.json();

                // Pronóstico por horas (primeras 5 predicciones, cada 3 horas)
                const hourlyForecast = data.list.slice(0, 5).map(forecast => `
                    <div class="text-center p-2 bg-white/10 rounded-lg">
                        <p class="text-lg">${new Date(forecast.dt * 1000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</p>
                        <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}.png" alt="${forecast.weather[0].description}" class="mx-auto">
                        <p class="font-bold text-xl">${Math.round(forecast.main.temp)}°</p>
                    </div>
                `).join('');

                // Pronóstico por días (agrupando por día y tomando el mediodía)
                const dailyForecasts = {};
                data.list.forEach(forecast => {
                    const date = new Date(forecast.dt * 1000).toLocaleDateString(lang, { weekday: 'long' });
                    if (!dailyForecasts[date] && new Date(forecast.dt * 1000).getHours() >= 12) {
                        dailyForecasts[date] = forecast;
                    }
                });

                const dailyForecast = Object.values(dailyForecasts).slice(1, 6).map(forecast => `
                    <div class="flex justify-between items-center p-2 bg-white/10 rounded-lg">
                        <p class="text-lg w-1/3">${new Date(forecast.dt * 1000).toLocaleDateString(lang, { weekday: 'short' })}</p>
                        <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}.png" alt="${forecast.weather[0].description}" class="w-10 h-10">
                        <p class="font-bold text-lg w-1/3 text-right">${Math.round(forecast.main.temp_max)}° / ${Math.round(forecast.main.temp_min)}°</p>
                    </div>
                `).join('');

                weatherContainer.innerHTML = `
                    <div class="w-full max-w-4xl mx-auto">
                        <h2 class="text-4xl font-bold mb-6 text-center">Pronóstico para ${data.city.name}</h2>
                        <div class="grid grid-cols-5 gap-4 mb-8">
                            ${hourlyForecast}
                        </div>
                        <div class="space-y-2">
                            ${dailyForecast}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error("Error al mostrar pronóstico completo:", error);
                weatherContainer.innerHTML = `<div class="text-3xl font-light">No se pudo cargar el pronóstico.</div>`;
            }
        };

        fetchAndDisplayWeather();
        const durationInSeconds = item.duration || 15;
        setTimeout(playNextItem, durationInSeconds * 1000);

    } else if (item.type === 'clock') {
        // Si hay música de fondo, la reanudamos si estaba pausada.
        if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
            audioPlayer.play().catch(e => console.error("Error al reanudar audio para reloj:", e));
        }

        const clockContainer = document.createElement('div');
        clockContainer.className = 'w-full h-full flex flex-col items-center justify-center bg-black text-white p-8';
        
        clockContainer.innerHTML = `
            <div class="font-bold text-8xl md:text-9xl tracking-wider" id="fullscreen-clock-time"></div>
            <div class="font-medium text-2xl md:text-3xl mt-4" id="fullscreen-clock-date"></div>
        `;
        contentScreen.appendChild(clockContainer);

        const updateFullscreenClock = () => {
            const timeEl = document.getElementById('fullscreen-clock-time');
            const dateEl = document.getElementById('fullscreen-clock-date');
            if (!timeEl || !dateEl) return;

            const now = new Date();
            const options = { hour: '2-digit', minute: '2-digit', hour12: false };
            if (item.timezone && item.timezone !== 'local') {
                options.timeZone = item.timezone;
            }
            timeEl.textContent = now.toLocaleTimeString('es-ES', options); // Usamos un locale neutro para el formato
            dateEl.textContent = now.toLocaleDateString(document.documentElement.lang || 'es', { weekday: 'long', day: 'numeric', month: 'long' });
        };

        updateFullscreenClock(); // Primera llamada
        const durationInSeconds = item.duration || 10;
        setTimeout(playNextItem, durationInSeconds * 1000);

    } else if (item.type === 'qrcode') {
        // Si hay música de fondo, la reanudamos si estaba pausada.
        if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
            audioPlayer.play().catch(e => console.error("Error al reanudar audio para QR:", e));
        }

        const qrContainer = document.createElement('div');
        qrContainer.className = 'w-full h-full flex flex-col items-center justify-center bg-white text-gray-800 p-8';
        
        const qrCodeEl = document.createElement('div');
        const qrTextEl = document.createElement('p');
        qrTextEl.className = 'text-3xl md:text-4xl font-semibold mt-8 text-center';

        qrContainer.append(qrCodeEl, qrTextEl);
        contentScreen.appendChild(qrContainer);

        const screenId = localStorage.getItem('nexusplay_screen_id');
        if (screenId) {
            const qrTargetUrl = (item.qrType === 'url' && item.qrUrl)
                ? item.qrUrl
                : `${window.location.origin}/viewer.html?qrMenuId=${item.qrMenuId}`;

            new QRCode(qrCodeEl, {
                text: qrTargetUrl,
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
            });

            qrTextEl.textContent = item.text || (translations[document.documentElement.lang || 'es']?.scanForMenu || "Escanea para más info");
        }

        const durationInSeconds = item.duration || 15;
        setTimeout(playNextItem, durationInSeconds * 1000);

    } else if (item.type === 'youtube' || item.type === 'iframe') {
        // Si hay música de fondo, la pausamos para dar prioridad a la web/video.
        if (!audioPlayer.paused) {
            audioPlayer.pause();
        }

        const iframe = document.createElement('iframe');
        iframe.src = item.url;
        // Añadimos atributos de seguridad y para permitir autoplay
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.className = 'w-full h-full';

        contentScreen.appendChild(iframe);

        // Pasamos al siguiente item después de la duración especificada
        const durationInSeconds = item.duration || 15; // 15 segundos por defecto
        setTimeout(playNextItem, durationInSeconds * 1000);
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
        const querySnapshot = await getDocs(q);

        let isValid = false;
        let screenId = null;
        let screenDocRef = null;

        if (!querySnapshot.empty) {
            const screenDoc = querySnapshot.docs[0];
            // Comprobamos si la pantalla encontrada NO está ya enlazada
            if (!screenDoc.data().isPaired) {
                isValid = true;
                screenId = screenDoc.id;
                screenDocRef = doc(db, 'screens', screenId);
            }
        }

        if (!isValid) {
            // El código no existe, o si existe, la pantalla ya está enlazada.
            messageBox.textContent = translations[lang].invalidCode;
            messageBox.classList.remove('hidden', 'bg-emerald-500');
            messageBox.classList.add('bg-red-500');
            
            pairBtn.disabled = false;
            pairBtn.textContent = translations[lang].pairDeviceBtn;
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
        } else {
            // ¡Éxito! La pantalla es válida y no está enlazada.
            localStorage.setItem('nexusreplay_screen_id', screenId);

            await updateDoc(screenDocRef, {
                isPaired: true
            });

            messageBox.textContent = translations[lang].pairingSuccess;
            messageBox.classList.remove('hidden', 'bg-red-500');
            messageBox.classList.add('bg-emerald-500');

            setTimeout(() => {
                // 1. Inicia la reproducción del contenido.
                startContentPlayback(screenId);
                // 2. Inicia el "heartbeat" inmediatamente.
                sendHeartbeat(screenId);
                setInterval(() => sendHeartbeat(screenId), 60000);
            }, 2000);
        }
    } catch (error) {
        console.error("Error al verificar el código:", error);
        messageBox.textContent = "Error de conexión. Inténtalo de nuevo.";
        messageBox.classList.remove('hidden');
        messageBox.classList.add('bg-red-500');
        pairBtn.disabled = false;
        pairBtn.textContent = translations[lang].pairDeviceBtn;
    }
});


// --- Heartbeat Logic ---
// Esta función envía una señal a la base de datos para indicar que la pantalla está online.
function sendHeartbeat(screenId) {
    if (!screenId) return;
    const screenRef = doc(db, 'screens', screenId);
    // Actualizamos el campo 'lastSeen' con la hora actual del servidor
    updateDoc(screenRef, { lastSeen: serverTimestamp() })
        .catch(err => console.error("Error al enviar heartbeat:", err));
}

// --- Initialization ---
function init() {
    const userLang = navigator.language.split('-')[0];
    setLanguage(userLang);

    // Comprobamos si el dispositivo ya está enlazado
    const savedScreenId = localStorage.getItem('nexusreplay_screen_id');
    if (savedScreenId) {
        // Si ya lo está, iniciamos la reproducción directamente
        // Si ya está enlazado, iniciamos la reproducción Y el heartbeat
        startContentPlayback(savedScreenId);
        
        // Enviamos un primer latido de inmediato
        sendHeartbeat(savedScreenId); 
        // Y luego programamos que se envíe uno cada 60 segundos
        setInterval(() => sendHeartbeat(savedScreenId), 60000); 

    } else {
        // Si no, mostramos la pantalla de emparejamiento
        pairingScreen.classList.remove('hidden');
        if(inputs[0]) inputs[0].focus();
    }
}

init();