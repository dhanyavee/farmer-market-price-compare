(function () {
  "use strict";

  var D = window.MarketData;
  var C = window.MarketCalc;
  var R = window.MarketRecommend;
  var t = window.I18N.t;

  var el = {};
  var state = { dataMode: "sample", live: {}, lastResult: null };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["crop", "localMarket", "quantity", "unit", "transportRate", "loading",
      "unloading", "commission", "mandiFee", "fixedTransport", "inputForm",
      "resultsSection", "recommendText", "recommendStats", "netChart",
      "trendChart", "resultsTable", "formError", "dataBadge", "langToggle",
      "netLegend", "compareBtn", "resetBtn", "liveBtn", "apiKey", "corsProxy"].forEach(function (id) {
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
    var key = cropId + "|" + marketId;
    if (state.live[key]) {
      var live = state.live[key];
      return { date: live.date, min: live.min, modal: live.modal, max: live.max };
    }
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
    if (state.dataMode === "live") {
      el.dataBadge.textContent = t("live");
      el.dataBadge.className = "badge badge-live";
    } else {
      el.dataBadge.textContent = t("sample");
      el.dataBadge.className = "badge badge-sample";
    }
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
    var results = C.computeAll({
      markets: D.getMarkets(),
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

    window.MarketCharts.renderNetChart(el.netChart, ranked.ranked, localId, lang);

    var topId = best.result.market.id;
    var seriesList = [D.getPriceSeries(payload.cropId, topId, 7)];
    var names = [marketName(best.result.market)];
    if (localId !== topId) {
      seriesList.push(D.getPriceSeries(payload.cropId, localId, 7));
      names.push(marketName(D.getMarket(localId)));
    }
    window.MarketCharts.renderTrendChart(el.trendChart, seriesList, names, lang);
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
    el.crop.value = D.getCrops()[0].id;
    el.localMarket.value = "dindigul";
    el.quantity.value = 100;
    el.unit.value = "kg";
    el.transportRate.value = 4;
    el.loading.value = 150;
    el.unloading.value = 100;
    el.commission.value = 2;
    el.mandiFee.value = 50;
    el.fixedTransport.value = 0;
    el.formError.textContent = "";
    state.lastResult = null;
    el.resultsSection.classList.add("hidden");
  }

  function matchLivePrices(records) {
    var crops = D.getCrops();
    var markets = D.getMarkets();
    var matched = 0;
    var overlay = {};
    records.forEach(function (rec) {
      var commodity = String(rec.commodity || "").toLowerCase();
      var marketNameLive = String(rec.market || "").toLowerCase();
      var crop = crops.filter(function (c) {
        return commodity === c.en.toLowerCase() || commodity.indexOf(c.en.toLowerCase()) !== -1;
      })[0];
      if (!crop) return;
      var market = markets.filter(function (m) {
        var short = m.en.split(" (")[0].toLowerCase();
        return marketNameLive === short || marketNameLive.indexOf(short) !== -1 || short.indexOf(marketNameLive) !== -1;
      })[0];
      if (!market) return;
      var modal = Number(rec.modal_price);
      if (!modal) return;
      overlay[crop.id + "|" + market.id] = {
        date: rec.arrival_date || "",
        min: Number(rec.min_price) || modal,
        modal: modal,
        max: Number(rec.max_price) || modal
      };
      matched++;
    });
    return { overlay: overlay, matched: matched };
  }

  function fetchLive() {
    var apiKey = (el.apiKey.value || "").trim();
    var proxy = (el.corsProxy.value || "").trim();
    saveSettings(apiKey, proxy);

    el.liveBtn.disabled = true;
    el.liveBtn.textContent = t("fetching");
    el.formError.textContent = "";

    if (!apiKey) {
      el.liveBtn.disabled = false;
      el.liveBtn.textContent = t("fetchLive");
      el.formError.textContent = t("liveNoKey");
      return;
    }

    D.fetchLivePrices(apiKey, proxy).then(function (payload) {
      var records = (payload && payload.records) || [];
      var result = matchLivePrices(records);
      if (result.matched > 0) {
        state.live = result.overlay;
        state.dataMode = "live";
        updateBadge();
        if (state.lastResult) run();
      } else {
        state.dataMode = "sample";
        updateBadge();
        el.formError.textContent = t("liveNoMatch");
      }
    }).catch(function (err) {
      state.dataMode = "sample";
      updateBadge();
      var msg = String(err && err.message || err);
      if (msg.indexOf("RATE_LIMIT") !== -1) el.formError.textContent = t("liveRateLimited");
      else if (msg.indexOf("AUTH") !== -1) el.formError.textContent = t("liveAuthFail");
      else el.formError.textContent = t("liveFail");
    }).then(function () {
      el.liveBtn.disabled = false;
      el.liveBtn.textContent = t("fetchLive");
    });
  }

  function saveSettings(apiKey, proxy) {
    try {
      localStorage.setItem("mpc_api_key", apiKey);
      localStorage.setItem("mpc_cors_proxy", proxy);
    } catch (e) {}
  }

  function loadSettings() {
    var apiKey = "";
    var proxy = "";
    try {
      apiKey = localStorage.getItem("mpc_api_key") || "";
      proxy = localStorage.getItem("mpc_cors_proxy") || "";
    } catch (e) {}
    el.apiKey.value = apiKey;
    el.corsProxy.value = proxy;
  }

  function bind() {
    el.inputForm.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    el.resetBtn.addEventListener("click", resetForm);
    el.liveBtn.addEventListener("click", fetchLive);
    el.langToggle.addEventListener("click", function () {
      window.I18N.setLang(window.I18N.getLang() === "ta" ? "en" : "ta");
      applyStaticText();
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
    loadSettings();
    bind();
    run();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
