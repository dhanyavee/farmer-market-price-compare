(function (global) {
  "use strict";

  var KG_PER_QUINTAL = 100;

  var UNIT_TO_KG = {
    kg: 1,
    quintal: 100,
    tonne: 1000
  };

  function toKg(quantity, unit) {
    var f = UNIT_TO_KG[unit];
    if (!f) f = 1;
    return Number(quantity) * f;
  }

  function toQuintal(kg) {
    return Number(kg) / KG_PER_QUINTAL;
  }

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function computeMarket(options) {
    var quantityKg = Number(options.quantityKg) || 0;
    var pricePerQuintal = Number(options.pricePerQuintal) || 0;
    var distanceKm = Number(options.distanceKm) || 0;
    var ratePerKmPerQuintal = Number(options.ratePerKmPerQuintal) || 0;
    var loading = Number(options.loading) || 0;
    var unloading = Number(options.unloading) || 0;
    var commissionPct = Number(options.commissionPct) || 0;
    var mandiFee = Number(options.mandiFee) || 0;
    var fixedTransport = Number(options.fixedTransport) || 0;

    var quintals = toQuintal(quantityKg);
    var gross = (pricePerQuintal / KG_PER_QUINTAL) * quantityKg;
    var transport = fixedTransport > 0
      ? fixedTransport
      : distanceKm * ratePerKmPerQuintal * quintals;
    var commission = (commissionPct / 100) * gross;
    var fees = loading + unloading + commission + mandiFee;
    var net = gross - transport - fees;

    return {
      quantityKg: quantityKg,
      quintals: round2(quintals),
      pricePerQuintal: pricePerQuintal,
      gross: round2(gross),
      transport: round2(transport),
      commission: round2(commission),
      fees: round2(fees),
      totalCost: round2(transport + fees),
      net: round2(net),
      netPerQuintal: quintals > 0 ? round2(net / quintals) : 0
    };
  }

  function computeAll(config) {
    var all = config.markets || [];
    var localId = config.localMarketId;
    var local = all.filter(function (m) { return m.id === localId; })[0] || null;
    var markets = all.filter(function (m) {
      return !!config.priceLookup(m.id);
    });

    return markets.map(function (m) {
      var price = config.priceLookup(m.id);
      var distanceKm = local ? global.MarketData.haversineKm(local.lat, local.lon, m.lat, m.lon) : 0;
      var math = computeMarket({
        quantityKg: config.quantityKg,
        pricePerQuintal: price.modal,
        distanceKm: m.id === localId ? 0 : distanceKm,
        ratePerKmPerQuintal: config.ratePerKmPerQuintal,
        loading: config.loading,
        unloading: config.unloading,
        commissionPct: config.commissionPct,
        mandiFee: config.mandiFee,
        fixedTransport: config.fixedTransport
      });
      math.market = m;
      math.distanceKm = m.id === localId ? 0 : distanceKm;
      math.price = price;
      return math;
    });
  }

  global.MarketCalc = {
    KG_PER_QUINTAL: KG_PER_QUINTAL,
    toKg: toKg,
    toQuintal: toQuintal,
    computeMarket: computeMarket,
    computeAll: computeAll,
    round2: round2
  };
})(window);
