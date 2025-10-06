// views/adminView.js

import { db, auth, functions } from '../firebase-config.js'; // Importamos 'auth' también
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';

// --- DOM Elements ---
const usedScreensEl = document.getElementById('reseller-used-screens');
const totalScreensEl = document.getElementById('reseller-total-screens');
const usedStorageEl = document.getElementById('reseller-used-storage');
const totalStorageEl = document.getElementById('reseller-total-storage');
const clientsTableBody = document.getElementById('reseller-clients-table-body');
const addClientBtn = document.getElementById('add-client-btn');
const clientModal = document.getElementById('client-modal');
const clientModalTitle = document.getElementById('client-modal-title');
const clientForm = document.getElementById('client-form');
const clientModalCancel = document.getElementById('client-modal-cancel');

let resellerData = {};
let clientsData = [];
let currentResellerId = null;
let getLang = () => 'es';

// --- CREAMOS LA REFERENCIA A LA FUNCIÓN UNA SOLA VEZ ---
let createClientUser;

/**
 * Formatea bytes a un formato legible (KB, MB, GB).
 * @param {number} bytes - El número de bytes.
 * @returns {string} - El tamaño formateado.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    // Forzamos la salida a GB para consistencia en el panel
    const gbValue = bytes / Math.pow(k, 3);
    if (gbValue > 0 && gbValue < 0.01) {
        return '< 0.01 GB';
    }
    return `${gbValue.toFixed(2)} GB`;
}

/**
 * Renderiza la tabla de clientes del revendedor.
 */
