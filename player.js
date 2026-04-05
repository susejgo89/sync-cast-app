import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { translations } from './utils/translations.js';
import { WEATHER_API_KEY } from './weather-config.js';

// --- DOM Elements ---
const pairingScreen = document.getElementById('pairing-screen');
const contentScreen = document.getElementById('content-screen');
// --- Inject Responsive Styles for Widgets ---
const widgetStyles = document.createElement('style');
widgetStyles.textContent = `
    .player-widget {
        position: fixed;
        left: 0;
        right: 0;
        width: 100%;
        display: none;
        align-items: center;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
        transition: bottom 0.3s ease;
    }
    #news-widget {
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #1f2937;
        padding: 12px 25px;
        z-index: 1000;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.05);
        height: 60px;
    }
    #currency-widget {
        bottom: 0;
        background-color: rgba(17, 24, 39, 0.95);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: white;
        padding: 8px 25px;
        z-index: 999;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        height: 50px;
    }
    .widget-title {
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        margin-right: 15px;
        text-transform: uppercase;
        flex-shrink: 0;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    .widget-content {
        font-weight: 500;
        overflow: hidden;
        white-space: nowrap;
        flex-grow: 1;
    }
    #news-content { font-size: 1.2rem; }
    #currency-content { font-size: 1.1rem; }

    /* Aseguramos que los items sean bloques para poder medir su ancho y animarlos */
    #news-item, #currency-item {
        display: inline-block;
        white-space: nowrap;
        padding-right: 50px; /* Margen extra para asegurar el scroll */
    }

    /* --- Portrait Mode (Vertical Screens) --- */
    @media (orientation: portrait) {
        #news-widget {
            height: 90px;
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 20px;
            justify-content: center;
        }
        #currency-widget {
            height: 80px;
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 20px;
            justify-content: center;
        }
        .widget-title {
            margin-right: 0;
            margin-bottom: 8px;
            font-size: 0.8rem;
            padding: 4px 12px;
            align-self: flex-start;
        }
        .widget-content {
            width: 100%;
        }
        #news-content { font-size: 1.1rem; }
        #currency-content { font-size: 1rem; }
    }

    /* --- Animación de Desplazamiento (Marquee) --- */
    .scrolling-content {
        display: inline-block;
        will-change: transform; /* Optimización de rendimiento */
        animation-name: marquee;
        animation-timing-function: linear;
        animation-iteration-count: 1;
        animation-fill-mode: forwards; /* Mantiene la posición final al terminar */
        transform: translateZ(0); /* Fuerza aceleración por GPU */
        backface-visibility: hidden;
    }
    @keyframes marquee {
        0% { transform: translateX(0); }
        20% { transform: translateX(0); } /* Pausa inicial para leer el principio */
        100% { transform: translateX(var(--scroll-offset)); } /* Se mueve hasta el final */
    }

    /* --- NUEVAS TRANSICIONES DE MEDIOS --- */
    .media-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        will-change: transform, opacity;
        background-color: black; /* Evita fondos blancos en transiciones */
    }

    /* Tipo 1: Fade (Desvanecimiento) */
    .anim-fade-enter { opacity: 0; z-index: 20; }
    .anim-fade-enter-active { opacity: 1; transition: opacity 1.2s ease-in-out; }
    .anim-fade-exit { opacity: 1; z-index: 10; }
    .anim-fade-exit-active { opacity: 0; transition: opacity 1.2s ease-in-out; }

    /* Tipo 2: Slide (Deslizamiento) */
    .anim-slide-enter { transform: translateX(100%); z-index: 20; }
    .anim-slide-enter-active { transform: translateX(0); transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .anim-slide-exit { transform: translateX(0); z-index: 10; }
    .anim-slide-exit-active { transform: translateX(-30%); opacity: 0.5; transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s; }

    /* Tipo 3: Zoom (Escala) */
    .anim-zoom-enter { transform: scale(1.1); opacity: 0; z-index: 20; }
    .anim-zoom-enter-active { transform: scale(1); opacity: 1; transition: transform 1.5s ease-out, opacity 1.5s ease-out; }
    .anim-zoom-exit { transform: scale(1); opacity: 1; z-index: 10; }
    .anim-zoom-exit-active { transform: scale(1.05); opacity: 0; transition: transform 1.5s ease-in, opacity 1.5s ease-in; }
`;
document.head.appendChild(widgetStyles);

