// c:\Users\PC\Desktop\sync-cast-app\utils\router.js

const pageSections = document.querySelectorAll('.page-section');
const navLinks = document.querySelectorAll('.nav-link');

/**
 * Muestra la sección de la página correspondiente a la ruta y actualiza el estado de los enlaces.
 * @param {string} path - La ruta de la URL (ej. '/dashboard').
 */
function showPage(path) {
    // La ruta por defecto será el dashboard
    const targetId = path === '/' ? 'dashboard' : path.substring(1);
    
    pageSections.forEach(s => s.classList.add('hidden'));
    navLinks.forEach(l => l.classList.remove('bg-neutral-700', 'text-white'));

    const targetSection = document.getElementById(`${targetId}-section`);
    const targetLink = document.querySelector(`.nav-link[data-route="/${targetId}"]`);

    if (targetSection) {
        targetSection.classList.remove('hidden');
    } else {
        // Si no se encuentra la sección, muestra el dashboard por defecto
        document.getElementById('dashboard-section').classList.remove('hidden');
    }

    if (targetLink) {
        targetLink.classList.add('bg-neutral-700', 'text-white');
        document.title = `${targetLink.querySelector('span').textContent} - NexusPlay`;
    } else {
        // Activa el enlace del dashboard por defecto
        const dashboardLink = document.querySelector('.nav-link[data-route="/dashboard"]');
        if (dashboardLink) {
            dashboardLink.classList.add('bg-neutral-700', 'text-white');
            document.title = `${dashboardLink.querySelector('span').textContent} - NexusPlay`;
        }
    }
}

/**
 * Navega a una nueva ruta, actualizando la URL y la vista.
 * @param {string} path - La ruta a la que se quiere navegar.
 */
export function navigate(path) {
    history.pushState({}, '', path);
    showPage(path);
}

/**
 * Inicializa el enrutador.
 */
export function initRouter() {
    // 1. Maneja los clics en los enlaces de navegación
    document.body.addEventListener('click', e => {
        const link = e.target.closest('.nav-link, .dashboard-link');
        if (link && link.matches('[data-route]')) {
            e.preventDefault();
            const path = link.dataset.route;
            navigate(path);
        }
    });

    // 2. Maneja los botones de atrás/adelante del navegador
    window.addEventListener('popstate', () => {
        showPage(window.location.pathname);
    });

    // 3. Muestra la página correcta en la carga inicial
    showPage(window.location.pathname);
}
