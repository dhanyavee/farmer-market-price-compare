(function (global) {
  "use strict";

  var netChart = null;
  var trendChart = null;

  function money(v) {
    return "\u20B9" + Math.round(v).toLocaleString("en-IN");
  }

  function renderNetChart(canvas, ranked, localId, lang) {
    var labels = ranked.map(function (s) { return lang === "ta" ? s.result.market.ta : s.result.market.en; });
    var values = ranked.map(function (s) { return s.result.net; });
    var colors = ranked.map(function (s) {
      if (s.result.market.id === localId) return "#f59e0b";
      return s.openToday ? "#16a34a" : "#94a3b8";
    });
    if (netChart) netChart.destroy();
    netChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: lang === "ta" ? "\u0BA8\u0BBF\u0B95\u0BB0\u0BCD \u0BA4\u0BCA\u0B95\u0BC8" : "Net amount",
          data: values,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return money(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: {
            ticks: { callback: function (v) { return money(v); } },
            grid: { color: "#eef2f7" }
          },
          y: { grid: { display: false } }
        }
      }
    });
    return netChart;
  }

  function renderTrendChart(canvas, seriesList, labelsByDataset, lang) {
    var labels = seriesList[0] ? seriesList[0].map(function (p) {
      var d = new Date(p.date);
      return d.getDate() + "/" + (d.getMonth() + 1);
    }) : [];
    var palette = ["#16a34a", "#f59e0b", "#2563eb", "#dc2626"];
    var datasets = seriesList.map(function (series, i) {
      return {
        label: labelsByDataset[i],
        data: series.map(function (p) { return p.modal; }),
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length],
        tension: 0.35,
        fill: false,
        pointRadius: 3
      };
    });
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(canvas, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.dataset.label + ": " + money(ctx.parsed.y); }
            }
          }
        },
        scales: {
          y: {
            ticks: { callback: function (v) { return money(v); } },
            grid: { color: "#eef2f7" }
          },
          x: { grid: { display: false } }
        }
      }
    });
    return trendChart;
  }

  global.MarketCharts = {
    renderNetChart: renderNetChart,
    renderTrendChart: renderTrendChart,
    money: money
  };
})(window);
