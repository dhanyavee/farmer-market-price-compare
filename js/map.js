(function (global) {
  "use strict";

  var t = global.I18N ? global.I18N.t : function (k) { return k; };
  var ml = global.maplibregl;

  var DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/bright";
  var EMPTY = { type: "FeatureCollection", features: [] };

  var map = null;
  var onUse = null;
  var layersReady = false;
  var pending = null;

  function styleUrl() {
    var cfg = global.APP_CONFIG || {};
    return cfg.mapStyle || DEFAULT_STYLE;
  }

  function priceShort(perQuintal) {
    var n = Number(perQuintal) || 0;
    if (n >= 1000) {
      var k = (n / 1000).toFixed(1);
      if (k.slice(-2) === ".0") k = k.slice(0, -2);
      return "\u20B9" + k + "k";
    }
    return "\u20B9" + Math.round(n);
  }

  function priceFull(perQuintal) {
    return "\u20B9" + Math.round(Number(perQuintal) || 0).toLocaleString("en-IN");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // White rounded rectangle used as the background behind the price text.
  function makeBgImage() {
    var size = 32;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 1.5, 1.5, size - 3, size - 3, 8);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(17, 24, 39, 0.35)";
    ctx.stroke();
    return ctx.getImageData(0, 0, size, size);
  }

  function init(containerId) {
    if (!ml) return null;
    if (map) return map;
    map = new ml.Map({
      container: containerId,
      style: styleUrl(),
      center: [78.5, 11.0],
      zoom: 6.6
    });
    map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", function () {
      addLayers();
      layersReady = true;
      if (pending) {
        setData(pending);
        pending = null;
      }
    });
    return map;
  }

  function addLayers() {
    map.addSource("markets", {
      type: "geojson",
      data: EMPTY,
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 13
    });

    if (!map.hasImage("price-bg")) {
      try {
        map.addImage("price-bg", makeBgImage(), { sdf: true, pixelRatio: 1 });
      } catch (err) {
        /* canvas unavailable - text halo still keeps the label readable */
      }
    }

    map.addLayer({
      id: "markets-clusters",
      type: "circle",
      source: "markets",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#15803d",
        "circle-opacity": 0.9,
        "circle-radius": ["step", ["get", "point_count"], 16, 12, 22, 50, 28],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff"
      }
    });
    map.addLayer({
      id: "markets-cluster-count",
      type: "symbol",
      source: "markets",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 13
      },
      paint: { "text-color": "#ffffff" }
    });
    map.addLayer({
      id: "markets-points",
      type: "circle",
      source: "markets",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "case",
          ["get", "major"], "#2563eb",
          ["match", ["get", "state"], "local", "#d97706", "closed", "#94a3b8", "#16a34a"]
        ],
        "circle-radius": ["case", ["get", "major"], 6, 8],
        "circle-stroke-width": ["case", ["get", "best"], 3, 2],
        "circle-stroke-color": ["case", ["get", "best"], "#111827", "#ffffff"]
      }
    });
    map.addLayer({
      id: "markets-labels",
      type: "symbol",
      source: "markets",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "price-bg",
        "icon-text-fit": "both",
        "icon-text-fit-padding": [4, 8, 4, 8],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 13,
        "text-offset": [0, -2.1],
        "text-anchor": "bottom",
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
      paint: {
        "icon-color": [
          "case",
          ["get", "major"], "#2563eb",
          ["get", "best"], "#15803d",
          ["match", ["get", "state"], "local", "#d97706", "closed", "#64748b", "#16a34a"]
        ],
        "icon-halo-color": "#ffffff",
        "icon-halo-width": 1.5,
        "icon-opacity": 0.97,
        "text-color": "#ffffff"
      }
    });

    map.on("click", "markets-clusters", function (e) {
      var feature = e.features[0];
      var clusterId = feature.properties.cluster_id;
      map.getSource("markets").getClusterExpansionZoom(clusterId, function (err, zoom) {
        if (err) return;
        map.easeTo({ center: feature.geometry.coordinates, zoom: zoom });
      });
    });
    map.on("click", "markets-points", function (e) {
      openPopup(e.features[0]);
    });
    ["markets-clusters", "markets-points"].forEach(function (layer) {
      map.on("mouseenter", layer, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, function () { map.getCanvas().style.cursor = ""; });
    });
  }

  function openPopup(feature) {
    var p = feature.properties;
    var box = document.createElement("div");
    box.className = "map-popup";

    var heading = document.createElement("strong");
    heading.className = "mp-name";
    heading.textContent = p.name + (p.district ? " \u00B7 " + p.district : "");
    box.appendChild(heading);

    var rows = [
      [t("price"), p.priceFull],
      [t("distance"), p.distanceKm + " km"]
    ];
    if (p.netFull) rows.push([t("net"), p.netFull]);
    rows.push([t("status"), p.statusLabel]);
    rows.forEach(function (row) {
      var line = document.createElement("div");
      line.className = "mp-row";
      var label = document.createElement("span");
      label.textContent = row[0];
      var value = document.createElement("strong");
      value.textContent = row[1];
      line.appendChild(label);
      line.appendChild(value);
      box.appendChild(line);
    });

    if (!p.isLocal && onUse) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mp-btn";
      btn.textContent = t("useThisMarket");
      btn.addEventListener("click", function () { onUse(p.id); });
      box.appendChild(btn);
    }

    new ml.Popup({ offset: 12, closeButton: true, maxWidth: "260px" })
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(box)
      .addTo(map);
  }

  function setData(fc) {
    var source = map.getSource("markets");
    if (source) source.setData(fc);
  }

  function render(ranked, localId, lang, options) {
    if (!init("map")) return;
    onUse = (options && options.onUseMarket) || null;

    var bestId = ranked.best && ranked.best.result.market.id;
    var features = [];
    var bounds = new ml.LngLatBounds();
    var count = 0;
    var seen = {};

    ranked.ranked.forEach(function (entry) {
      var r = entry.result;
      var m = r.market;
      if (typeof m.lat !== "number" || typeof m.lon !== "number") return;
      seen[m.id] = true;

      var state = m.id === localId ? "local" : (entry.openToday ? "open" : "closed");
      var name = lang === "ta" ? m.ta : m.en;
      var statusLabel = entry.openToday ? t("openToday") : (t("closed") + " (" + entry.nextOpenInDays + "d)");

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lon, m.lat] },
        properties: {
          id: m.id,
          name: name,
          district: m.district || "",
          state: state,
          major: false,
          best: m.id === bestId,
          isLocal: m.id === localId,
          label: priceShort(r.price.modal),
          priceFull: priceFull(r.price.modal),
          netFull: priceFull(r.net),
          distanceKm: r.distanceKm,
          statusLabel: statusLabel
        }
      });
      bounds.extend([m.lon, m.lat]);
      count += 1;
    });

    ((options && options.majors) || []).forEach(function (item) {
      var m = item && item.market;
      if (!m || seen[m.id]) return;
      if (typeof m.lat !== "number" || typeof m.lon !== "number") return;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lon, m.lat] },
        properties: {
          id: m.id,
          name: lang === "ta" ? m.ta : m.en,
          district: m.district || "",
          state: "major",
          major: true,
          best: false,
          isLocal: false,
          label: priceShort(item.price.modal),
          priceFull: priceFull(item.price.modal),
          netFull: null,
          distanceKm: item.distanceKm,
          statusLabel: t("majorMarket")
        }
      });
      bounds.extend([m.lon, m.lat]);
      count += 1;
    });

    var fc = { type: "FeatureCollection", features: features };
    if (layersReady) setData(fc);
    else pending = fc;

    if (count) {
      var fit = function () { map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 0 }); };
      if (map.loaded()) fit();
      else map.once("load", fit);
    }
  }

  function invalidate() {
    if (map) map.resize();
  }

  global.MarketMap = { init: init, render: render, invalidate: invalidate };
})(window);
