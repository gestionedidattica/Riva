/* RivApp - service worker: cache offline di base + notifiche push (FCM, messaggi solo-dati).
   Le notifiche le mostra SEMPRE questo file (il server non invia mai il blocco "notification"),
   così non ci sono doppioni e il testo è sotto il controllo del server. */
importScripts('firebase-app-compat.js', 'firebase-messaging-compat.js');

// Valori pubblici per progetto (non sono segreti: vanno protetti con le restrizioni in Google Cloud).
firebase.initializeApp({
  apiKey: "AIzaSyC1rsmLIVUr9drlaD9tNK1Iftj-V1taHY8",
  authDomain: "rivapp-ed917.firebaseapp.com",
  projectId: "rivapp-ed917",
  storageBucket: "rivapp-ed917.firebasestorage.app",
  messagingSenderId: "553925987080",
  appId: "1:553925987080:web:b9c80e97abb6c24c9ffabd"
});
const messaging = firebase.messaging();

const CACHE = 'rivapp-v3';
const SHELL = ['./', './index.html', './manifest.json', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

// Solo risorse dello stesso sito, solo GET. Le chiamate al server (POST, altro dominio) non si toccano mai.
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('./index.html'); }); })
  );
});

// ── Notifiche ───────────────────────────────────────────────
function _mostra(d) {
  d = d || {};
  const emergenza = d.tipo === 'EMERGENZA';
  const titolo = String(d.titolo || 'RivApp').slice(0, 120);
  const testo = String(d.testo || '').slice(0, 300);
  const opz = {
    body: testo,
    icon: 'icon-512.png',
    badge: 'icon-512.png',
    tag: emergenza ? 'rivapp-emergenza' : 'rivapp-' + String(d.tipo || 'info'),
    renotify: true,
    data: { tipo: String(d.tipo || '') }
  };
  if (emergenza) {
    opz.requireInteraction = true;            // resta sullo schermo finché non viene chiusa
    opz.vibrate = [600, 200, 600, 200, 600, 200, 1200];
    opz.silent = false;
  }
  return self.registration.showNotification(titolo, opz);
}

messaging.onBackgroundMessage(function (payload) {
  return _mostra(payload && payload.data);
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
