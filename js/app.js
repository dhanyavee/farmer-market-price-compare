(function () {
  "use strict";

  var D = window.MarketData;
  var C = window.MarketCalc;
  var R = window.MarketRecommend;
  var t = window.I18N.t;

  var el = {};
  var state = { lastResult: null };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["crop", "localMarket", "quantity", "unit", "transportRate", "loading",
      "unloading", "commission", "mandiFee", "fixedTransport", "inputForm",
      "resultsSection", "recommendText", "recommendStats", "netChart",
      "trendChart", "resultsTable", "formError", "dataBadge", "langToggle",
      "netLegend", "compareBtn", "resetBtn", "liveBtn", "map"].forEach(function (id) {
      el[id] = $(id);
    });
  }

  function fillSelect(select, items, getName) {
    select.innerHTML = "";
    items.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = getName(item);
      select.appendChild(opt);
    });
  }

  function cropName(c) { return window.I18N.getLang() === "ta" ? c.ta : c.en; }
  function marketName(m) { return window.I18N.getLang() === "ta" ? m.ta : m.en; }

  function rebuildOptions() {
    var crops = D.getCrops();
    var markets = D.getMarkets();
    var prevCrop = el.crop.value;
    var prevMarket = el.localMarket.value;
    fillSelect(el.crop, crops, cropName);
    fillSelect(el.localMarket, markets, marketName);
    if (prevCrop) el.crop.value = prevCrop;
    if (prevMarket) el.localMarket.value = prevMarket;
  }

  function num(id) { return Number(el[id].value) || 0; }

  function priceFor(cropId, marketId) {
    return D.getLatestPrice(cropId, marketId);
  }

  function applyStaticText() {
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      node.textContent = t(key);
    });
    document.documentElement.lang = window.I18N.getLang() === "ta" ? "ta" : "en";
    el.langToggle.textContent = window.I18N.getLang() === "ta" ? "English" : "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";
    updateBadge();
    rebuildOptions();
    if (state.lastResult) render(state.lastResult);
  }

  function updateBadge() {
    if (D.getSource() === "agrimark") {
      var meta = D.getMeta();
      el.dataBadge.textContent = t("live") + " \u00B7 " + (meta.dateDisplay || "");
      el.dataBadge.className = "badge badge-live";
    } else {
      el.dataBadge.textContent = t("sample");
      el.dataBadge.className = "badge badge-sample";
    }
  }

  function filterByRadius(markets, localId, maxKm) {
    var local = D.getMarket(localId);
    if (!local) return markets;
    return markets.filter(function (m) {
      if (m.id === localId) return true;
      if (m.district && local.district && m.district === local.district) return true;
      return D.haversineKm(local.lat, local.lon, m.lat, m.lon) <= maxKm;
    });
  }

  function validate() {
    el.formError.textContent = "";
    if (!el.crop.value) { el.formError.textContent = t("enterCrop"); return false; }
    if (!el.localMarket.value) { el.formError.textContent = t("enterMarket"); return false; }
    if (!(num("quantity") > 0)) { el.formError.textContent = t("enterQuantity"); return false; }
    return true;
  }

  function collectConfig() {
    return {
      quantityKg: C.toKg(num("quantity"), el.unit.value),
      localMarketId: el.localMarket.value,
      ratePerKmPerQuintal: num("transportRate"),
      loading: num("loading"),
      unloading: num("unloading"),
      commissionPct: num("commission"),
      mandiFee: num("mandiFee"),
      fixedTransport: num("fixedTransport")
    };
  }

  function run() {
    if (!validate()) return;
    var cfg = collectConfig();
    var cropId = el.crop.value;
    var markets = D.getMarkets();
    if (D.getSource() === "agrimark") {
      markets = filterByRadius(markets, cfg.localMarketId, 150);
    }
    var results = C.computeAll({
      markets: markets,
      localMarketId: cfg.localMarketId,
      quantityKg: cfg.quantityKg,
      ratePerKmPerQuintal: cfg.ratePerKmPerQuintal,
      loading: cfg.loading,
      unloading: cfg.unloading,
      commissionPct: cfg.commissionPct,
      mandiFee: cfg.mandiFee,
      fixedTransport: cfg.fixedTransport,
      priceLookup: function (marketId) { return priceFor(cropId, marketId); }
    });
    var ranked = R.rank(results, { localMarketId: cfg.localMarketId });
    state.lastResult = { cfg: cfg, cropId: cropId, ranked: ranked };
    render(state.lastResult);
  }

  function render(payload) {
    var ranked = payload.ranked;
    var lang = window.I18N.getLang();
    var localId = payload.cfg.localMarketId;
    el.resultsSection.classList.remove("hidden");

    var best = ranked.best;
    el.recommendText.textContent = R.buildReason(best, best, ranked.local, lang);

    var gain = ranked.gainVsLocal;
    el.recommendStats.innerHTML = "";
    addStat(el.recommendStats, t("net"), C.round2(best.net).toLocaleString("en-IN"), "best");
    addStat(el.recommendStats, t("distance"), best.result.distanceKm + " km");
    if (ranked.local) {
      addStat(el.recommendStats, t("legendLocal"), C.round2(ranked.local.net).toLocaleString("en-IN"));
      addStat(el.recommendStats, "Gain", (gain >= 0 ? "+₹" : "-₹") + Math.abs(C.round2(gain)).toLocaleString("en-IN"), gain >= 0 ? "best" : "bad");
    }

    renderTable(ranked, localId);
    renderLegend();

    window.MarketCharts.renderNetChart(el.netChart, ranked.ranked.slice(0, 15), localId, lang);

    var topId = best.result.market.id;
    var seriesList;
    var names;
    if (D.getSource() === "agrimark") {
      seriesList = [D.getPriceSeries(payload.cropId, topId, 7)];
      names = [t("tnAverage")];
    } else {
      seriesList = [D.getPriceSeries(payload.cropId, topId, 7)];
      names = [marketName(best.result.market)];
      if (localId !== topId) {
        seriesList.push(D.getPriceSeries(payload.cropId, localId, 7));
        names.push(marketName(D.getMarket(localId)));
      }
    }
    window.MarketCharts.renderTrendChart(el.trendChart, seriesList, names, lang);

    if (window.MarketMap) {
      window.MarketMap.init("map");
      window.MarketMap.render(ranked, localId, lang, {
        onUseMarket: function (id) {
          el.localMarket.value = id;
          run();
        }
      });
      setTimeout(function () { window.MarketMap.invalidate(); }, 0);
    }
  }

  function addStat(container, label, value, cls) {
    var div = document.createElement("div");
    div.className = "stat" + (cls ? " stat-" + cls : "");
    var l = document.createElement("span");
    l.className = "stat-label";
    l.textContent = label;
    var v = document.createElement("strong");
    v.className = "stat-value";
    v.textContent = value;
    div.appendChild(l);
    div.appendChild(v);
    container.appendChild(div);
  }

  function renderTable(ranked, localId) {
    var tbody = el.resultsTable.querySelector("tbody");
    tbody.innerHTML = "";
    ranked.ranked.forEach(function (s, index) {
      var r = s.result;
      var tr = document.createElement("tr");
      if (index === 0) tr.className = "row-best";
      if (r.market.id === localId) tr.className = "row-local";
      var status = s.openToday ? t("openToday") : t("closed") + " (" + s.nextOpenInDays + "d)";
      [marketName(r.market), r.market.district, r.distanceKm + " km",
        "₹" + r.price.modal.toLocaleString("en-IN"),
        "₹" + r.gross.toLocaleString("en-IN"),
        "₹" + r.totalCost.toLocaleString("en-IN"),
        "₹" + r.net.toLocaleString("en-IN"), status
      ].forEach(function (text, i) {
        var td = document.createElement("td");
        td.textContent = text;
        if (i === 6) td.className = "net-cell";
        if (i === 7) td.className = s.openToday ? "status-open" : "status-closed";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderLegend() {
    var items = ["legendLocal", "legendOpen", "legendClosed"];
    var classes = { legendLocal: "sw-local", legendOpen: "sw-open", legendClosed: "sw-closed" };
    el.netLegend.innerHTML = "";
    items.forEach(function (key) {
      var span = document.createElement("span");
      span.className = "legend-item";
      var sw = document.createElement("i");
      sw.className = "swatch " + classes[key];
      span.appendChild(sw);
      span.appendChild(document.createTextNode(t(key)));
      el.netLegend.appendChild(span);
    });
  }

  function resetForm() {
    el.inputForm.reset();
    el.crop.value = "";
    el.localMarket.value = "";
    el.quantity.value = 100;
    el.unit.value = "kg";
    el.transportRate.value = 4;
    el.loading.value = 150;
    el.unloading.value = 100;
    el.commission.value = 2;
    el.mandiFee.value = 50;
    el.fixedTransport.value = 0;
    setDefaultsIfNeeded(null);
    el.formError.textContent = "";
    state.lastResult = null;
    el.resultsSection.classList.add("hidden");
  }

  function loadAgrimark() {
    var wasLive = D.getSource() === "agrimark";
    el.liveBtn.disabled = true;
    el.liveBtn.textContent = t("fetching");
    el.formError.textContent = "";

    D.loadAgrimark().then(function (payload) {
      D.useAgrimark(payload);
      updateBadge();
      var prevCrop = el.crop.value;
      rebuildOptions();
      setDefaultsIfNeeded(prevCrop);
      run();
    }).catch(function () {
      if (wasLive) {
        el.formError.textContent = t("liveUnavailable");
        return;
      }
      D.useSample();
      updateBadge();
      el.formError.textContent = t("liveUnavailable");
    }).then(function () {
      el.liveBtn.disabled = false;
      el.liveBtn.textContent = t("liveFetch");
    });
  }

  function setDefaultsIfNeeded(prevCrop) {
    var crops = D.getCrops();
    var markets = D.getMarkets();
    var cropExists = crops.filter(function (c) { return String(c.id) === String(prevCrop); }).length > 0;
    if (!cropExists) el.crop.value = crops[0].id;
    var marketExists = markets.filter(function (m) { return m.id === el.localMarket.value; }).length > 0;
    if (!marketExists) {
      if (D.getSource() === "agrimark") {
        el.localMarket.value = D.getDefaultMarketId(el.crop.value);
      } else {
        var preferred = ["Dindigul", "Madurai", "Chennai", "Coimbatore"];
        var pick = null;
        for (var i = 0; i < preferred.length && !pick; i++) {
          pick = markets.filter(function (m) { return m.en === preferred[i]; })[0] || null;
        }
        el.localMarket.value = (pick || markets[0]).id;
      }
    }
  }

  function bind() {
    el.inputForm.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    el.resetBtn.addEventListener("click", resetForm);
    el.liveBtn.addEventListener("click", loadAgrimark);
    el.langToggle.addEventListener("click", function () {
      window.I18N.setLang(window.I18N.getLang() === "ta" ? "en" : "ta");
      applyStaticText();
    });
    window.addEventListener("resize", function () {
      if (window.MarketMap) window.MarketMap.invalidate();
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  function setDefaults() {
    var crops = D.getCrops();
    var markets = D.getMarkets();
    el.crop.value = crops[0].id;
    var hasDindigul = markets.filter(function (m) { return m.id === "dindigul"; }).length > 0;
    el.localMarket.value = hasDindigul ? "dindigul" : markets[0].id;
  }

  function init() {
    cacheEls();
    window.I18N.setLang("en");
    applyStaticText();
    setDefaults();
    bind();
    run();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
