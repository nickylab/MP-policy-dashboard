// charts: all Plotly chart functions

// Block H1 – Shading helper
 // Helper to compute actual data shading (shaded region) for charts
  function buildActualDataShading(ranges) {
    const shadeMin = ranges.plotMin;
    const shadeMax = ranges.actualMax;
    const minIdx = parsePeriodToIndex(shadeMin);
    const maxIdx = parsePeriodToIndex(shadeMax);
    // If plot-min is beyond actual-max (or either is invalid), do not draw shading
    if (minIdx == null || maxIdx == null || minIdx > maxIdx) {
      return [];
    }
    return [
      {
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: shadeMin,
        x1: shadeMax,
        y0: 0,
        y1: 1,
        fillcolor: "rgba(15,23,42,0.08)",
        line: { width: 0 }
      }
    ];
  }

  // Block H2 – Scenario legend for charts

    // Render plots and tables
  function renderScenarioLegend(scenarios) {
    if (!scenarioLegendEl) return;
    if (!scenarios || !scenarios.length) {
      scenarioLegendEl.innerHTML = "";
      return;
    }
    const items = scenarios.map(s => {
      const color = s.color || "#000000";
      const name = s.name || "Scenario";
      return `
        <span style="display:inline-flex;align-items:center;margin-right:8px;margin-bottom:4px;">
          <span style="width:10px;height:10px;border-radius:999px;background:${color};display:inline-block;margin-right:4px;"></span>
          <span>${name}</span>
        </span>
      `;
    });
    scenarioLegendEl.innerHTML = items.join("");
  }


  // Block H3 – All renderXxxChart functions
  function renderPolicyChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "i", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Policy Rate (%)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-policy", traces, layout, { responsive: true });
  }

  function renderPolicyStepChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const raw = getSeries(s, "i", ranges.plotMin, ranges.plotMax);
      const steppedY = raw.y.map(v => {
        if (typeof v === "number" && !isNaN(v)) {
          return Math.round(v / 0.25) * 0.25;
        }
        return null;
      });
      return {
        x: raw.x,
        y: steppedY,
        customdata: raw.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color, dash: "dot" },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Policy Rate (%, in 0.25 increments)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-policy-step", traces, layout, { responsive: true });
  }


  // 1) Output Gap (%): ygap
  function renderOutputGapChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "ygap", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Output Gap (%)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-output-gap", traces, layout, { responsive: true });
  }

  // 2) Output & Potential Output: y & ytrnd
  function renderOutputLevelsChart(scenarios, ranges) {
    const traces = [];
    [...scenarios].reverse().forEach(s => {
      const seriesY = getSeries(s, "y", ranges.plotMin, ranges.plotMax);
      const seriesYtrnd = getSeries(s, "ytrnd", ranges.plotMin, ranges.plotMax);
      const yLn = seriesY.y.map(v =>
        typeof v === "number" && v > 0 ? Math.log(v) * 100 : null
      );
      const yTrndLn = seriesYtrnd.y.map(v =>
        typeof v === "number" && v > 0 ? Math.log(v) * 100 : null
      );

      traces.push({
        x: seriesY.x,
        y: yLn,
        customdata: seriesY.x,
        mode: "lines",
        name: s.name + " — Output",
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + " — Output: %{y:.2f}<extra></extra>"
      });

      traces.push({
        x: seriesYtrnd.x,
        y: yTrndLn,
        customdata: seriesYtrnd.x,
        mode: "lines",
        name: s.name + " — Potential",
        line: { color: s.color, dash: "dot" },
        hovertemplate: "%{customdata}<br>" + s.name + " — Potential: %{y:.2f}<extra></extra>"
      });
    });

    const layout = {
      title: "Output & Potential Output",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Level (ln × 100)" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-output-levels", traces, layout, { responsive: true });
  }

  // 3) Headline Inflation (%YoY): picpi4
  function renderHeadlineYoyChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "picpi4", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Headline Inflation (%YoY)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-headline-yoy", traces, layout, { responsive: true });
  }

  // 4) Core Inflation (%YoY): pi4
  function renderCoreYoyChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "pi4", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Core Inflation (%YoY)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-core-yoy", traces, layout, { responsive: true });
  }

  // 7) Ann. Potential Growth (%): dytrnd
  function renderPotentialGrowthChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "dytrnd", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Ann. Potential Growth (%)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-potential-growth", traces, layout, { responsive: true });
  }

  // 8) Core Inflation (%QoQ Ann.): pi
  function renderCoreQoqChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "pi", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Core Inflation (%QoQ Ann.)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-core-qoq", traces, layout, { responsive: true });
  }

  // 9) Headline Inflation (%QoQ Ann.): picpi
  function renderHeadlineQoqChart(scenarios, ranges) {
    const traces = [...scenarios].reverse().map(s => {
      const series = getSeries(s, "picpi", ranges.plotMin, ranges.plotMax);
      return {
        x: series.x,
        y: series.y,
        customdata: series.x,
        mode: "lines",
        name: s.name,
        line: { color: s.color },
        hovertemplate: "%{customdata}<br>" + s.name + ": %{y:.2f}%<extra></extra>"
      };
    });
    const layout = {
      title: "Headline Inflation (%QoQ Ann.)",
      margin: { t: 40, r: 10, b: 40, l: 55 },
      xaxis: buildXAxisLayout(ranges),
      yaxis: { title: "Percent", tickformat: ".2f" },
      showlegend: false,
      shapes: buildActualDataShading(ranges)
    };
    Plotly.newPlot("chart-headline-qoq", traces, layout, { responsive: true });
  }

