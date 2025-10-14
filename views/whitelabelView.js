// views/whitelabelView.js

import { translations } from '../utils/translations.js';
import { db, storage } from '../firebase-config.js';
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- DOM Elements ---
const form = document.getElementById('whitelabel-form');
const domainInput = document.getElementById('whitelabel-domain');
const logoUploadInput = document.getElementById('whitelabel-logo-upload');
const logoPreviewImg = document.getElementById('whitelabel-logo-preview');
const uploadProgressContainer = document.getElementById('whitelabel-upload-progress-container');
const uploadProgressBar = document.getElementById('whitelabel-upload-progress-bar');
const domainHelpText = document.querySelector('p[data-lang="whiteLabelDomainHelp"]');

let currentResellerId = null;
let getLang = () => 'es';

/**
 * Carga los datos de marca personalizada existentes en el formulario.
 * @param {object} data - Los datos del documento del reseller.
 */
function loadWhiteLabelData(data) {
    if (data.customDomain) {
        domainInput.value = data.customDomain;
    }
    if (data.customLogoUrl) {
        logoPreviewImg.src = data.customLogoUrl;
    } else {
        // Si no hay logo personalizado, muestra el logo por defecto.
        logoPreviewImg.src = 'assets/Sync (3).png';
    }
}

/**
 * Maneja la subida del archivo del logo.
 * @param {File} file - El archivo de imagen seleccionado.
 */
function handleLogoUpload(file) {
    if (!file || !currentResellerId) return;

    // 1. Crea una ruta única y predecible para el logo del reseller.
    // Esto asegura que si sube un nuevo logo, sobreescriba el anterior.
    const storagePath = `branding/${currentResellerId}/logo`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadProgressContainer.classList.remove('hidden');

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            uploadProgressBar.style.width = progress + '%';
        },
        (error) => {
            console.error("Error al subir el logo:", error);
            uploadProgressContainer.classList.add('hidden');
            alert("Error al subir el logo.");
        },
        async () => {
            // 2. Al finalizar, obtiene la URL de descarga.
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // 3. Actualiza el documento del usuario en Firestore.
            const userDocRef = doc(db, 'users', currentResellerId);
            await updateDoc(userDocRef, {
                customLogoUrl: downloadURL
            });

            // 4. Actualiza la vista previa y oculta la barra de progreso.
            logoPreviewImg.src = downloadURL;
            uploadProgressContainer.classList.add('hidden');
            logoUploadInput.value = ''; // Limpia el input
        }
    );
}

/**
 * Inicializa la vista de Marca Personalizada.
 * @param {string} resellerId - El UID del reseller logueado.
 * @param {function} langGetter - Función para obtener el idioma actual.
 * @param {string} hostingDomain - El dominio de hosting de Firebase.
 */
export function initWhiteLabelView(resellerId, langGetter, hostingDomain) {
    currentResellerId = resellerId;
    getLang = langGetter;

    // Función para actualizar el texto de ayuda dinámicamente
    const updateHelpText = () => {
        if (domainHelpText) {
            const lang = getLang();
            domainHelpText.textContent = translations[lang].whiteLabelDomainHelp.replace('{hostingDomain}', hostingDomain);
        }
    };
    const userDocRef = doc(db, 'users', resellerId);

    // Listener para cargar los datos iniciales y mantenerlos actualizados.
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            loadWhiteLabelData(docSnap.data());
        }
        updateHelpText(); // Actualiza el texto también al cargar
    });

    // Listener para guardar el formulario (solo el dominio).
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customDomain = domainInput.value.trim();
        await updateDoc(userDocRef, {
            customDomain: customDomain
        });
        alert('¡Dominio guardado!');
    });

    // Listener para cuando se selecciona un archivo de logo.
    logoUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleLogoUpload(file);
        }
    });

    // Función de limpieza para cuando el usuario cierre sesión.
    return {
        unsubscribe: unsubscribe
    };
}