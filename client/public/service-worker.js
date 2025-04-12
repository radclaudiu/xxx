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

// No interceptamos las solicitudes fetch para evitar problemas con la base de datos
// Dejamos que todas las peticiones pasen directamente a la red
self.addEventListener('fetch', event => {
  // No hacer nada especial, simplemente dejar que la solicitud continúe normalmente
  return;
});