const pairingCodeInputs = document.getElementById('pairing-code-inputs');
const inputs = pairingCodeInputs.querySelectorAll('.pairing-input');
const pairBtn = document.getElementById('pair-btn');
const messageBox = document.getElementById('player-message-box');
const loader = document.getElementById('loader');

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
        playNextMusicItem(); // Reanuda la música de fondo si estaba pausada
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

// --- News Widget ---
const newsWidget = document.createElement('div');
newsWidget.id = 'news-widget';
newsWidget.className = 'player-widget';
newsWidget.innerHTML = `
    <h4 id="news-widget-title" class="widget-title" style="background-color: #7c3aed; color: white;"></h4>
    <div id="news-content" class="widget-content">
        <span id="news-item" style="transition: opacity 0.4s ease-in-out; opacity: 1;"></span>
    </div>
`;
document.body.appendChild(newsWidget);

// --- Currency Widget ---
const currencyWidget = document.createElement('div');
currencyWidget.id = 'currency-widget';
currencyWidget.className = 'player-widget';
currencyWidget.innerHTML = `
    <h4 id="currency-widget-title" class="widget-title" style="background-color: #059669; color: white;"></h4>
    <div id="currency-content" class="widget-content">
        <span id="currency-item" style="transition: opacity 0.4s ease-in-out; opacity: 1;"></span>
    </div>
`;
document.body.appendChild(currencyWidget);

let newsState = { timeout: null, fetchInterval: null, items: [], index: 0 };
let currencyState = { timeout: null, fetchInterval: null, items: [], index: 0 };

// Helper para posicionar el widget de monedas dinámicamente
function updateCurrencyPosition() {
    const isNewsVisible = newsWidget.style.display !== 'none';
    const isCurrencyVisible = currencyWidget.style.display !== 'none';
    
    if (!isCurrencyVisible) return;

    if (isNewsVisible) {
        const isPortrait = window.matchMedia("(orientation: portrait)").matches;
        // Alturas deben coincidir con el CSS
        const newsHeight = isPortrait ? '90px' : '60px'; 
        currencyWidget.style.bottom = newsHeight;
    } else {
        currencyWidget.style.bottom = '0px';
    }
}

window.addEventListener('resize', updateCurrencyPosition);

