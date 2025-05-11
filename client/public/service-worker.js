// Versión simplificada del service worker, sin funcionalidad offline

// Instalación del Service Worker
self.addEventListener('install', event => {
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  // Reclamar clientes para tener control inmediato
  self.clients.claim();
});

// No registramos un manejador de fetch para evitar el aviso de 'no-op fetch handler'
// Las solicitudes pasarán directamente a la red sin intervención del Service Worker