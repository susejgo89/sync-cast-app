# 🚀 NexusRePlay - Plataforma Inteligente de Cartelería Digital

NexusRePlay es una solución integral de **Digital Signage** diseñada para transformar cualquier pantalla o Smart TV en un potente canal de comunicación y ventas. Permite a los negocios gestionar contenido visual y auditivo de forma remota, centralizada y en tiempo real.

## 🎯 ¿Qué resuelve?

Muchos negocios físicos (restaurantes, tiendas, clínicas) tienen pantallas que están apagadas o mostrando contenido irrelevante/estático. NexusRePlay resuelve:
*   **Gestión Remota:** Actualiza el contenido de múltiples pantallas desde cualquier lugar sin necesidad de memorias USB.
*   **Comunicación Dinámica:** Alterna entre promociones, información útil (clima, noticias) y menús interactivos.
*   **Automatización:** Programa horarios específicos para que el contenido cambie según el momento del día (ej. Menú de desayuno vs. Menú de cena).
*   **Engagement:** Atrae la atención con widgets en vivo y permite la interacción mediante códigos QR.

## 👥 ¿Para quién está dirigido?

1.  **Dueños de Negocios Locales:** Que buscan modernizar su punto de venta.
2.  **Franquicias y Cadenas:** Que necesitan consistencia de marca en múltiples sucursales.
3.  **Agencias de Marketing (Modelo Reseller):** La plataforma incluye un panel de administración para que agencias gestionen sus propios clientes bajo su propia marca (**White-Label**).

## ✨ Características Principales

*   **Reproductor Inteligente:** Soporta imágenes, videos (MP4), YouTube e IFrames (páginas web).
*   **Gestión de Audio:** Playlist de música de fondo que se pausa automáticamente cuando un video con sonido entra en reproducción.
*   **Widgets Dinámicos:**
    *   Reloj y Fecha en tiempo real.
    *   Clima local (OpenWeatherMap API).
    *   Noticias RSS con scroll animado (Marquee).
    *   Cotizaciones de divisas actualizadas.
*   **Programación Avanzada:** Reglas por días y horas para playlists visuales y musicales.
*   **Gestión de Grupos:** Controla grupos de pantallas simultáneamente.
*   **Menús QR Interactivos:** Genera visores de contenido para que los clientes escaneen y vean promociones o menús en sus propios móviles.
*   **Panel Administrativo:** Control de límites de almacenamiento y pantallas para sub-cuentas.

## 🛠️ Tecnologías y Lenguajes

Este proyecto fue construido utilizando un stack moderno enfocado en la velocidad de desarrollo y escalabilidad:

*   **Lenguajes:** JavaScript (ES6+), HTML5, CSS3.
*   **Frontend:** 
    *   **Tailwind CSS:** Para un diseño de interfaz rápido y moderno.
    *   **Bootstrap 5:** Utilizado específicamente en la Landing Page para componentes responsivos probados.
*   **Backend & Base de Datos:** 
    *   **Firebase Firestore:** Base de datos NoSQL en tiempo real para sincronización instantánea entre el panel y las pantallas.
    *   **Firebase Auth:** Gestión de usuarios y seguridad.
    *   **Firebase Storage:** Almacenamiento de archivos multimedia.
    *   **Firebase Cloud Functions:** Lógica de servidor para la creación segura de sub-cuentas y limpieza de datos.
*   **APIs de Terceros:**
    *   **OpenWeatherMap:** Datos meteorológicos.
    *   **RSS2JSON:** Para el procesamiento de feeds de noticias.
    *   **Exchange Rates API:** Datos financieros.
    *   **YouTube IFrame API:** Integración de video en streaming.

## 🧠 Lo que aprendí en este proyecto

Desarrollar NexusRePlay implicó retos técnicos significativos que fortalecieron mis habilidades en:

1.  **Sincronización en Tiempo Real:** Implementar listeners de Firestore (`onSnapshot`) para que las pantallas reaccionen instantáneamente a los cambios realizados en el panel administrativo sin necesidad de recargar.
2.  **Arquitectura Modular:** Separar la lógica de la aplicación en vistas (`views/`) y componentes reutilizables, facilitando el mantenimiento y la escalabilidad del código.
3.  **Manejo de Ciclos de Vida Multimedia:** Controlar la reproducción asíncrona de videos, la carga de APIs externas (YouTube) y la transición suave entre diferentes tipos de contenido.
4.  **Seguridad y Roles:** Configurar reglas de seguridad complejas en Firebase para distinguir entre administradores, revendedores y clientes finales, protegiendo los datos de cada uno.
5.  **Optimización de Recursos:** Gestión de límites de almacenamiento y validación de archivos en el lado del cliente y del servidor.
6.  **Experiencia de Usuario (UX):** Crear un flujo de "Emparejamiento" (Pairing) sencillo mediante códigos de 6 dígitos, similar a aplicaciones de Smart TV comerciales.



---

Desarrollado con ❤️ por Susej Gonzalez.

*NexusRePlay - Dinamismo en cada pixel.*