function renderClientsTable() {
    if (clientsData.length === 0) {
        clientsTableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-10 text-center text-gray-500" data-lang="adminNoClients">${translations[getLang()].adminNoClients}</td></tr>`;
        return;
    }

    clientsTableBody.innerHTML = '';
    clientsData.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${client.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${client.screenLimit}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatBytes(client.storageLimit || 0)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button class="edit-client-btn text-violet-600 hover:text-violet-900" data-client-id="${client.id}">Editar</button>
                <button class="delete-client-btn text-red-600 hover:text-red-900" data-client-id="${client.id}">Eliminar</button>
            </td>
        `;
        clientsTableBody.appendChild(row);
    });
}

/**
 * Actualiza las tarjetas de resumen del pool de recursos.
 */
function updatePoolSummary() {
    const usedScreens = clientsData.reduce((acc, client) => acc + (client.screenLimit || 0), 0);
    const usedStorage = clientsData.reduce((acc, client) => acc + (client.storageLimit || 0), 0);

    usedScreensEl.textContent = usedScreens;
    totalScreensEl.textContent = resellerData.totalScreenLimit || 0;
    usedStorageEl.textContent = formatBytes(usedStorage);
    totalStorageEl.textContent = formatBytes(resellerData.totalStorageLimit || 0); // Corregido: ya estaba bien, pero lo confirmo.
}

/**
 * Abre el modal para crear o editar un cliente.
 * @param {object|null} client - El objeto del cliente a editar, o null para crear uno nuevo.
 */
function openClientModal(client = null) {
    clientForm.reset();
    document.getElementById('client-id').value = client ? client.id : '';
    document.getElementById('client-email').disabled = !!client;
    document.getElementById('client-password-container').style.display = client ? 'block' : 'none';

    if (client) {
        clientModalTitle.textContent = 'Editar Cliente';
        document.getElementById('client-password-label').textContent = translations[getLang()].adminClientEditPassword;
        document.getElementById('client-email').value = client.email;
        document.getElementById('client-screen-limit').value = client.screenLimit || 0; // Bytes a GB
        document.getElementById('client-storage-limit').value = (client.storageLimit || 0) / (1024 * 1024 * 1024); // Bytes a GB
    } else {
        clientModalTitle.textContent = 'Crear Nuevo Cliente';
        document.getElementById('client-password-label').textContent = translations[getLang()].adminClientCreatePassword;
        document.getElementById('client-password-container').style.display = 'block'; // Mostrar contraseña para nuevos
    }
    clientModal.classList.add('active');
}

/**
 * Lógica para guardar (crear o actualizar) un cliente.
 */
async function handleSaveClient(e) {
    e.preventDefault();
    const clientId = document.getElementById('client-id').value;
    const email = document.getElementById('client-email').value;
    const password = document.getElementById('client-password').value;
    const screenLimit = parseInt(document.getElementById('client-screen-limit').value, 10);
    const storageLimitGB = parseFloat(document.getElementById('client-storage-limit').value);
    const storageLimitBytes = storageLimitGB * 1024 * 1024 * 1024;

    // --- Validación de Pool ---
    const currentUsedScreens = clientsData.reduce((sum, c) => sum + (c.id !== clientId ? (c.screenLimit || 0) : 0), 0);
    const currentUsedStorage = clientsData.reduce((sum, c) => sum + (c.id !== clientId ? (c.storageLimit || 0) : 0), 0);

    if (currentUsedScreens + screenLimit > resellerData.totalScreenLimit) {
        alert('El límite de pantallas asignado excede el total disponible en tu pool.');
        return;
    }
    if (currentUsedStorage + storageLimitBytes > resellerData.totalStorageLimit) {
        alert('El límite de almacenamiento asignado excede el total disponible en tu pool.');
        return;
    }

    if (clientId) {
        // --- Lógica de Actualización ---
        const clientRef = doc(db, 'users', clientId);
        await updateDoc(clientRef, {
            screenLimit: screenLimit,
            storageLimit: storageLimitBytes
        });
        // NOTA: La actualización de contraseña también debería hacerse con una Cloud Function.
    } else {
        // --- Lógica de Creación ---
        if (!password || password.length < 6) {
            alert('La contraseña es obligatoria y debe tener al menos 6 caracteres.');
            return;
        }
        
        try {
            // ¡IMPORTANTE! Esta es la llamada a la Cloud Function que debes crear.

            // Forzamos la actualización del token de autenticación para evitar errores 401.
            // Esto garantiza que la credencial más reciente se envíe con la llamada.
            if (auth.currentUser) await auth.currentUser.getIdToken(true);

            const result = await createClientUser({
                email,
                password,
                screenLimit,
                storageLimit: storageLimitBytes,
                resellerId: currentResellerId
            });

            if (result.data.success) {
                console.log('Cliente creado con éxito:', result.data.uid);
            } else {
                throw new Error(result.data.error || 'Error desconocido al crear el cliente.');
            }
        } catch (error) {
            console.error("Error al llamar a la Cloud Function:", error);
            alert(`Error: ${error.message}`);
            return; // Detiene la ejecución si la función falla
        }
    }

    clientModal.classList.remove('active');
}

export function initAdminView(resellerId, langGetter) {
    currentResellerId = resellerId;
    getLang = langGetter;

    // --- INICIALIZACIÓN CLAVE ---
    // Conectamos la función callable con la instancia de autenticación actual
    createClientUser = httpsCallable(functions, 'createClientUser');

    let unsubscribeClients = () => {}; // Inicializamos la función de desuscripción

    // 1. Obtener los datos del propio revendedor (para los límites del pool)
    const resellerDocRef = doc(db, 'users', resellerId);
    const unsubscribeReseller = onSnapshot(resellerDocRef, (docSnap) => {
        if (docSnap.exists()) {
            resellerData = docSnap.data();
            updatePoolSummary(); // <--- AÑADIDO: Actualiza los totales del pool inmediatamente.

            // 2. SOLO SI es un revendedor, obtenemos la lista de sus clientes.
            if (resellerData.role === 'reseller') {
                const clientsQuery = query(collection(db, 'users'), where('resellerId', '==', resellerId));
                // Nos aseguramos de cancelar la escucha anterior antes de crear una nueva
                if (unsubscribeClients) unsubscribeClients(); 
                unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
                    clientsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    renderClientsTable();
                    updatePoolSummary(); // Actualizamos el pool con los datos de los clientes
                });
            } else {
                // Si por alguna razón el usuario ya no es revendedor, limpiamos la tabla.
                clientsData = [];
                renderClientsTable();
                updatePoolSummary();
            }
        }
    });

    // 3. Listeners de la UI
    addClientBtn.addEventListener('click', () => openClientModal());
    clientModalCancel.addEventListener('click', () => clientModal.classList.remove('active'));
    clientForm.addEventListener('submit', handleSaveClient);

    clientsTableBody.addEventListener('click', (e) => {
        const clientId = e.target.dataset.clientId;
        if (!clientId) return;

        if (e.target.classList.contains('edit-client-btn')) {
            const clientToEdit = clientsData.find(c => c.id === clientId);
            openClientModal(clientToEdit);
        }

        if (e.target.classList.contains('delete-client-btn')) {
            // NOTA: Eliminar un usuario de Auth también requiere una Cloud Function.
            showConfirmModal('Eliminar Cliente', '¿Seguro? Esta acción no se puede deshacer y eliminará al usuario y sus datos.', () => {
                console.log(`TODO: Llamar a Cloud Function 'deleteClientUser' con ID: ${clientId}`);
                // deleteDoc(doc(db, 'users', clientId)); // Esto solo borra de Firestore, no de Auth.
            });
        }
    });

    // Función de limpieza para cuando el usuario cierre sesión
    return {
        unsubscribe: () => {
            unsubscribeReseller();
            unsubscribeClients();
        }
    };
}