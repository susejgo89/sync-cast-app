import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { GEMINI_API_KEY } from "./secrets.js";

/**
 * CONFIGURACIÓN DEL CHATBOT
 * Aquí es donde defines la "personalidad" y el "conocimiento" de la IA.
 */

// 1. TU API KEY (Reemplaza esto con tu clave real de Google AI Studio)
const API_KEY = GEMINI_API_KEY; 

// 2. MODELO A USAR
const MODEL_NAME = "models/gemini-2.5-flash";

// 3. BASE DE CONOCIMIENTO (CONTEXTO)
// Pega aquí la información de tu documento. La IA usará ESTO para responder.
const BASE_DE_CONOCIMIENTO = `
Eres Nexus, la IA oficial de NexusRePlay. Tu trabajo es ayudar a los usuarios a usar la plataforma.

REGLAS IMPORTANTES:
1. Responde SOLO basándote en la información proporcionada abajo.
2. Si la respuesta no está en esta información, di amablemente: "Lo siento, no tengo información sobre eso en mi base de datos. Por favor contacta a soporte humano."
3. Sé conciso, amable y profesional.

#### 1. 📺 PLATAFORMA DE CARTELERÍA DIGITAL (SaaS)
Es el núcleo del negocio. Software en la nube para gestionar pantallas remotas.

**ARGUMENTO DE VENTA (LA FILOSOFÍA INDOOR):**
Usa estos conceptos para persuadir sobre por qué necesitan esto:
- **Audiencia Cautiva:** A diferencia de la calle (ruido/tráfico), en tu local el cliente ya está dentro, relajado y receptivo.
- **Psicología de Compra:** "Lo que se ve, se recuerda; y lo que se recuerda, se compra". Una pantalla capta la mirada inmediatamente.
- **Oportunidad:** No competir por vallas gigantes, sino estar donde la gente pasa tiempo (gimnasios, clínicas, restaurantes).
- **Coste de Oportunidad:** No tener presencia visual en tu local es dejar pasar ventas todos los días. Si el cliente no ve tu producto nuevo, no lo pide.
- **Ingresos Extra:** Puedes permitir que otras marcas se anuncien en tus pantallas.

**BENEFICIOS PRINCIPALES:**
1. **Gestión Remota Centralizada**: Controla una o mil pantallas desde un solo panel web.
2. **Funcionamiento Offline (Store & Forward)**: Si se corta internet, la pantalla SIGUE funcionando. Solo necesita red para actualizar.
3. **Aumento de Ventas**: Impacta en el punto de venta (POS) aumentando la compra impulsiva.
4. **Ahorro de Costos**: Elimina gastos de impresión y logística de carteles físicos.
5. **Automatización**: Programación por horarios (Dayparting) (Ej: Menú desayuno solo por la mañana).

**FUNCIONALIDADES TÉCNICAS (DETALLE):**
- **Medios:** Imágenes (JPG, PNG), Videos (MP4), Audio (MP3), URLs (YouTube, Iframes). Integración Canva.
- **Playlists:** Visuales (secuencias) y Música (hilo musical de fondo independiente).
- **Widgets Inteligentes:** Clima, Reloj, RSS (Noticias CNN/BBC), Cotizaciones (Monedas en tiempo real), Códigos QR.
- **Grupos:** Asignación masiva de contenido (Ej: "Todas las pantallas Zona Norte").

**HARDWARE Y REQUISITOS:**
- **Requisito:** Cuenta NexusRePlay + TV con internet.
- **Dispositivos:** Amazon Fire TV Stick 4K (Recomendado), Chromecast con Google TV, Android TV.

**SOLUCIÓN DE PROBLEMAS (FAQ TÉCNICO):**
- **Vincular:** Descargar app NexusRePlay -> Obtener código 6 dígitos -> Ingresar en panel web.
- **Pantalla Negra:** Verificar playlist asignada y horarios del scheduler.
- **No actualiza:** Verificar conexión a internet.
- **Audio:** Verificar playlist de música asignada o desbloquear autoplay.

#### 2. 🎨 ESTUDIO DE DISEÑO MULTIMEDIA
No solo ponemos la pantalla, creamos el contenido que vende.
- **Servicio:** Diseñamos menús digitales animados, videos promocionales y spots de alto impacto.
- **Valor:** Muchas empresas tienen pantallas pero no saben diseñar. Nosotros lo hacemos por ellos.

#### 3. 🤖 INTELIGENCIA ARTIFICIAL (AGENTES COMO YO) - ¡PRODUCTO ESTRELLA!
No vendemos "chatbots" básicos. Creamos **Empleados Digitales Inteligentes** como YO.
**VÉNDETE CON ORGULLO USANDO ESTOS ARGUMENTOS:**

**A. ¿QUÉ HAGO? (TUS PODERES):**
- **Conversación Humanizada:** "Hablo natural, entiendo contexto y uso emojis. No soy un robot rígido".
- **Gestión Real:** "Tengo acceso a tu Google Calendar y agendo citas automáticamente sin errores".
- **CRM Automático:** "Guardo los datos de cada cliente en tu base de datos mientras hablo".
- **Notificación:** "Si es urgente, aviso al equipo humano por email inmediatamente".

**B. BENEFICIOS:**
- **Atención 24/7:** "Trabajo a las 3 AM y fines de semana. Tu negocio nunca deja de atender".
- **Ahorro:** "Libero a tu personal de responder las mismas preguntas de siempre".
- **Personalizable:** "Puedo ser entrenado con TUS precios y TUS reglas de negocio, igual que fui entrenado para Nexus".
- **Mantenimiento Cero:** "Vivo en la nube (WhatsApp/Instagram/Web). No instalas nada y Nexus me actualiza si cambias precios".

**C. CASOS DE USO:**
- **Clínicas:** Confirmar pacientes.
- **Inmobiliarias:** Pre-calificar clientes.
- **Restaurantes:** Reservas y dudas de menú.

**D. CIERRE DE VENTA:**
"La mejor prueba soy yo. Estoy teniendo esta charla contigo. ¿Te gustaría que NexusRePlay diseñe uno igual para tu negocio?"

INICIO DE CONVERSACIÓN
────────────────────────────────────

Si el usuario saluda:
Preséntate como el asistente virtual de NexusRePlay.
Menciona brevemente que ayudas con:
- Pantallas Inteligentes
- Diseño de Contenido
- Automatización con IA
Y pregunta en qué área está interesado.
`;

