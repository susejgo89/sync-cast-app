import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, setLogLevel, collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
        import { initMediaView } from './views/mediaView.js';
        import { auth, db, storage } from './firebase-config.js';
        import { showConfirmModal } from './utils/modals.js';
        import { translations } from './utils/translations.js';
        import { initPlaylistsView } from './views/playlistsView.js';
        import { initScreensView } from './views/screensView.js'; 
        import { initMusicPlaylistsView } from './views/musicPlaylistsView.js';
        
        
        document.addEventListener('DOMContentLoaded', () => {
            const hamburgerBtn = document.getElementById('hamburger-btn');
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebar-overlay');

            if (hamburgerBtn && sidebar && sidebarOverlay) {
                // Función para abrir/cerrar el menú
                const toggleSidebar = () => {
                    sidebar.classList.toggle('-translate-x-full');
                    sidebarOverlay.classList.toggle('hidden');
                };

                // Eventos para el botón y el fondo oscuro
                hamburgerBtn.addEventListener('click', toggleSidebar);
                sidebarOverlay.addEventListener('click', toggleSidebar);
            }

        // --- DOM Elements ---
        const loader = document.getElementById('loader');
        const authContainer = document.getElementById('auth-container');
        const dashboardContainer = document.getElementById('dashboard-container');
        const userInfo = document.getElementById('user-info');
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                auth.signOut();
            });
        }
        const messageBox = document.getElementById('message-box');
        const loginFormContainer = document.getElementById('login-form-container');
        const registerFormContainer = document.getElementById('register-form-container');
        const showRegisterLink = document.getElementById('show-register');
        const showLoginLink = document.getElementById('show-login');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const verifyContainer = document.getElementById('verify-email-container');
    
        
        // --- State Variables ---
        let userMediaData = [];
        let userPlaylistsData = [];
        let userMusicPlaylistsData = [];
        let userScreensData = [];
        let unsubscribeMedia = null;
        let playlistsViewInstance = null;
        let unsubscribeMusicPlaylists = null;
        let screensViewInstance = null;
        let currentUserId = null;
        let activePlaylistId = null;
        let draggedItem = null;
        

        

        const langSelectors = document.querySelectorAll('.lang-selector');
        let currentLang = 'es';

        function setLanguage(lang) {
            currentLang = lang;
            document.documentElement.lang = lang;

            document.querySelectorAll('[data-lang]').forEach(el => {
                const key = el.getAttribute('data-lang');
                if (translations[lang][key]) {
                    el.textContent = translations[lang][key];
                }
            });

            document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
                const key = el.getAttribute('data-lang-placeholder');
                if (translations[lang][key]) {
                    el.placeholder = translations[lang][key];
                }
            });

            langSelectors.forEach(selector => {
                selector.querySelectorAll('img').forEach(img => {
                    img.classList.toggle('active', img.dataset.langId === lang);
                });
            });

            // Re-render views that depend on language
            if (activePlaylistId) selectPlaylist(activePlaylistId, currentLang);
            if (screensViewInstance) screensViewInstance.rerender();
            updateDashboardCards(); // Actualiza el dashboard al cambiar idioma
        }

        langSelectors.forEach(selector => {
            selector.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG') {
                    const langId = e.target.dataset.langId;
                    if (langId) {
                        setLanguage(langId);
                    }
                }
            });
        });


        const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            
            signInWithPopup(auth, provider)
                .then((result) => {
                    // El inicio de sesión fue exitoso.
                    // La función onAuthStateChanged se encargará de llevarte al dashboard.
                    console.log("Usuario autenticado con Google:", result.user);
                }).catch((error) => {
                    // Manejar errores, como cerrar la ventana emergente.
                    console.error("Error con el popup de Google:", error);
                    showMessage(translations[currentLang].googleSignInError || "Hubo un error al iniciar sesión con Google.", true);
                });
        });
    }

        // --- Authentication Logic ---
        onAuthStateChanged(auth, async (user) => {
    loader.style.display = 'flex';
    
    // Ocultamos los contenedores de auth para empezar
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('verify-email-container').style.display = 'none';

    if (user && user.emailVerified) {
        // CASO 1: Usuario logueado Y VERIFICADO -> Muestra el dashboard
        // (Tu código original para mostrar el dashboard va aquí)
        currentUserId = user.uid;
        authContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        // REEMPLAZA la línea de userInfo.innerHTML con esta:

        userInfo.innerHTML = `<div class="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center font-bold text-white mr-3 flex-shrink-0">${user.email.charAt(0).toUpperCase()}</div><span class="text-sm font-medium text-white truncate" title="${user.email}">${user.email}</span>`;
        loadInitialData(user.uid);

    } else if (user && !user.emailVerified) {
        // CASO 2: Usuario logueado PERO NO VERIFICADO -> Muestra el mensaje
        authContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        document.getElementById('verify-email-container').style.display = 'block';
        
        const logoutVerificationBtn = document.getElementById('logout-verification-button');
        if (logoutVerificationBtn) {
            logoutVerificationBtn.onclick = () => auth.signOut();
        }

    } else {
        // CASO 3: Usuario NO logueado -> Muestra el login
        // (Tu código original para cuando no hay usuario va aquí)
        document.body.classList.add('auth-bg');
        currentUserId = null;
        authContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        document.getElementById('login-form-container').style.display = 'block';
        if (unsubscribeMedia) unsubscribeMedia();
        if (playlistsViewInstance) playlistsViewInstance.unsubscribe();
        if (unsubscribeMusicPlaylists) unsubscribeMusicPlaylists();
        if (screensViewInstance) screensViewInstance.unsubscribe();
    }
    
    loader.style.display = 'none';
    if (!currentUserId) {
        setLanguage('es');
    }
});
        
        const showMessage = (message, isError = false) => {
            messageBox.textContent = message;
            messageBox.classList.remove('hidden', 'bg-red-500', 'bg-emerald-500');
            messageBox.classList.add(isError ? 'bg-red-500' : 'bg-emerald-500');
            setTimeout(() => messageBox.classList.add('hidden'), 5000);
        };

        loginForm.addEventListener('submit', (e) => { e.preventDefault(); signInWithEmailAndPassword(auth, loginForm['login-email'].value, loginForm['login-password'].value).catch(() => showMessage("Correo o contraseña incorrectos.", true)); });
        registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = registerForm['register-password'].value;
    const email = registerForm['register-email'].value;

    if (pass.length < 6) {
        showMessage("La contraseña debe tener al menos 6 caracteres.", true);
        return;
    }

    createUserWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            const user = userCredential.user;

            // --- ESTA ES LA PARTE NUEVA ---
            // Creamos un documento para el nuevo usuario en la colección 'users'
            const userDocRef = doc(db, "users", user.uid);
            setDoc(userDocRef, {
                email: user.email,
                createdAt: serverTimestamp(),
                screenLimit: 3 // Límite de pantallas por defecto para nuevos usuarios
            }).then(() => {
                // Una vez creado el perfil, enviamos el email de verificación
                sendEmailVerification(user)
                    .then(() => {
                        showMessage("¡Cuenta creada! Revisa tu correo para verificarla.", false);
                        auth.signOut();
                    });
            });

        })
        .catch((error) => {
            // Manejo de errores (ej. el correo ya existe)
            console.error("Error en registro:", error);
            showMessage("Este correo ya está en uso o hubo un error.", true);
        });
});
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.style.display = 'none'; // Usamos el nombre correcto
            verifyContainer.style.display = 'none';
            registerFormContainer.style.display = 'block'; // Usamos el nombre correcto
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerFormContainer.style.display = 'none'; // Usamos el nombre correcto
            verifyContainer.style.display = 'none';
            loginFormContainer.style.display = 'block'; // Usamos el nombre correcto
        });

        function updateDashboardCards() {
            // Card de Medios
            const mediaCountEl = document.getElementById('media-count');
            if (mediaCountEl) mediaCountEl.textContent = userMediaData.length;

            // Card de Playlists
            const visualPlaylistCountEl = document.getElementById('visual-playlist-count');
            if (visualPlaylistCountEl) visualPlaylistCountEl.textContent = userPlaylistsData.length;
            
            const musicPlaylistCountEl = document.getElementById('music-playlist-count');
            if (musicPlaylistCountEl) musicPlaylistCountEl.textContent = userMusicPlaylistsData.length;

            // Card de Estado de Pantallas
            const onlineCountEl = document.getElementById('online-count');
            const offlineCountEl = document.getElementById('offline-count');
            if (onlineCountEl && offlineCountEl) {
                let onlineCount = 0;
                userScreensData.forEach(screen => {
                    const lastSeen = screen.lastSeen?.toDate();
                    const isOnline = lastSeen && (new Date().getTime() - lastSeen.getTime()) < 150000; // 2.5 minutos
                    if (isOnline) onlineCount++;
                });
                onlineCountEl.textContent = onlineCount;
                offlineCountEl.textContent = userScreensData.length - onlineCount;
            }

            // Card de Archivos Recientes
            const recentUploadsContainer = document.getElementById('recent-uploads-container');
            if (recentUploadsContainer) {
                const sortedMedia = [...userMediaData].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                const recentMedia = sortedMedia.slice(0, 3);

                recentUploadsContainer.innerHTML = '';
                if (recentMedia.length > 0) {
                    recentMedia.forEach(media => {
                        const isVideo = media.type.startsWith('video');
                        const thumb = document.createElement(isVideo ? 'video' : 'img');
                        thumb.src = media.url;
                        thumb.title = media.name;
                        thumb.className = 'recent-upload-thumb';
                        if (isVideo) thumb.muted = true; // Videos must be muted to maybe autoplay
                        thumb.onerror = () => { thumb.src = 'https://placehold.co/100x60/EEE/31343C?text=Error'; };
                        recentUploadsContainer.appendChild(thumb);
                    });
                } else {
                    recentUploadsContainer.innerHTML = `<p class="text-xs text-gray-400 col-span-3 text-center" data-lang="dashboardNoRecentUploads">${translations[currentLang].dashboardNoRecentUploads || 'No hay archivos recientes.'}</p>`;
                }
            }
        }
        
        function loadInitialData(userId) {
            unsubscribeMedia = initMediaView(userId, () => currentLang, (media) => {
                userMediaData = media;
                if (playlistsViewInstance) {
                    playlistsViewInstance.rerenderLibrary();
                }
                updateDashboardCards();
            });
            playlistsViewInstance = initPlaylistsView(userId, () => currentLang, (playlists) => {
                userPlaylistsData = playlists;
                if (screensViewInstance) screensViewInstance.rerender();
                updateDashboardCards();
            }, () => userMediaData);
            unsubscribeMusicPlaylists = initMusicPlaylistsView(userId, () => currentLang, (musicPlaylists) => {
                userMusicPlaylistsData = musicPlaylists;
                if (screensViewInstance) screensViewInstance.rerender();
                updateDashboardCards();
            }, () => userMediaData);
            screensViewInstance = initScreensView(userId, () => userPlaylistsData, () => userMusicPlaylistsData, () => currentLang, () => userMediaData, (screens) => {
                userScreensData = screens;
                updateDashboardCards();
            });
        }

        // --- Navigation Logic ---
        const navLinks = document.querySelectorAll('.nav-link');
        const pageSections = document.querySelectorAll('.page-section');
        navLinks.forEach(link => { link.addEventListener('click', e => { e.preventDefault(); const targetId = link.getAttribute('href').substring(1); pageSections.forEach(s => s.classList.add('hidden')); navLinks.forEach(l => {l.classList.remove('bg-neutral-700', 'text-white')}); document.getElementById(`${targetId}-section`).classList.remove('hidden'); link.classList.add('bg-neutral-700', 'text-white');
         
        const linkText = link.querySelector('span').textContent;
        document.title = `${linkText} - NexusPlay`;
    }); });
        navLinks.forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                
                pageSections.forEach(s => s.classList.add('hidden'));
                navLinks.forEach(l => l.classList.remove('bg-neutral-700', 'text-white'));
                
                document.getElementById(`${targetId}-section`).classList.remove('hidden');
                link.classList.add('bg-neutral-700', 'text-white');
                
                const linkText = link.querySelector('span').textContent;
                document.title = `${linkText} - NexusPlay`;
            });
        });

    document.querySelectorAll('.dashboard-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector(`a.nav-link[href="${link.getAttribute('href')}"]`).click();
        });
    });

    // --- Quick Actions Logic ---
    const quickAddScreenBtn = document.getElementById('quick-add-screen');
    if (quickAddScreenBtn) {
        quickAddScreenBtn.addEventListener('click', () => {
            document.getElementById('add-screen-modal').classList.add('active');
        });
    }

    const quickAddPlaylistBtn = document.getElementById('quick-add-playlist');
    if (quickAddPlaylistBtn) {
        quickAddPlaylistBtn.addEventListener('click', () => {
            document.getElementById('add-playlist-modal').classList.add('active');
        });
    }

});
