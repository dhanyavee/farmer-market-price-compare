(function (global) {
  "use strict";

  var WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WD_TA = ["\u0B9E\u0BBE\u0BAF\u0BBF\u0BB1\u0BCD\u0BB1\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB4\u0BAE\u0BC8", "\u0BA4\u0BBF\u0B99\u0BCD\u0B95\u0BB3\u0BCD", "\u0B9A\u0BC6\u0BB5\u0BCD\u0BB5\u0BBE\u0BAF\u0BCD", "\u0BAA\u0BC1\u0BA4\u0BA9\u0BCD", "\u0BB5\u0BBF\u0BAF\u0BBE\u0BB4\u0BA9\u0BCD", "\u0BB5\u0BC6\u0BB3\u0BCD\u0BB3\u0BBF", "\u0B9A\u0BA9\u0BBF"];

  function rank(results, options) {
    var opts = options || {};
    var localId = opts.localMarketId;
    var scored = results.map(function (r) {
      var open = global.MarketData.isOpenToday(r.market);
      var nextIn = global.MarketData.nextOpenDay(r.market);
      return {
        result: r,
        net: r.net,
        openToday: open,
        nextOpenInDays: nextIn
      };
    });

    scored.sort(function (a, b) {
      if (a.openToday !== b.openToday) return a.openToday ? -1 : 1;
      if (b.net !== a.net) return b.net - a.net;
      return a.result.distanceKm - b.result.distanceKm;
    });

    var best = scored[0];
    var local = scored.filter(function (s) { return s.result.market.id === localId; })[0];
    var gain = local ? best.net - local.net : 0;

    return {
      ranked: scored,
      best: best,
      local: local,
      gainVsLocal: global.MarketCalc.round2(gain)
    };
  }

  function buildReason(best, rankInfo, local, lang) {
    var r = best.result;
    var m = r.market;
    var name = lang === "ta" ? m.ta : m.en;
    var parts = [];
    if (lang === "ta") {
      parts.push(name + " \u0B9A\u0BA8\u0BCD\u0BA4\u0BC8\u0BAF\u0BBF\u0BB2\u0BCD \u0B85\u0BA4\u0BBF\u0B95 \u0BA8\u0BBF\u0B95\u0BB0\u0BCD \u0BA4\u0BCA\u0B95\u0BC8 \u0B95\u0BBF\u0B9F\u0BC8\u0B95\u0BCD\u0B95\u0BC1\u0BAE\u0BCD.");
      if (rankInfo.openToday) {
        parts.push("\u0B87\u0BA9\u0BCD\u0BB1\u0BC1 \u0BA4\u0BBF\u0BB1\u0BA8\u0BCD\u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1.");
      } else {
        parts.push(rankInfo.nextOpenInDays + " \u0BA8\u0BBE\u0B9F\u0BCD\u0B95\u0BB3\u0BBF\u0BB2\u0BCD \u0BA4\u0BBF\u0BB1\u0B95\u0BCD\u0B95\u0BC1\u0BAE\u0BCD.");
      }
      parts.push(r.distanceKm + " \u0B95\u0BBF.\u0BAE\u0BCD \u0BA4\u0BCA\u0BB2\u0BC8.");
    } else {
      parts.push("Best net return at " + name + ".");
      if (rankInfo.openToday) parts.push("Open today.");
      else parts.push("Opens in " + rankInfo.nextOpenInDays + (rankInfo.nextOpenInDays === 1 ? " day." : " days."));
      parts.push(r.distanceKm + " km away.");
    }
    if (local) {
      var diff = global.MarketCalc.round2(best.net - local.net);
      if (diff > 0) {
        parts.push(lang === "ta"
          ? ("\u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B89\u0BB3\u0BCD\u0BB3\u0BC2\u0BB0\u0BCD \u0B9A\u0BA8\u0BCD\u0BA4\u0BC8\u0BAF\u0BC8 \u0BB5\u0BBF\u0B9F \u0BB0\u0BC2." + diff + " \u0B85\u0BA4\u0BBF\u0B95\u0BAE\u0BCD.")
          : ("+Rs." + diff + " vs your local market."));
      }
    }
    return parts.join(" ");
  }

  global.MarketRecommend = {
    rank: rank,
    buildReason: buildReason,
    WD_EN: WD_EN,
    WD_TA: WD_TA
  };
})(window);
