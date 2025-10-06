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
        import { initGroupsView } from './views/groupsView.js';
        import { createMediaCard } from './components/mediaCard.js';
        
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
        let userGroupsData = [];
        let unsubscribeMedia = null;
        let playlistsViewInstance = null;
        let unsubscribeMusicPlaylists = null;
        let screensViewInstance = null;
        let currentUserId = null;
        let groupsViewInstance = null;
        let activePlaylistId = null;
        let currentScreenForQr = null;
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
        if (groupsViewInstance) groupsViewInstance.unsubscribe();
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

        function formatTimeAgo(date, lang) {
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return lang === 'es' ? `hace ${Math.floor(interval)} años` : ` ${Math.floor(interval)} years ago`;
            interval = seconds / 2592000;
            if (interval > 1) return lang === 'es' ? `hace ${Math.floor(interval)} meses` : ` ${Math.floor(interval)} months ago`;
            interval = seconds / 86400;
            if (interval > 1) return lang === 'es' ? `hace ${Math.floor(interval)} días` : ` ${Math.floor(interval)} days ago`;
            interval = seconds / 3600;
            if (interval > 1) return lang === 'es' ? `hace ${Math.floor(interval)} horas` : ` ${Math.floor(interval)} hours ago`;
            interval = seconds / 60;
            if (interval > 1) return lang === 'es' ? `hace ${Math.floor(interval)} minutos` : ` ${Math.floor(interval)} minutes ago`;
            return lang === 'es' ? 'justo ahora' : 'just now';
        }

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
                        thumb.src = isVideo ? `${media.url.split('&token=')[0]}&token=${media.url.split('&token=')[1]}#t=0.5` : media.url;
                        thumb.title = media.name;
                        thumb.className = 'recent-upload-thumb';
                        if (isVideo) thumb.muted = true;
                        thumb.onerror = () => { thumb.src = 'https://placehold.co/100x60/EEE/31343C?text=Error'; };
                        recentUploadsContainer.appendChild(thumb);
                    });
                } else {
                    recentUploadsContainer.innerHTML = `<p class="text-xs text-gray-400 col-span-3 text-center" data-lang="dashboardNoRecentUploads">${translations[currentLang].dashboardNoRecentUploads || 'No hay archivos recientes.'}</p>`;
                }
            }

            // Card de Actividad Reciente
            const recentActivityContainer = document.getElementById('recent-activity-container');
            if (recentActivityContainer) {
                const recentScreens = userScreensData
                    .filter(s => s.lastScheduledAt)
                    .map(s => ({ ...s, type: 'screen' }));

                const recentGroups = userGroupsData
                    .filter(g => g.lastScheduledAt)
                    .map(g => ({ ...g, type: 'group' }));

                const allActivities = [...recentScreens, ...recentGroups]
                    .sort((a, b) => b.lastScheduledAt.seconds - a.lastScheduledAt.seconds)
                    .slice(0, 4); // Mostramos las 4 más recientes

                recentActivityContainer.innerHTML = '';
                if (allActivities.length > 0) {
                    allActivities.forEach(activity => {
                        const activityEl = document.createElement('div');
                        activityEl.className = 'flex items-center text-sm p-2 bg-gray-50 rounded-md border';
                        const icon = activity.type === 'screen' 
                            ? `<svg class="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`
                            : `<svg class="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a3.002 3.002 0 013.292-2.296M12 10a4 4 0 110-8 4 4 0 010 8zm0 0a2 2 0 100-4 2 2 0 000 4z"></path></svg>`;
                        
                        const timeAgo = formatTimeAgo(activity.lastScheduledAt.toDate(), currentLang);

                        activityEl.innerHTML = `
                            ${icon}
                            <div class="flex-grow min-w-0">
                                <p class="font-semibold truncate text-gray-700">${activity.name}</p>
                                <p class="text-xs text-gray-500">${timeAgo}</p>
                            </div>
                        `;
                        recentActivityContainer.appendChild(activityEl);
                    });
                } else {
                    recentActivityContainer.innerHTML = `<p class="text-xs text-gray-400 text-center" data-lang="dashboardNoRecentActivity">${translations[currentLang].dashboardNoRecentActivity || 'No hay actividad reciente.'}</p>`;
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
            }, () => userMediaData, (qrId) => { currentScreenForQr = qrId; }); // Pasamos la función para setear el QR
            unsubscribeMusicPlaylists = initMusicPlaylistsView(userId, () => currentLang, (musicPlaylists) => {
                userMusicPlaylistsData = musicPlaylists;
                if (screensViewInstance) screensViewInstance.rerender();
                updateDashboardCards();
            }, () => userMediaData);
            screensViewInstance = initScreensView(userId, () => userPlaylistsData, () => userMusicPlaylistsData, () => currentLang, () => userMediaData, (screens) => {
                userScreensData = screens;
                updateDashboardCards(); 
            }, () => userGroupsData, (screenId) => { currentScreenForQr = screenId; }); // Pasamos la función para setear el QR
            groupsViewInstance = initGroupsView(userId, () => currentLang, () => userScreensData, () => userPlaylistsData, () => userMusicPlaylistsData, (groups) => {
                userGroupsData = groups;
                updateDashboardCards();
            });
        }

        // Listener para abrir el modal de QR desde playlistsView
        document.addEventListener('openQrContentModal', async (e) => {
            const qrMenuId = e.detail.qrMenuId;
            const qrContentRef = doc(db, 'qrMenus', qrMenuId);
            const qrContentSnap = await getDoc(qrContentRef);
            const existingIds = qrContentSnap.exists() ? qrContentSnap.data().items : [];

            const visualMedia = userMediaData.filter(media => !media.type.startsWith('audio/'));
            const qrContentMediaLibrary = document.getElementById('qr-content-media-library');
            qrContentMediaLibrary.innerHTML = '';
            visualMedia.forEach(media => {
                const isSelected = existingIds.includes(media.id);
                const card = createMediaCard(media, { isDraggable: false });
                // Añadimos una clase específica para el modal de QR
                card.classList.add('qr-media-card-selectable'); 
                if (isSelected) card.classList.add('selected');
                qrContentMediaLibrary.appendChild(card);
            });
        });

        // Listener para la selección de items en el modal de QR
        const qrContentMediaLibrary = document.getElementById('qr-content-media-library');
        const qrContentSaveBtn = document.getElementById('qr-content-save');
        const qrContentCancelBtn = document.getElementById('qr-content-cancel');
        const qrContentModal = document.getElementById('qr-content-modal');

        qrContentMediaLibrary.addEventListener('click', (e) => {
            const card = e.target.closest('.qr-media-card-selectable');
            if (card) {
                card.classList.toggle('selected');
            }
        });

        qrContentCancelBtn.addEventListener('click', () => qrContentModal.classList.remove('active'));

        qrContentSaveBtn.addEventListener('click', async () => {
            if (!currentScreenForQr) return;
        
            const selectedIds = [];
            qrContentMediaLibrary.querySelectorAll('.qr-media-card-selectable.selected').forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) selectedIds.push(checkbox.dataset.mediaId);
            });
        
            if (currentScreenForQr.startsWith('qr_')) {
                const qrContentRef = doc(db, 'qrMenus', currentScreenForQr);
                await setDoc(qrContentRef, { items: selectedIds, userId: currentUserId }, { merge: true });
            } else {
                const screenRef = doc(db, 'screens', currentScreenForQr);
                await updateDoc(screenRef, { qrCodeItems: selectedIds });
            }
            qrContentModal.classList.remove('active');
        });

        // --- Navigation Logic ---
        const navLinks = document.querySelectorAll('.nav-link');
        const pageSections = document.querySelectorAll('.page-section');
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