async function fetchNewsData(url, limit) {
    const lang = document.documentElement.lang || 'es';
    
    // ESTRATEGIA 1: RSS2JSON (Servicio especializado, muy estable y rápido)
    try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                // RSS2JSON ya nos da el JSON limpio, no hay que parsear XML
                const newsItems = data.items.map(item => item.title.trim()).filter(Boolean);
                return newsItems.slice(0, limit);
            }
        }
    } catch (e) {
        console.warn("RSS2JSON failed, trying fallback...", e);
    }

    // ESTRATEGIA 2: AllOrigins (Fallback) con caché desactivado
    try {
        // Añadimos disableCache=true para evitar que guarde errores durante tus pruebas
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&disableCache=true`);
        if (response.ok) {
            const data = await response.json();
            const contents = data.contents;
            if (contents) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(contents, "application/xml");
                if (!xmlDoc.querySelector("parsererror")) {
                    let items = Array.from(xmlDoc.querySelectorAll("item"));
                    if (items.length === 0) items = Array.from(xmlDoc.querySelectorAll("entry"));
                    
                    const newsItems = items.map(item => item.querySelector("title")?.textContent.trim()).filter(Boolean);
                    if (newsItems.length > 0) return newsItems.slice(0, limit);
                }
            }
        }
    } catch (e) {
        console.error("AllOrigins failed:", e);
    }

    return [translations[lang]?.rssFetchError || "Error fetching feed."];
}

async function fetchCurrencyData(country) {
    const lang = document.documentElement.lang || 'es';
    const countryMap = {
        'VE': 'VES', 'BR': 'BRL', 'CO': 'COP', 'US': 'USD', 
        'AR': 'ARS', 'PY': 'PYG', 'UY': 'UYU', 'CL': 'CLP', 'MX': 'MXN', 'PE': 'PEN', 'BO': 'BOB'
    };
    const flagMap = { 'USD': '🇺🇸', 'EUR': '🇪🇺', 'PYG': '🇵🇾', 'JPY': '🇯🇵', 'ARS': '🇦🇷', 'BRL': '🇧🇷', 'VES': '🇻🇪', 'COP': '🇨🇴', 'UYU': '🇺🇾', 'CLP': '🇨🇱', 'MXN': '🇲🇽', 'PEN': '🇵🇪', 'BOB': '🇧🇴', 'GBP': '🇬🇧' };
    
    const localCurrency = countryMap[country || 'PY'] || 'USD';
    // Monedas a mostrar. Si la local es USD, mostramos otras.
    let targets = ['USD', 'EUR', 'ARS', 'BRL', 'JPY', 'PYG', 'CLP', 'UYU', 'COP'];
    if (localCurrency === 'USD') targets = ['EUR', 'GBP', 'JPY', 'BRL', 'MXN', 'CAD', 'CNY'];
    
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates) {
            const rates = data.rates;
            const formattedItems = targets
                .filter(c => c !== localCurrency && rates[c])
                .map(curr => {
                    // Valor de 1 unidad extranjera en moneda local
                    const val = rates[localCurrency] / rates[curr];
                    const formattedVal = val > 50 ? Math.round(val).toLocaleString(lang) : val.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return `${flagMap[curr] || '💰'} ${curr}: ${formattedVal}`;
                });
            
            // Devolvemos todas las cotizaciones en una sola cadena para que se muestren juntas
            return formattedItems.length > 0 ? [formattedItems.join('<span style="margin: 0 20px; opacity: 0.4;">|</span>')] : [];
        }
    } catch (e) {
        console.error("Currency Error:", e);
    }
    return [];
}

function handleNewsWidget(settings) {
    const { show, url, limit, speed } = settings;
    
    // Limpieza
    clearTimeout(newsState.timeout);
    clearInterval(newsState.fetchInterval);
    newsState.timeout = null;
    
    if (!show || !url) {
        newsWidget.style.display = 'none';
        updateCurrencyPosition();
        return;
    }
    newsWidget.style.display = 'flex';
    updateCurrencyPosition();
    
    const lang = document.documentElement.lang || 'es';
    const titleEl = document.getElementById('news-widget-title');
    titleEl.textContent = translations[lang]?.newsWidgetDefaultTitle || 'Últimas Noticias';
    
    const refreshNews = async () => {
        newsState.items = await fetchNewsData(url, limit);
        if (!newsState.timeout) startNewsRotation();
    };
    
    refreshNews();
    newsState.fetchInterval = setInterval(refreshNews, 1800000);
    
    const startNewsRotation = () => {
        newsState.index = 0;
        const contentEl = document.getElementById('news-item');
        const containerEl = document.getElementById('news-content');
        
        const rotate = () => {
            if (newsState.items.length === 0) {
                newsState.timeout = setTimeout(rotate, 2000); // Reintentar si no hay noticias
                return;
            }
            
            contentEl.style.opacity = 0;
            contentEl.style.animation = 'none'; // Resetear animación
            contentEl.classList.remove('scrolling-content');
            contentEl.style.transform = 'translateX(0)';

            setTimeout(() => {
                contentEl.textContent = newsState.items[newsState.index];
                contentEl.style.opacity = 1;

                // --- LÓGICA DE ANIMACIÓN POR JAVASCRIPT (WAAPI) ---
                // Esto garantiza que el scroll funcione siempre, sin depender de clases CSS
                const contentWidth = contentEl.scrollWidth;
                const containerWidth = containerEl.clientWidth;

                // Si el texto es más largo que el contenedor, activamos el scroll
                if (contentWidth > containerWidth) {
                    const distance = contentWidth - containerWidth + 20; // Distancia a recorrer + margen
                    
                    // Vinculamos la velocidad de scroll al parámetro 'speed' del usuario.
                    // Si 'speed' es 7 (por defecto), scrollSpeed es 50 px/s. 
                    // Si el usuario pone 14 segundos, scrollSpeed baja a 25 px/s (más lento y legible).
                    const scrollSpeed = 350 / (speed || 7); 
                    const duration = (distance / scrollSpeed) * 1000;
                    
                    // Creamos la animación manualmente
                    const animation = contentEl.animate([
                        { transform: 'translateX(0)' }, 
                        { transform: `translateX(-${distance}px)` }
                    ], {
                        duration: duration,
                        delay: 3000,     // 3s de pausa inicial para poder leer el principio
                        endDelay: 3000,  // 3s de pausa final antes de cambiar a la siguiente
                        easing: 'linear',
                        fill: 'forwards'
                    });

                    animation.onfinish = () => {
                        newsState.index = (newsState.index + 1) % newsState.items.length;
                        rotate(); // Llamada recursiva al terminar
                    };
                } else {
                    // Si cabe en pantalla, solo esperamos el tiempo configurado
                    newsState.timeout = setTimeout(() => {
                        newsState.index = (newsState.index + 1) % newsState.items.length;
                        rotate();
                    }, (speed || 7) * 1000);
                }
            }, 400);
        };
        
        rotate();
    };
}

function handleCurrencyWidget(settings, isNewsVisible) {
    const { show, country } = settings;
    
    // Limpieza
    clearTimeout(currencyState.timeout);
    clearInterval(currencyState.fetchInterval);
    currencyState.timeout = null;
    
    if (!show) {
        currencyWidget.style.display = 'none';
        return;
    }
    currencyWidget.style.display = 'flex';
    updateCurrencyPosition();
    
    const lang = document.documentElement.lang || 'es';
    const titleEl = document.getElementById('currency-widget-title');
    titleEl.textContent = translations[lang]?.currencyWidgetTitle || 'Cotizaciones';
    
    const refreshCurrency = async () => {
        currencyState.items = await fetchCurrencyData(country);
        if (!currencyState.timeout) startCurrencyRotation();
    };
    
    refreshCurrency();
    currencyState.fetchInterval = setInterval(refreshCurrency, 3600000);
    
    const startCurrencyRotation = () => {
        currencyState.index = 0;
        const contentEl = document.getElementById('currency-item');
        const containerEl = document.getElementById('currency-content');
        
        const rotate = () => {
            if (currencyState.items.length === 0) {
                currencyState.timeout = setTimeout(rotate, 2000);
                return;
            }
            
            contentEl.style.opacity = 0;
            contentEl.style.animation = 'none';
            contentEl.classList.remove('scrolling-content');
            contentEl.style.transform = 'translateX(0)';

        setTimeout(() => {
            contentEl.innerHTML = currencyState.items[currencyState.index];
            contentEl.style.opacity = 1;

            const contentWidth = contentEl.scrollWidth;
            const containerWidth = containerEl.clientWidth;

            if (contentWidth > containerWidth) {
                const distance = contentWidth - containerWidth + 20;
                const duration = (distance / 35) * 1000; // 35px/s (Más lento y legible por defecto)

                const animation = contentEl.animate([
                    { transform: 'translateX(0)' },
                    { transform: `translateX(-${distance}px)` }
                ], {
                    duration: duration,
                    delay: 3000,
                    endDelay: 3000,
                    easing: 'linear',
                    fill: 'forwards'
                });

                animation.onfinish = () => {
                    currencyState.index = (currencyState.index + 1) % currencyState.items.length;
                    rotate();
                };
            } else {
                currencyState.timeout = setTimeout(() => {
                    currencyState.index = (currencyState.index + 1) % currencyState.items.length;
                    rotate();
                }, 8000);
            }
        }, 400);
    };
        
        rotate();
    };
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
        new QRCode(qrContainer, { text: `${window.location.origin}/viewer.html?screenId=${screenId}`, width: 128, height: 128 });
        
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
let currentVisualPlaybackId = 0; // NUEVO: Identificador de sesión visual
let unsubscribeScreenListener = null; 
let unsubscribePlaylistListener = null;
let unsubscribeMusicPlaylistListener = null; // Listener para la playlist de música
let currentVisualPlaylistId = null; 
let scheduleCheckInterval = null;
let currentMusicPlaylistId = null;

let currentMusicPlaylistItems = [];
let currentMusicItemIndex = 0;
let currentMusicPlaybackId = 0; // NUEVO: Identificador de sesión musical
const audioPlayer = new Audio(); // Nuestro reproductor de música dedicado
audioPlayer.loop = false; // El bucle lo manejaremos con código
let isVisualAudioActive = false; // "Semáforo" para evitar que la música pise a los videos
let startupAudioBlock = false; // Evita que la música arranque antes del primer video con sonido
let startupBlockInProgress = false; // Indica que estamos esperando al primer contenido visual

const visualContentHasAudio = (item) => {
    if (!item || !item.type) return false;
    const type = item.type;
    return type.startsWith('video') || type === 'youtube' || type === 'iframe';
};

const releaseStartupBlock = () => {
    if (startupBlockInProgress) {
        startupAudioBlock = false;
        startupBlockInProgress = false;
    }
};

// Candado de seguridad absoluto: Si la música intenta reproducirse estando el semáforo en rojo, la pausamos al instante.
audioPlayer.addEventListener('play', () => {
    if (isVisualAudioActive) {
        console.warn("Bloqueo de seguridad: El audio intentó sonar durante un video. Forzando pausa.");
        audioPlayer.pause();
    }
});

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
    currentMusicPlaybackId++;
    const myId = currentMusicPlaybackId;

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
        if (currentMusicPlaybackId === myId) playNextMusicItem();
        return;
    }

    try {
        const mediaDoc = await getDoc(doc(db, 'media', itemId));
        if (currentMusicPlaybackId !== myId) return; // Si la sesión cambió, abortamos la carga

        if (mediaDoc.exists()) {
            audioPlayer.pause(); // Pausamos por seguridad antes de inyectar el nuevo audio
            audioPlayer.src = mediaDoc.data().url;
            // El evento 'onended' se encargará de llamar a la siguiente canción
            const shouldAutoplayMusic = !isVisualAudioActive && !startupAudioBlock;
            if (shouldAutoplayMusic) {
                await audioPlayer.play();
            } else {
                audioPlayer.pause(); // Doble seguro si el semáforo está en rojo o hay bloqueo por inicio
            }
        } else {
            console.warn(`Audio con ID ${itemId} no encontrado. Saltando.`);
            if (currentMusicPlaybackId === myId) playNextMusicItem();
        }
    } catch (error) {
        if (currentMusicPlaybackId !== myId) return;
        if (error.name === 'NotAllowedError') {
            console.warn("La reproducción automática de audio fue bloqueada. Esperando interacción del usuario.");
            showAudioOverlay();
        } else {
            console.error("Error al intentar reproducir audio:", error);
            setTimeout(() => {
                if (currentMusicPlaybackId === myId) playNextMusicItem();
            }, 1000);
        }
    }
}
audioPlayer.onended = () => playNextMusicItem();

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

        // --- Controlar Widgets Separados ---
        handleNewsWidget({ 
            show: screenData.showNews, 
            url: screenData.newsRssUrl, 
            limit: screenData.newsLimit, 
            speed: screenData.newsSpeed 
        });

        handleCurrencyWidget({ 
            show: screenData.showCurrency, 
            country: screenData.currencyCountry 
        }, screenData.showNews);

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
            let musicChanged = (finalMusicPlaylistId !== currentMusicPlaylistId);
            let visualChanged = (finalVisualPlaylistId !== currentVisualPlaylistId);

            // 1. Cargamos primero la música siempre
            if (musicChanged) {
                loadMusicPlaylist(finalMusicPlaylistId);
            }

            // 2. Cargamos lo visual
            if (visualChanged) {
                if (musicChanged) {
                    // Si ambas cambian al mismo tiempo por un horario, le damos una leve 
                    // ventaja a la música para evitar que choquen los audios.
                    setTimeout(() => loadVisualPlaylist(finalVisualPlaylistId), 300);
                } else {
                    loadVisualPlaylist(finalVisualPlaylistId);
                }
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
                startupAudioBlock = true;
                startupBlockInProgress = true;
                playNextItem();
            } else {
                displayMessage(translations[document.documentElement.lang || 'es'].visualPlaylistNotFound);
                releaseStartupBlock();
            }
        });
    } else {
        currentPlaylistItems = [];
        releaseStartupBlock();
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
        displayMessage(translations[document.documentElement.lang || 'es'].noVisualPlaylistAssigned);
        return;
    }

    // Reinicia el bucle si llegamos al final
    if (currentItemIndex >= currentPlaylistItems.length) {
        currentItemIndex = 0;
    }

    // Obtenemos el objeto completo del item directamente del array
    const itemData = currentPlaylistItems[currentItemIndex];

    // ¡CORRECCIÓN CLAVE 1! Incrementamos el índice ANTES de mostrar el medio.
    // Así, si displayMedia falla y llama a playNextItem, el índice ya habrá avanzado.
    currentItemIndex++;

    currentVisualPlaybackId++;
    const myPlaybackId = currentVisualPlaybackId;

    // Verificamos que el objeto exista y lo mostramos
    if (itemData) {
        displayMedia(itemData, myPlaybackId);
    }
}

// Muestra un archivo (imagen o video) en la pantalla
function displayMedia(item, playbackId) {
    // Función segura que solo avanza si el temporizador pertenece a la sesión actual
    const safePlayNext = () => {
        if (currentVisualPlaybackId === playbackId) {
            playNextItem();
        }
    };
    releaseStartupBlock();

    // Identificar contenido anterior para la transición de salida
    const oldContent = contentScreen.lastElementChild;
    
    // Seleccionar transición aleatoria
    const transitions = ['fade', 'slide', 'zoom'];
    const transitionType = transitions[Math.floor(Math.random() * transitions.length)];

    // Prepara el nuevo contenido
    const newContent = document.createElement('div');
    newContent.className = `media-container anim-${transitionType}-enter`;

    // Función para ejecutar la transición
    const runTransition = () => {
        // Forzar reflow
        void newContent.offsetWidth;
        
        newContent.classList.add(`anim-${transitionType}-enter-active`);
        newContent.classList.remove(`anim-${transitionType}-enter`);

        if (oldContent) {
            oldContent.classList.add(`anim-${transitionType}-exit`);
            requestAnimationFrame(() => {
                oldContent.classList.add(`anim-${transitionType}-exit-active`);
                oldContent.classList.remove(`anim-${transitionType}-exit`);
            });
            
            // Limpieza del contenido viejo
            setTimeout(() => {
                // FORZAR PAUSA en cualquier video viejo para evitar "audio fantasma" en segundo plano
                if (oldContent) {
                    const oldVideos = oldContent.querySelectorAll('video');
                    oldVideos.forEach(v => {
                        v.pause();
                        v.removeAttribute('src'); // Libera la memoria
                        v.load();
                    });
                }
                if (oldContent && oldContent.parentNode === contentScreen) {
                    contentScreen.removeChild(oldContent);
                }
            }, 1600); // Un poco más que la transición más larga
        }
    };

    if (item.type.startsWith('image')) {
        isVisualAudioActive = false; // Semáforo verde
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
        img.className = 'w-full h-full object-contain'; // object-contain para que se vea completa
        newContent.appendChild(img);
        contentScreen.appendChild(newContent);
        
        const durationInSeconds = item.duration || 10;

        // Una vez que la imagen carga, la hacemos visible
        img.onload = () => {
            runTransition();
        };
        img.onerror = () => safePlayNext(); // Si la imagen no carga, pasa a la siguiente

        setTimeout(safePlayNext, durationInSeconds * 1000);

    } else if (item.type.startsWith('video')) {
        isVisualAudioActive = true; // Semáforo rojo
        // Forzamos la pausa de la música de fondo (quitamos el if por seguridad)
        audioPlayer.pause();

        const video = document.createElement('video');
        // Añadimos un parámetro único para evitar errores de caché del navegador (net::ERR_CACHE_OPERATION_NOT_SUPPORTED)
        video.src = `${item.url}&_cacheBust=${new Date().getTime()}`;
        video.className = 'w-full h-full object-contain'; // object-contain para que se vea completo
        video.autoplay = true;
        video.muted = false; // Permitimos el sonido del video
        
        newContent.appendChild(video);
        contentScreen.appendChild(newContent);

        // Hacemos el video visible solo cuando realmente empieza a reproducirse
        video.addEventListener('playing', () => {
            runTransition();
        }, { once: true });

        // Usamos la función unificada para reanudar la música y pasar al siguiente item.
        video.onended = () => {
            // No es necesario llamar a resumeMusicAndPlayNext() aquí,
            // porque el onended del video ya se encarga de llamar a playNextItem()
            // y la lógica de reanudación está en el tipo 'image' o similar.
            // La lógica actual ya pausa la música para el video y la reanuda para la imagen.
            safePlayNext();
        };
        // ¡CORRECCIÓN CLAVE! Rompemos el bucle infinito.
        // Si un video falla, en lugar de llamar a playNextItem() inmediatamente,
        // lo hacemos después de un breve instante. Esto evita el "Maximum call stack size exceeded".
        video.onerror = () => { 
            console.error("Error al cargar o reproducir el video, saltando al siguiente:", item.url); 
            setTimeout(safePlayNext, 100); 
        };

    } else if (item.type === 'weather') {
        isVisualAudioActive = false; // Semáforo verde
        // Si hay música de fondo, la reanudamos si estaba pausada.
        if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
            audioPlayer.play().catch(e => console.error("Error al reanudar audio para clima:", e));
        }

        const weatherContainer = document.createElement('div');
        weatherContainer.className = 'w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600 text-white p-8';
        weatherContainer.innerHTML = `<div class="text-3xl font-light">Cargando pronóstico...</div>`;
        newContent.appendChild(weatherContainer);
        contentScreen.appendChild(newContent);
        requestAnimationFrame(runTransition);

        const fetchAndDisplayWeather = async () => {
            let location = item.location; // Prioridad 1: la ubicación del propio item.

            // Si el item no tiene ubicación, usamos la de la pantalla como alternativa.
            if (!location) {
                const screenDocRef = doc(db, 'screens', localStorage.getItem('nexusreplay_screen_id'));
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
        setTimeout(safePlayNext, durationInSeconds * 1000);

    } else if (item.type === 'clock') {
        isVisualAudioActive = false; // Semáforo verde
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
        newContent.appendChild(clockContainer);
        contentScreen.appendChild(newContent);
        requestAnimationFrame(runTransition);

        const updateFullscreenClock = () => {
            const timeEl = document.getElementById('fullscreen-clock-time');
            const dateEl = document.getElementById('fullscreen-clock-date');
            if (!timeEl || !dateEl) return; // Si el elemento ya no existe, no hacemos nada

            const now = new Date();
            const options = { hour: '2-digit', minute: '2-digit', hour12: false };
            if (item.timezone && item.timezone !== 'local') {
                options.timeZone = item.timezone;
            }
            timeEl.textContent = now.toLocaleTimeString('es-ES', options); // Usamos un locale neutro para el formato
            dateEl.textContent = now.toLocaleDateString(document.documentElement.lang || 'es', { weekday: 'long', day: 'numeric', month: 'long' });
        };

        const clockInterval = setInterval(updateFullscreenClock, 1000);
        updateFullscreenClock(); // Primera llamada
        const durationInSeconds = item.duration || 10;
        // Limpiamos el intervalo cuando el item termina para no dejar procesos corriendo
        setTimeout(() => { clearInterval(clockInterval); safePlayNext(); }, durationInSeconds * 1000);

    } else if (item.type === 'qrcode') {
        isVisualAudioActive = false; // Semáforo verde
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
        newContent.appendChild(qrContainer);
        contentScreen.appendChild(newContent);
        requestAnimationFrame(runTransition);

        const screenId = localStorage.getItem('nexusreplay_screen_id');
        // CORRECCIÓN: La lógica para determinar la URL del QR estaba mal.
        // Ahora se comprueba correctamente si el tipo es 'url' y tiene contenido,
        // o si es 'menu' para construir la URL del visor de menús.
        if (item) {
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
        setTimeout(safePlayNext, durationInSeconds * 1000);

    } else if (item.type === 'youtube') {
        isVisualAudioActive = true; // Semáforo rojo
        // Forzamos la pausa de la música de fondo
        audioPlayer.pause();

        // ¡CORRECCIÓN CLAVE 2! Expresión regular para extraer el ID de cualquier formato de URL de YouTube
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = item.url.match(youtubeRegex);
        const videoId = match ? match[1] : null;

        if (!videoId) { safePlayNext(); return; } // Protección contra URLs mal formadas
            const playerContainer = document.createElement('div');
            playerContainer.id = 'youtube-player-' + new Date().getTime(); // ID único
            playerContainer.className = 'w-full h-full';
            newContent.appendChild(playerContainer);
            contentScreen.appendChild(newContent);

            const createPlayer = () => {
                let hasUnmuted = false; // Flag para asegurar que solo quitamos el silencio una vez.

                // Limpiamos cualquier callback anterior al crear un nuevo reproductor
                window.unmuteYoutubeCallback = null;

                new YT.Player(playerContainer.id, {
                    videoId: videoId,
                    // IMPORTANTE: Forzamos el inicio en silencio (mute: 1) para garantizar el autoplay.
                    // Luego intentaremos quitar el silencio en el evento 'onStateChange'.
                    playerVars: { 'autoplay': 1, 'controls': 0, 'rel': 0, 'showinfo': 0, 'loop': 0, 'mute': 1 },
                    events: {
                        'onReady': (event) => {
                            // En 'onReady', solo nos aseguramos de que el video se reproduzca y se muestre.
                            event.target.playVideo();
                            runTransition();
                        },
                        'onStateChange': (event) => {
                            // --- ESTA ES LA LÓGICA CLAVE ---
                            // Cuando el video realmente empieza a reproducirse (estado PLAYING)...
                            if (event.data === YT.PlayerState.PLAYING) {
                            isVisualAudioActive = true; // Semáforo rojo
                                // ¡CORRECCIÓN CLAVE! Pausamos la música de fondo aquí, justo cuando el video empieza.
                            audioPlayer.pause();

                                // ...intentamos quitar el silencio y subir el volumen.
                                if (!hasUnmuted) {
                                    event.target.unMute();
                                    event.target.setVolume(100);
                                    hasUnmuted = true; // Marcamos que ya lo hemos intentado.
                                }
                                // VERIFICACIÓN: Comprobamos si el navegador nos ha ignorado.
                                setTimeout(() => {
                                    if (event.target.isMuted()) {
                                        console.warn("El navegador bloqueó el sonido automático de YouTube. Mostrando overlay.");
                                        // Guardamos la función para quitar el silencio en una variable global
                                        // para que el overlay pueda llamarla.
                                        window.unmuteYoutubeCallback = () => {
                                            event.target.unMute();
                                            event.target.setVolume(100);
                                        };
                                        showAudioOverlay();
                                    }
                                }, 500); // Damos un pequeño margen para que el navegador procese el unmute.
                            }
                            // Cuando el video termina, pasamos al siguiente.
                            else if (event.data === YT.PlayerState.ENDED) {
                            isVisualAudioActive = false; // Semáforo verde
                                // ¡CORRECCIÓN! Reanudamos la música de fondo antes de pasar al siguiente item.
                                if (audioPlayer.paused && currentMusicPlaylistItems.length > 0) {
                                    audioPlayer.play().catch(e => console.error("Error al reanudar audio tras YouTube:", e));
                                }
                                safePlayNext(); // Ahora sí, pasamos al siguiente.
                            }
                        }
                    }
                });
            };

            // Usamos la cola para asegurarnos que la API de YouTube esté lista.
            if (window.isYouTubeApiReady) {
                createPlayer();
            } else {
                window.youtubePlayerQueue.push(createPlayer);
            }
    } else if (item.type === 'iframe') {
        isVisualAudioActive = true; // Semáforo rojo (Los iframes pueden tener sonido)
        audioPlayer.pause();
        const iframe = document.createElement('iframe');
        iframe.src = item.url;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.className = 'w-full h-full';

        newContent.appendChild(iframe);
        contentScreen.appendChild(newContent);
        requestAnimationFrame(runTransition);

        const durationInSeconds = item.duration || 15;
        setTimeout(safePlayNext, durationInSeconds * 1000);
    }
}

// --- Carga de la API de YouTube ---
window.youtubePlayerQueue = []; // Cola de reproductores a crear
window.isYouTubeApiReady = false;
window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube IFrame API Ready.");
    window.isYouTubeApiReady = true;
    // Procesa todos los reproductores que estaban en espera
    window.youtubePlayerQueue.forEach(playerFunc => playerFunc());
    window.youtubePlayerQueue = []; // Limpia la cola
};

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
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
                isPaired: true,
                lastSeen: serverTimestamp() // Actualizamos lastSeen en el momento del emparejamiento
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

    // Cargamos la API de YouTube
    loadYouTubeAPI();

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

    // Ocultar el loader con una transición suave
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
}

init();
