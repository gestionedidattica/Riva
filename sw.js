/* RivApp - service worker: cache offline di base + notifiche push (FCM, messaggi solo-dati).
   Le notifiche le mostra SEMPRE questo file (il server non invia mai il blocco "notification"),
   così non ci sono doppioni e il testo è sotto il controllo del server. */
// Se le librerie Firebase mancano (file non caricati nella root), il service worker deve comunque
// installarsi: altrimenti l'app non è più "installabile" e il banner di installazione sparisce.
let messaging = null;
try {
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
  messaging = firebase.messaging();
} catch (e) { /* notifiche non disponibili, il resto dell'app funziona */ }

const CACHE = 'rivapp-v5';
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

// File dell'app (stesso sito, solo GET): si serve subito la copia salvata e intanto la si aggiorna in
// background ("stale-while-revalidate"): l'app si apre all'istante. Le chiamate al server (POST, altro
// dominio) non si toccano mai. Un aggiornamento dell'app si vede alla riapertura successiva.
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (cached) {
        const rete = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone());
          return res;
        }).catch(function () { return cached || c.match('./index.html'); });
        return cached || rete;
      });
    })
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

if (messaging) {
  messaging.onBackgroundMessage(function (payload) {
    return _mostra(payload && payload.data);
  });
}

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
