(function (global) {
  "use strict";

  var CROPS = [
    { id: "tomato", en: "Tomato", ta: "\u0BA4\u0B95\u0BCD\u0B95\u0BBE\u0BB3\u0BBF", base: 1800 },
    { id: "onion", en: "Onion", ta: "\u0BB5\u0BC6\u0B99\u0BCD\u0B95\u0BBE\u0BAF\u0BAE\u0BCD", base: 2200 },
    { id: "potato", en: "Potato", ta: "\u0B89\u0BB0\u0BC1\u0BB3\u0BC8\u0B95\u0BCD\u0B95\u0BBF\u0BB4\u0B99\u0BCD\u0B95\u0BC1", base: 2400 },
    { id: "brinjal", en: "Brinjal", ta: "\u0B95\u0BA4\u0BCD\u0BA4\u0BB0\u0BBF\u0B95\u0BCD\u0B95\u0BBE\u0BAF\u0BCD", base: 2000 },
    { id: "okra", en: "Lady's Finger", ta: "\u0BB5\u0BC6\u0BA3\u0BCD\u0B9F\u0BC8\u0B95\u0BCD\u0B95\u0BBE\u0BAF\u0BCD", base: 2800 },
    { id: "carrot", en: "Carrot", ta: "\u0B95\u0BBE\u0BB0\u0BC6\u0B9F\u0BCD", base: 2600 },
    { id: "cabbage", en: "Cabbage", ta: "\u0BAE\u0BC1\u0B9F\u0BCD\u0B9F\u0BC8\u0B95\u0BCD\u0B95\u0BCB\u0BB8\u0BCD", base: 1500 },
    { id: "cauliflower", en: "Cauliflower", ta: "\u0B95\u0BBE\u0BB2\u0BBF\u0BAB\u0BCD\u0BB2\u0BB5\u0BB0\u0BCD", base: 2000 },
    { id: "chilli", en: "Green Chilli", ta: "\u0BAA\u0B9A\u0BCD\u0B9A\u0BC8\u0BAE\u0BBF\u0BB3\u0B95\u0BBE\u0BAF\u0BCD", base: 3500 },
    { id: "beans", en: "Beans", ta: "\u0B85\u0BB5\u0BB0\u0BC8", base: 3200 },
    { id: "banana", en: "Banana", ta: "\u0BB5\u0BBE\u0BB4\u0BC8\u0BAA\u0BCD\u0BAA\u0BB4\u0BAE\u0BCD", base: 2000 },
    { id: "mango", en: "Mango", ta: "\u0BAE\u0BBE\u0B99\u0BCD\u0B95\u0BBE\u0BAF\u0BCD", base: 5000 },
    { id: "coconut", en: "Coconut", ta: "\u0BA4\u0BC6\u0BA9\u0BCD\u0BA9\u0BC8", base: 3000 },
    { id: "coriander", en: "Coriander", ta: "\u0B95\u0BCA\u0BA4\u0BCD\u0BA4\u0BAE\u0BB2\u0BCD\u0BB2\u0BBF", base: 4000 },
    { id: "paddy", en: "Paddy", ta: "\u0BA8\u0BC6\u0BB2\u0BCD", base: 2200 },
    { id: "maize", en: "Maize", ta: "\u0B9A\u0BCB\u0BB3\u0BAE\u0BCD", base: 2100 },
    { id: "groundnut", en: "Groundnut", ta: "\u0BA8\u0BBF\u0BB2\u0B95\u0BCD\u0B95\u0B9F\u0BB2\u0BC8", base: 6500 },
    { id: "turmeric", en: "Turmeric", ta: "\u0BAE\u0B9E\u0BCD\u0B9A\u0BB3\u0BCD", base: 7000 },
    { id: "cotton", en: "Cotton", ta: "\u0BAA\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BBF", base: 7200 },
    { id: "sugarcane", en: "Sugarcane", ta: "\u0B95\u0BB0\u0BC1\u0BAE\u0BCD\u0BAA\u0BC1", base: 3200 }
  ];

  var MARKETS = [
    { id: "oddanchatram", en: "Oddanchatram", ta: "\u0B92\u0B9F\u0BCD\u0B9F\u0BA9\u0BCD\u0B9A\u0BA4\u0BCD\u0BA4\u0BBF\u0BB0\u0BAE\u0BCD", district: "Dindigul", lat: 10.48, lon: 77.75, openDays: [0, 1, 2, 3, 4, 5, 6], factor: 1.22 },
    { id: "madurai", en: "Madurai (Mattuthavani)", ta: "\u0BAE\u0BA4\u0BC1\u0BB0\u0BC8", district: "Madurai", lat: 9.925, lon: 78.14, openDays: [0, 1, 2, 3, 4, 5, 6], factor: 1.14 },
    { id: "coimbatore", en: "Coimbatore", ta: "\u0B95\u0BCB\u0BAF\u0BAE\u0BCD\u0BAA\u0BA4\u0BCD\u0BA4\u0BC2\u0BB0\u0BCD", district: "Coimbatore", lat: 11.02, lon: 76.96, openDays: [0, 1, 2, 3, 4, 5, 6], factor: 1.18 },
    { id: "chennai", en: "Chennai (Koyambedu)", ta: "\u0B9A\u0BC6\u0BA9\u0BCD\u0BA9\u0BC8", district: "Chennai", lat: 13.07, lon: 80.19, openDays: [0, 1, 2, 3, 4, 5, 6], factor: 1.28 },
    { id: "salem", en: "Salem", ta: "\u0B9A\u0BC7\u0BB2\u0BAE\u0BCD", district: "Salem", lat: 11.66, lon: 78.15, openDays: [2, 5], factor: 1.06 },
    { id: "erode", en: "Erode", ta: "\u0B88\u0BB0\u0BCB\u0B9F\u0BC1", district: "Erode", lat: 11.34, lon: 77.72, openDays: [3, 6], factor: 1.10 },
    { id: "trichy", en: "Tiruchirappalli", ta: "\u0BA4\u0BBF\u0BB0\u0BC1\u0B9A\u0BCD\u0B9A\u0BBF\u0BB0\u0BBE\u0BAA\u0BCD\u0BAA\u0BB3\u0BCD\u0BB3\u0BBF", district: "Tiruchirappalli", lat: 10.79, lon: 78.70, openDays: [1, 4], factor: 1.09 },
    { id: "thanjavur", en: "Thanjavur", ta: "\u0BA4\u0B9E\u0BCD\u0B9A\u0BBE\u0BB5\u0BC2\u0BB0\u0BCD", district: "Thanjavur", lat: 10.79, lon: 79.14, openDays: [2, 6], factor: 1.05 },
    { id: "tirunelveli", en: "Tirunelveli", ta: "\u0BA4\u0BBF\u0BB0\u0BC1\u0BA8\u0BC6\u0BB2\u0BCD\u0BB5\u0BC7\u0BB2\u0BBF", district: "Tirunelveli", lat: 8.71, lon: 77.76, openDays: [3, 0], factor: 1.03 },
    { id: "vellore", en: "Vellore", ta: "\u0BB5\u0BC7\u0BB2\u0BC2\u0BB0\u0BCD", district: "Vellore", lat: 12.92, lon: 79.13, openDays: [1, 5], factor: 1.12 },
    { id: "dindigul", en: "Dindigul", ta: "\u0BA4\u0BBF\u0BA3\u0BCD\u0B9F\u0BC1\u0B95\u0BCD\u0B95\u0BB2\u0BCD", district: "Dindigul", lat: 10.37, lon: 77.98, openDays: [0, 1, 2, 3, 4, 5, 6], factor: 0.98 },
    { id: "hosur", en: "Hosur", ta: "\u0BB9\u0BCA\u0B9A\u0BC2\u0BB0\u0BCD", district: "Krishnagiri", lat: 12.74, lon: 77.83, openDays: [2, 5], factor: 1.16 },
    { id: "pollachi", en: "Pollachi", ta: "\u0BAA\u0BCA\u0BB3\u0BCD\u0BB3\u0BBE\u0B9A\u0BCD\u0B9A\u0BBF", district: "Coimbatore", lat: 10.66, lon: 77.01, openDays: [1, 3], factor: 1.08 },
    { id: "nagercoil", en: "Nagercoil", ta: "\u0BA8\u0BBE\u0B95\u0BB0\u0BCD\u0B95\u0BCB\u0BB5\u0BBF\u0BB2\u0BCD", district: "Kanyakumari", lat: 8.18, lon: 77.43, openDays: [4, 0], factor: 1.04 },
    { id: "panruti", en: "Panruti", ta: "\u0BAA\u0BA9\u0BCD\u0BB0\u0BC1\u0B9F\u0BCD\u0B9F\u0BBF", district: "Cuddalore", lat: 11.77, lon: 79.55, openDays: [1, 4], factor: 1.07 }
  ];

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rand01(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function dayKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function priceFor(crop, market, dayOffset) {
    var seed = hashSeed(crop.id + "|" + market.id + "|" + dayOffset);
    var trendBase = hashSeed(crop.id + "|" + market.id);
    var trend = (rand01(trendBase) - 0.5) * 0.06;
    var wave = (rand01(seed) - 0.5) * 0.12;
    var modal = crop.base * market.factor * (1 + trend * dayOffset + wave);
    modal = Math.max(200, Math.round(modal / 10) * 10);
    var spread = 0.12 + rand01(seed + 7) * 0.08;
    var min = Math.round((modal * (1 - spread)) / 10) * 10;
    var max = Math.round((modal * (1 + spread)) / 10) * 10;
    return { date: dayKey(dayOffset), min: min, modal: modal, max: max };
  }

  var ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  var source = "sample";
  var agrimark = null;

  function useSample() { source = "sample"; return source; }
  function useAgrimark(payload) { agrimark = payload; source = "agrimark"; return source; }
  function getSource() { return source; }

  function amCrops() {
    if (!agrimark) return CROPS;
    return agrimark.crops.map(function (c) {
      return { id: String(c.id), en: c.name, ta: c.name, base: 0 };
    });
  }

  function spreadDuplicates(list) {
    var used = {};
    function key(lat, lon) { return Math.round(lat * 1000) + ":" + Math.round(lon * 1000); }
    var ordered = list.slice().sort(function (a, b) {
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });
    return ordered.map(function (m) {
      var lat = m.lat, lon = m.lon, step = 0;
      while (used[key(lat, lon)]) {
        step += 1;
        var angle = step * 2.399963229728653;
        var radius = 0.012 * Math.sqrt(step);
        lat = m.lat + radius * Math.cos(angle);
        lon = m.lon + radius * Math.sin(angle);
      }
      used[key(lat, lon)] = true;
      var out = {};
      for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) out[k] = m[k]; }
      out.lat = Math.round(lat * 1000000) / 1000000;
      out.lon = Math.round(lon * 1000000) / 1000000;
      return out;
    });
  }

  function amMarkets() {
    if (!agrimark) return MARKETS;
    var list = Object.keys(agrimark.markets).map(function (key) {
      var m = agrimark.markets[key];
      return {
        id: key,
        en: m.name,
        ta: m.ta || m.name,
        district: m.district || "",
        lat: m.lat,
        lon: m.lon,
        openDays: ALL_DAYS
      };
    });
    return spreadDuplicates(list).sort(function (a, b) { return a.en.localeCompare(b.en); });
  }

  function getCrops() { return source === "agrimark" ? amCrops() : CROPS; }
  function getMarkets() { return source === "agrimark" ? amMarkets() : MARKETS; }
  function getCrop(id) {
    var list = getCrops();
    return list.filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }
  function getMarket(id) {
    var list = getMarkets();
    return list.filter(function (m) { return String(m.id) === String(id); })[0] || null;
  }

  function getPriceSeries(cropId, marketId, days) {
    var n = typeof days === "number" ? days : 7;
    var out = [];
    if (source === "agrimark") {
      var hist = getHistory(cropId);
      var slice = hist.slice(-n);
      return slice.map(function (e) {
        return {
          date: e.date,
          min: round(e.avg * 100 * 0.9),
          modal: round(e.avg * 100),
          max: round(e.avg * 100 * 1.1)
        };
      });
    }
    var crop = getCrop(cropId);
    var market = getMarket(marketId);
    if (!crop || !market) return [];
    for (var i = n - 1; i >= 0; i--) out.push(priceFor(crop, market, -i));
    return out;
  }

  function getLatestPrice(cropId, marketId) {
    if (source === "agrimark") {
      var rec = agrimark && agrimark.prices[cropId] && agrimark.prices[cropId][marketId];
      if (!rec) return null;
      return {
        date: agrimark.date,
        min: round(rec.min * 100),
        modal: round(rec.modal * 100),
        max: round(rec.max * 100),
        qty: rec.qty
      };
    }
    var crop = getCrop(cropId);
    var market = getMarket(marketId);
    if (!crop || !market) return null;
    return priceFor(crop, market, 0);
  }

  function getHistory(cropId) {
    if (!agrimark || !agrimark.history) return [];
    return agrimark.history[String(cropId)] || [];
  }

  function getMeta() {
    if (source === "agrimark" && agrimark) {
      return {
        source: agrimark.source,
        sourceUrl: agrimark.sourceUrl,
        date: agrimark.date,
        dateDisplay: agrimark.dateDisplay,
        unitPerKg: true
      };
    }
    return { source: "Sample data", sourceUrl: "", date: null, unitPerKg: false };
  }

  function round(n) { return Math.round(Number(n) * 100) / 100; }

  function isOpenToday(market, date) {
    var d = date || new Date();
    return market.openDays.indexOf(d.getDay()) !== -1;
  }

  function nextOpenDay(market, date) {
    var d = date || new Date();
    for (var i = 0; i <= 7; i++) {
      var probe = new Date(d.getTime());
      probe.setDate(probe.getDate() + i);
      if (market.openDays.indexOf(probe.getDay()) !== -1) return i;
    }
    return 7;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1.3 * 10) / 10;
  }

  function getDefaultMarketId(cropId) {
    if (source !== "agrimark" || !agrimark) return "dindigul";
    var coverage = {};
    Object.keys(agrimark.prices).forEach(function (c) {
      Object.keys(agrimark.prices[c]).forEach(function (m) {
        coverage[m] = (coverage[m] || 0) + 1;
      });
    });
    var candidates = (cropId && agrimark.prices[cropId])
      ? Object.keys(agrimark.prices[cropId])
      : Object.keys(agrimark.markets);
    var best = null;
    var bestCov = -1;
    candidates.forEach(function (m) {
      var c = coverage[m] || 0;
      if (c > bestCov) { bestCov = c; best = m; }
    });
    return best || Object.keys(agrimark.markets)[0];
  }

  function agrimarkUrl() {
    var cfg = global.APP_CONFIG || {};
    var base = String(cfg.liveApiBase || "").replace(/\/+$/, "");
    return base ? base + "/api/agrimark.json" : "data/agrimark.json";
  }

  function fetchAgrimark(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP_" + r.status);
      return r.json();
    }).then(function (payload) {
      if (!payload || !payload.prices || !payload.markets) throw new Error("BAD_DATA");
      if (!Object.keys(payload.prices).length) throw new Error("EMPTY_PRICES");
      return payload;
    });
  }

  function loadAgrimark() {
    var primary = agrimarkUrl();
    return fetchAgrimark(primary).catch(function (err) {
      if (primary === "data/agrimark.json") throw err;
      return fetchAgrimark("data/agrimark.json");
    });
  }

  global.MarketData = {
    getCrops: getCrops,
    getMarkets: getMarkets,
    getCrop: getCrop,
    getMarket: getMarket,
    getPriceSeries: getPriceSeries,
    getLatestPrice: getLatestPrice,
    getHistory: getHistory,
    getMeta: getMeta,
    getDefaultMarketId: getDefaultMarketId,
    isOpenToday: isOpenToday,
    nextOpenDay: nextOpenDay,
    haversineKm: haversineKm,
    loadAgrimark: loadAgrimark,
    useSample: useSample,
    useAgrimark: useAgrimark,
    getSource: getSource
  };
})(window);
