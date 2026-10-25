var CACHE = "mpc-v13";
var TILE_CACHE = "mpc-tiles-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/i18n.js",
  "./js/data.js",
  "./js/calc.js",
  "./js/recommend.js",
  "./js/charts.js",
  "./js/map.js",
  "./js/app.js",
  "./assets/vendor/chart.umd.min.js",
  "./assets/vendor/maplibre/maplibre-gl.js",
  "./assets/vendor/maplibre/maplibre-gl.css",
  "./assets/icons/icon.svg",
  "./manifest.webmanifest",
  "./data/agrimark.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE && key !== TILE_CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function tileStrategy(request) {
  return caches.open(TILE_CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.status === 200) cache.put(request, response.clone());
        return response;
      }).catch(function () {
        return Response.error();
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);

  if (/(^|\.)(tiles\.openfreemap\.org|tile\.openstreetmap\.org)$/.test(url.hostname)) {
    event.respondWith(tileStrategy(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf("/data/") !== -1) {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match("./index.html");
      });
    })
  );
});
