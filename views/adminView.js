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
const createClientUser = httpsCallable(functions, 'createClientUser');
const deleteClientUser = httpsCallable(functions, 'deleteClientUser');

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
    if (!clientsTableBody) return;
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

    if(usedScreensEl) usedScreensEl.textContent = usedScreens;
    if(totalScreensEl) totalScreensEl.textContent = resellerData.totalScreenLimit || 0;
    if(usedStorageEl) usedStorageEl.textContent = formatBytes(usedStorage);
    if(totalStorageEl) totalStorageEl.textContent = formatBytes(resellerData.totalStorageLimit || 0);
}

/**
 * Abre el modal para crear o editar un cliente.
 * @param {object|null} client - El objeto del cliente a editar, o null para crear uno nuevo.
 */
function openClientModal(client = null) {
    clientForm.reset();
    document.getElementById('client-id').value = client ? client.id : '';
    document.getElementById('client-email').disabled = !!client;
    document.getElementById('client-password-container').style.display = client ? 'none' : 'block';

    if (client) {
        clientModalTitle.textContent = 'Editar Cliente';
        document.getElementById('client-email').value = client.email;
        document.getElementById('client-screen-limit').value = client.screenLimit || 0;
        document.getElementById('client-storage-limit').value = (client.storageLimit || 0) / (1024 * 1024 * 1024); // Bytes a GB
    } else {
        clientModalTitle.textContent = 'Crear Nuevo Cliente';
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

    const saveButton = clientForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;

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
        try {
            const result = await createClientUser({
                email,
                password,
                screenLimit,
                storageLimitBytes
            });
            console.log('Cliente creado con éxito:', result.data.message);
            clientModal.classList.remove('active');
        } catch (error) {
            console.error("Error al crear el cliente:", error);
            // Mostramos el mensaje de error que viene desde la Cloud Function
            alert(`Error: ${error.message}`);
        }
    }

    saveButton.disabled = false;
    if (!clientId) { // Solo cerramos el modal si no es una edición (para que el error sea visible)
        clientModal.classList.remove('active');
    }
}

export function initAdminView(resellerId, langGetter) {
    currentResellerId = resellerId;
    getLang = langGetter;

    let unsubscribeClients = () => {};

    // 1. Obtener los datos del propio revendedor (para los límites del pool)
    const resellerDocRef = doc(db, 'users', resellerId);
    const unsubscribeReseller = onSnapshot(resellerDocRef, (docSnap) => {
        if (docSnap.exists()) {
            resellerData = docSnap.data();
            updatePoolSummary();

            // 2. Obtenemos la lista de sus clientes.
            const clientsQuery = query(collection(db, 'users'), where('ownerId', '==', resellerId));
            if (unsubscribeClients) unsubscribeClients(); 
            unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
                clientsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderClientsTable();
                updatePoolSummary();
            });
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
            const clientToDelete = clientsData.find(c => c.id === clientId);
            const lang = getLang();
            showConfirmModal(
                translations[lang].confirmDeleteTitle || 'Eliminar Cliente', 
                `${translations[lang].confirmDeleteMsg || '¿Seguro que quieres eliminar a'} ${clientToDelete.email}? Esta acción borrará todos sus datos y no se puede deshacer.`, 
                async () => {
                    await deleteClientUser({ subAccountId: clientId });
                }
            );
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