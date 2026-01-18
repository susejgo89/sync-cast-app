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

INFORMACIÓN DE NEXUSREPLAY:
- **¿Qué es NexusRePlay?**: Es una plataforma de cartelería digital para gestionar pantallas de forma remota.
- **Medios**: Puedes subir imágenes (JPG, PNG) y videos (MP4) en la sección "Medios".
- **Playlists**: Permiten organizar tus medios en una secuencia. Puedes crear playlists visuales o de música.
- **Pantallas**: Aquí vinculas tus dispositivos (TVs, Tablets) usando el código de emparejamiento de 6 dígitos.
- **Grupos**: Sirven para asignar el mismo contenido a muchas pantallas a la vez.
- **Gemini**: Tenemos una integración con IA para generar ideas de contenido, pero tú eres el bot de soporte.
- **Soporte**: Si hay un error técnico, sugiere recargar la página o verificar la conexión a internet.

INFORMACIÓN COMERCIAL (EJEMPLOS):
- **Planes**: Ofrecemos un plan Básico (1 pantalla), Profesional (hasta 10 pantallas) y Corporativo.
- **Contacto de Ventas**: Para contratar planes mayores, contactar a ventas@nexusreplay.com.
- **Horario de Atención**: Lunes a Viernes de 9:00 a 18:00.
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
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('flex');
        // Foco en el input
        setTimeout(() => document.getElementById('chatbot-input').focus(), 100);
    } else {
        chatContainer.classList.add('hidden');
        chatContainer.classList.remove('flex');
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
    div.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[80%] p-3 rounded-lg text-sm ${
        role === 'user' 
        ? 'bg-violet-600 text-white rounded-br-none' 
        : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
    }`;
    
    if (isLoading) {
        bubble.innerHTML = `<div class="flex space-x-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
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