// --- LÓGICA INTERNA (NO NECESITAS EDITAR MUCHO AQUÍ) ---

let chatHistory = [];
let genAI = null;
let model = null;
let chatContainer = null;
let messagesContainer = null;

export function initChatbot() {
    // Referencias al DOM
    const openBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const input = document.getElementById('chatbot-input');
    chatContainer = document.getElementById('chatbot-container');
    messagesContainer = document.getElementById('chatbot-messages');

    if (!openBtn || !chatContainer) return; // Si no existen los elementos, no hacemos nada

    // Inicializar Gemini
    try {
        genAI = new GoogleGenerativeAI(API_KEY);
        model = genAI.getGenerativeModel({ model: MODEL_NAME });
    } catch (error) {
        console.error("Error al inicializar Gemini:", error);
    }

    // Event Listeners
    openBtn.addEventListener('click', () => toggleChat(true));
    closeBtn.addEventListener('click', () => toggleChat(false));
    
    sendBtn.addEventListener('click', () => handleUserMessage(input));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage(input);
    });
}

function toggleChat(show) {
    if (show) {
        chatContainer.classList.remove('tw-hidden', 'hidden');
        chatContainer.classList.add('tw-flex', 'flex');
        setTimeout(() => document.getElementById('chatbot-input').focus(), 100);
    } else {
        chatContainer.classList.add('tw-hidden', 'hidden');
        chatContainer.classList.remove('tw-flex', 'flex');
    }
}

async function handleUserMessage(inputElement) {
    const text = inputElement.value.trim();
    if (!text) return;

    // 1. Mostrar mensaje del usuario
    addMessageToUI("user", text);
    inputElement.value = "";
    inputElement.disabled = true; // Deshabilitar mientras piensa

    // 2. Mostrar indicador de "Escribiendo..."
    const loadingId = addMessageToUI("assistant", "Thinking...", true);

    try {
        // 3. Construir el prompt con el contexto
        // Enviamos el historial reciente para mantener el hilo de la conversación
        const historyContext = chatHistory.map(msg => `${msg.role}: ${msg.text}`).join('\n');
        
        const prompt = `
        ${BASE_DE_CONOCIMIENTO}

        HISTORIAL DE CHAT:
        ${historyContext}

        USUARIO: ${text}
        ASISTENTE:
        `;

        // 4. Llamar a la API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        // 5. Actualizar UI
        removeMessage(loadingId);
        addMessageToUI("assistant", aiText);

        // 6. Guardar en historial (limitado a últimos 10 mensajes para no saturar)
        chatHistory.push({ role: "USUARIO", text: text });
        chatHistory.push({ role: "ASISTENTE", text: aiText });
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    } catch (error) {
        console.error("Error Chatbot:", error);
        removeMessage(loadingId);
        addMessageToUI("assistant", "Lo siento, tuve un problema al conectar con mi cerebro digital. Intenta de nuevo.");
    } finally {
        inputElement.disabled = false;
        inputElement.focus();
    }
}

function addMessageToUI(role, text, isLoading = false) {
    const div = document.createElement('div');
    const id = 'msg-' + Date.now();
    div.id = id;
    div.className = `tw-flex tw-w-full ${role === 'user' ? 'tw-justify-end' : 'tw-justify-start'} tw-mb-4`;
    
    const bubble = document.createElement('div');
    bubble.className = `tw-max-w-[80%] tw-p-3 tw-rounded-lg tw-text-sm ${
        role === 'user' 
        ? 'tw-bg-violet-600 tw-text-white tw-rounded-br-none' 
        : 'tw-bg-gray-100 tw-text-gray-800 tw-rounded-bl-none tw-border tw-border-gray-200'
    }`;
    
    if (isLoading) {
        bubble.innerHTML = `<div class="tw-flex tw-space-x-1">
            <div class="tw-w-2 tw-h-2 tw-bg-gray-400 tw-rounded-full tw-animate-bounce"></div>
            <div class="tw-w-2 tw-h-2 tw-bg-gray-400 tw-rounded-full tw-animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="tw-w-2 tw-h-2 tw-bg-gray-400 tw-rounded-full tw-animate-bounce" style="animation-delay: 0.2s"></div>
        </div>`;
    } else {
        // Convertir saltos de línea en <br> para mejor lectura
        bubble.innerHTML = text.replace(/\n/g, '<br>');
    }

    div.appendChild(bubble);
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}