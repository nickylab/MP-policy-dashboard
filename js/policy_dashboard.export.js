// export: HTML & PDF export logic

// Block E1 – HTML export (downloadStandaloneDashboard)

async function downloadStandaloneDashboard(exportFixed) {
  if (!currentScenarios || !currentScenarios.length) {
    alert("Please build the dashboard before downloading.");
    return;
  }

  // 1) Capture current UI state (chart visibility, table variables, color-coding)
  const chartSelections = {};
  document.querySelectorAll(".chart-toggle").forEach(t => {
    const id = t.getAttribute("data-chart-id");
    if (id) {
      chartSelections[id] = !!t.checked;
    }
  });

  const tableVarSelections = {};
  document.querySelectorAll(".table-var-checkbox").forEach(cb => {
    const id = cb.getAttribute("data-var-id");
    if (id) {
      tableVarSelections[id] = !!cb.checked;
    }
  });

  const colorCodeCheckbox = document.getElementById("color-code-headers");
  const colorCodeHeadersState = !!(colorCodeCheckbox && colorCodeCheckbox.checked);

  const uiState = {
    charts: chartSelections,
    tableVars: tableVarSelections,
    colorCodeHeaders: colorCodeHeadersState
  };

  // 2) Prepare data to embed
  const exportScenarios = currentScenarios.map(s => ({
    name: s.name,
    color: s.color,
    data: s.data
  }));
  const ranges = getRangeConfig();

  const exportScenariosJson = JSON.stringify(exportScenarios).replace(/<\/script/gi, "<\\/script");
  const exportRangesJson = JSON.stringify(ranges).replace(/<\/script/gi, "<\\/script");
  const exportSummaryFreqJson = JSON.stringify(summaryFrequency);
  const exportUIStateJson = JSON.stringify(uiState).replace(/<\/script/gi, "<\\/script");
  const exportFixedJson = JSON.stringify(!!exportFixed);

  const injectionScript = `
<script>
(function(){
  window.__EXPORTED_SCENARIOS = ${exportScenariosJson};
  window.__EXPORTED_RANGES = ${exportRangesJson};
  window.__EXPORTED_SUMMARY_FREQUENCY = ${exportSummaryFreqJson};
  window.__EXPORTED_UI_STATE = ${exportUIStateJson};
  window.__EXPORTED_FIXED = ${exportFixedJson};
  document.addEventListener("DOMContentLoaded", function(){
    if (!window.__EXPORTED_SCENARIOS || !window.__EXPORTED_SCENARIOS.length) return;
    currentScenarios = window.__EXPORTED_SCENARIOS;
    availablePeriods = getAllPeriodsFromScenarios(currentScenarios);
    populateRangeSelects();
    if (typeof window.__EXPORTED_RANGES === "object" && window.__EXPORTED_RANGES) {
      if (plotMinInput && window.__EXPORTED_RANGES.plotMin) plotMinInput.value = window.__EXPORTED_RANGES.plotMin;
      if (plotMaxInput && window.__EXPORTED_RANGES.plotMax) plotMaxInput.value = window.__EXPORTED_RANGES.plotMax;
      if (actualMaxInput && window.__EXPORTED_RANGES.actualMax) actualMaxInput.value = window.__EXPORTED_RANGES.actualMax;
      if (tableMinInput && window.__EXPORTED_RANGES.tableMin) tableMinInput.value = window.__EXPORTED_RANGES.tableMin;
      if (tableMaxInput && window.__EXPORTED_RANGES.tableMax) tableMaxInput.value = window.__EXPORTED_RANGES.tableMax;
      if (actualMinInput && plotMinInput) {
        actualMinInput.value = plotMinInput.value;
        actualMinInput.disabled = true;
      }
    }

    if (typeof window.__EXPORTED_UI_STATE === "object" && window.__EXPORTED_UI_STATE) {
      var ui = window.__EXPORTED_UI_STATE;
      var chartState = ui.charts || {};
      document.querySelectorAll(".chart-toggle").forEach(function(t) {
        var id = t.getAttribute("data-chart-id");
        if (id && Object.prototype.hasOwnProperty.call(chartState, id)) {
          t.checked = !!chartState[id];
        }
      });

      var varState = ui.tableVars || {};
      document.querySelectorAll(".table-var-checkbox").forEach(function(cb) {
        var id = cb.getAttribute("data-var-id");
        if (id && Object.prototype.hasOwnProperty.call(varState, id)) {
          cb.checked = !!varState[id];
        }
      });

      if (typeof ui.colorCodeHeaders === "boolean") {
        var cc = document.getElementById("summary-color-toggle") || document.getElementById("color-code-headers");
        colorCodeTableHeaders = ui.colorCodeHeaders;
        if (cc) cc.checked = colorCodeTableHeaders;
      }
    }

    if (typeof window.__EXPORTED_SUMMARY_FREQUENCY === "string") {
      summaryFrequency = window.__EXPORTED_SUMMARY_FREQUENCY;
      var radios = document.querySelectorAll(".table-frequency-radio");
      radios.forEach(function(r){
        r.checked = (r.value === summaryFrequency);
      });
    }
    if (configStepEl) configStepEl.style.display = "none";
    if (backToConfigBtn) backToConfigBtn.style.display = "none";
    if (rangeConfigEl) rangeConfigEl.style.display = "block";
    if (rangeHeadingEl) rangeHeadingEl.textContent = "Set plot and table ranges";
    if (rangeActionsEl) rangeActionsEl.style.display = "none";
    if (dashboardStepEl) dashboardStepEl.style.display = "block";
    if (scenarioCountLbl) {
      var n = currentScenarios.length;
      scenarioCountLbl.textContent = n + " scenario" + (n > 1 ? "s" : "") + " loaded";
    }

    var downloadWrap = document.getElementById("download-wrapper");
    if (downloadWrap) downloadWrap.style.display = "none";

    var ledeEl = document.querySelector(".lede");
    if (ledeEl) {
      ledeEl.style.display = "none";
    }

    if (window.__EXPORTED_FIXED) {
      if (rangeConfigEl) {
        rangeConfigEl.style.display = "none";
      }
      var chartToggleRow = document.getElementById("chart-toggle-row");
      if (chartToggleRow) {
        chartToggleRow.style.display = "none";
      }
      var summaryVarControls = document.getElementById("summary-var-controls");
      if (summaryVarControls) {
        summaryVarControls.style.display = "none";
      }
      var summaryColorToggle = document.getElementById("summary-color-toggle");
      if (summaryColorToggle) {
        summaryColorToggle.style.display = "none";
      }
    }

    renderDashboard(currentScenarios);
    if (typeof applyChartVisibility === "function") {
      applyChartVisibility();
    }
  });
})();
<\/script>
`;

  // 3) Fetch CSS and JS assets to inline (single-file export)
  let cssText = "";
  try {
    const cssResp = await fetch("css/policy_dashboard.css");
    if (cssResp.ok) {
      cssText = await cssResp.text();
    }
  } catch (e) {
    console.warn("Failed to inline CSS", e);
  }

  const scriptPaths = [
    "js/policy_dashboard.data.js",
    "js/policy_dashboard.charts.js",
    "js/policy_dashboard.summary.js",
    "js/policy_dashboard.export.js",
    "js/policy_dashboard.core.js"
  ];
  const scriptTexts = [];
  for (const path of scriptPaths) {
    try {
      const resp = await fetch(path);
      if (resp.ok) {
        scriptTexts.push(await resp.text());
      }
    } catch (e) {
      console.warn("Failed to inline JS:", path, e);
    }
  }

  const inlineCssBlock = cssText
    ? `<style>\n${cssText.replace(/<\/style/gi, "<\\/style")}\n</style>`
    : "";

  const inlineJsBlock = scriptTexts.length
    ? `<script>\n${scriptTexts.join("\n\n").replace(/<\/script/gi, "<\\/script")}\n</script>`
    : "";

  // 4) Build final HTML document
  const htmlNode = document.documentElement;
  let docHtml = htmlNode.outerHTML;

  // Remove external app CSS link from exported copy
  docHtml = docHtml.replace(
    /<link[^>]+href=["']css\/policy_dashboard\.css["'][^>]*>\s*/i,
    ""
  );

  // Remove external app JS script tags from exported copy
  scriptPaths.forEach(path => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<script[^>]+src=["']${escaped}["'][^>]*>\\s*<\\/script>`,
      "ig"
    );
    docHtml = docHtml.replace(re, "");
  });

  // Inject inline CSS right after <head>
  if (inlineCssBlock) {
    docHtml = docHtml.replace("<head>", "<head>" + inlineCssBlock);
  }

  const closingTag = "</body>";
  const idx = docHtml.lastIndexOf(closingTag);
  const bundleScripts = inlineJsBlock + "\n" + injectionScript;

  let finalHtml;
  if (idx !== -1) {
    finalHtml =
      "<!doctype html>\n" +
      docHtml.slice(0, idx) +
      bundleScripts +
      docHtml.slice(idx);
  } else {
    finalHtml = "<!doctype html>\n" + docHtml + bundleScripts;
  }

  // 5) Trigger download
  const blob = new Blob([finalHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date();
  const yyyy = ts.getFullYear();
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const dd = String(ts.getDate()).padStart(2, "0");
  a.href = url;
  a.download = "MPC_Dashboard_" + yyyy + mm + dd + ".html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


  // Block E2 – Table row estimate & suggestion helpers

  function estimateTableRowCountForPdf() {
    // Look at the actual rendered summary table so we match what autoTable sees
    const tableEl = document.querySelector("#summary-tables table");
    if (!tableEl) return null;
    const tbody = tableEl.querySelector("tbody");
    if (!tbody) return null;
    return tbody.querySelectorAll("tr").length;
  }

function suggestMaxTableMax(ranges) {
  const isYearly = (summaryFrequency === "yearly");

  if (isYearly) {
    const minParts = parsePeriodParts(ranges.tableMin);
    if (!minParts) return null;
    const rowLimit = MAX_TABLE_ROWS_PER_PAGE_YEARLY;
    const suggestedLastYear = minParts.year + rowLimit - 1;
    // table uses quarterly labels, suggest Q4 of that year
    return suggestedLastYear + "Q4";
  } else {
    const minIdx = parsePeriodToIndex(ranges.tableMin);
    if (minIdx == null) return null;
    const rowLimit = MAX_TABLE_ROWS_PER_PAGE_QUARTERLY;
    const suggestedIdx = minIdx + rowLimit - 1;
    return indexToPeriod(suggestedIdx);
  }
}

// Block E3 – PDF export “are you sure” handler

function handlePdfDownloadClick() {
  if (!currentScenarios || !currentScenarios.length) {
    alert("Please build the dashboard before exporting.");
    return;
  }

  const ranges = getRangeConfig();
  const estimatedRows = estimateTableRowCountForPdf();
  const isYearly = (summaryFrequency === "yearly");
  const rowLimit = isYearly ? MAX_TABLE_ROWS_PER_PAGE_YEARLY : MAX_TABLE_ROWS_PER_PAGE_QUARTERLY;

  if (estimatedRows && estimatedRows > rowLimit) {
    const suggestionPeriod = suggestMaxTableMax(ranges);

    let msg =
      "The current table range will produce about " +
      estimatedRows +
      (isYearly ? " years" : " quarters") +
      " in the summary table, so the PDF table will spill onto multiple pages.\n\n";

    if (suggestionPeriod) {
      msg +=
        "For a single-page table, try ending the table range around " +
        suggestionPeriod +
        " (about " +
        rowLimit +
        (isYearly ? " years" : " quarters") +
        " from the starting point).\n\n";
    }

    msg += "Do you still want to continue with the current range?";

    const proceed = confirm(msg);
    if (!proceed) return;
  }

  // If row count is fine, or user confirms, proceed with actual export
  downloadPdfSnapshot();
}

// Block E4 – Core PDF export (chart pack)
  // PDF chart pack: draw vector charts directly with jsPDF (no Plotly images)
  window.downloadPdfSnapshot = async function() {
    // alert("Starting PDF export...");
    console.log("[MPC] PDF export started");

    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("jsPDF is not loaded. Please check the script imports.");
        return;
      }

      if (!currentScenarios || !currentScenarios.length) {
        alert("Please load a scenario before exporting.");
        return;
      }

      const tableEl = document.querySelector("#summary-tables table");
      if (!tableEl) {
        alert("Summary table not found. Please refresh the page.");
        return;
      }


      const ranges = getRangeConfig();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 30;

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("Policy Rate Projection Dashboard", margin, margin);

      // Area allocations
      // Use the same front-to-back ordering as the HTML charts
      const orderedScenariosForPdf = [...currentScenarios].reverse();

      const chartsAreaTop = margin + 40;  // leave space under the title for the legend
      const usableHeight = pageHeight - margin * 2;
      const chartsAreaHeight = usableHeight * 0.55;   // 55% for charts
      const tableTop = chartsAreaTop + chartsAreaHeight + 10; // remaining ~40% for table

      // Global legend (same colors as HTML legend)
      const legendY = margin + 18;
      let legendX = margin;
      const legendGapX = 14;
      const legendItemGap = 40;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      orderedScenariosForPdf.forEach(s => {
        const label = s.name || "Scenario";
        const swatchWidth = 14;
        const swatchHeight = 6;
        const labelWidth = pdf.getTextWidth(label);
        const itemWidth = swatchWidth + 6 + labelWidth;

        if (legendX + itemWidth > pageWidth - margin) {
          legendX = margin;
        }

        const rgb = hexToRgb(s.color);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(legendX, legendY - swatchHeight + 2, swatchWidth, swatchHeight, "F");
        pdf.setTextColor(0, 0, 0);
        pdf.text(label, legendX + swatchWidth + 6, legendY);

        legendX += itemWidth + legendItemGap;
      });

      const chartsLeft = margin;
      const chartsRight = pageWidth - margin;
      const chartsWidth = chartsRight - chartsLeft;

      // Use a 3x2 grid for up to 6 charts, fixed chart size
      const chartCols = 3;
      const chartRows = 2; // 3x2 grid for up to 6 charts
      const hGap = 24;
      const vGap = 8;
      const chartWidth = (chartsWidth - hGap * (chartCols - 1)) / chartCols;
      const chartHeight = (chartsAreaHeight - vGap * (chartRows - 1)) / chartRows + 6;

      const selectedChartIds = Array.from(
        document.querySelectorAll(".chart-toggle")
      )
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.chartId)
        .slice(0, 6);

      if (!selectedChartIds.length) {
        alert("Please select at least one chart to include in the Chart Pack.");
        return;
      }

      const chartMeta = {
        "chart-policy": {
          title: "Policy Rate (%)",
          yLabel: "%",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "i", ranges)
        },
        "chart-output-gap": {
          title: "Output Gap (%)",
          yLabel: "%",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "ygap", ranges)
        },
        "chart-headline-yoy": {
          title: "Headline Inflation (%YoY)",
          yLabel: "%YoY",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "picpi4", ranges)
        },
        "chart-core-yoy": {
          title: "Core Inflation (%YoY)",
          yLabel: "%YoY",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "pi4", ranges)
        },
        "chart-headline-qoq": {
          title: "Headline Inflation (%QoQ ann.)",
          yLabel: "%QoQ",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "picpi", ranges)
        },
        "chart-core-qoq": {
          title: "Core Inflation (%QoQ ann.)",
          yLabel: "%QoQ",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "pi", ranges)
        },
        "chart-potential-growth": {
          title: "Potential Growth (%)",
          yLabel: "%",
          buildSeries: scenario => buildSingleSeriesForColumn(scenario, "dytrnd", ranges)
        },
        "chart-output-levels": {
          title: "Output and Potential (log level)",
          yLabel: "log-level",
          buildSeries: scenario => {
            const sY = getSeries(scenario, "y", ranges.plotMin, ranges.plotMax);
            const sTrend = getSeries(scenario, "ytrnd", ranges.plotMin, ranges.plotMax);
            const out = [];
            if (sY.x.length) {
              out.push({
                name: scenario.name + " Output",
                color: scenario.color,
                kind: "output",
                x: sY.x.slice(),
                y: sY.y.map(v => (typeof v === "number" && v > 0 ? Math.log(v) * 100 : null))
              });
            }
            if (sTrend.x.length) {
              out.push({
                name: scenario.name + " Potential",
                color: scenario.color,
                kind: "potential",
                x: sTrend.x.slice(),
                y: sTrend.y.map(v => (typeof v === "number" && v > 0 ? Math.log(v) * 100 : null))
              });
            }
            return out;
          }
        },
        "chart-policy-step": {
          title: "Policy Rate (0.25 steps)",
          yLabel: "%",
          buildSeries: scenario => {
            const s = getSeries(scenario, "i", ranges.plotMin, ranges.plotMax);
            const stepped = s.y.map(v =>
              typeof v === "number" ? Math.round(v * 4) / 4 : null
            );
            return [
              {
                name: scenario.name,
                color: scenario.color,
                kind: "output",
                x: s.x.slice(),
                y: stepped
              }
            ];
          }
        }
      };

      function buildSingleSeriesForColumn(scenario, col, r) {
        const s = getSeries(scenario, col, r.plotMin, r.plotMax);
        return [
          {
            name: scenario.name,
            color: scenario.color,
            kind: "output",
            x: s.x.slice(),
            y: s.y.slice()
          }
        ];
      }

      function toIndexedSeries(seriesList) {
        const processed = [];
        let minIdx = Infinity;
        let maxIdx = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        seriesList.forEach(s => {
          const pts = [];
          for (let i = 0; i < s.x.length; i++) {
            const period = s.x[i];
            const yVal = s.y[i];
            if (typeof yVal !== "number" || !isFinite(yVal)) continue;
            if (!periodInRange(period, ranges.plotMin, ranges.plotMax)) continue;
            const idx = parsePeriodToIndex(period);
            if (idx == null) continue;
            pts.push({ idx, y: yVal });
            if (idx < minIdx) minIdx = idx;
            if (idx > maxIdx) maxIdx = idx;
            if (yVal < minY) minY = yVal;
            if (yVal > maxY) maxY = yVal;
          }
          if (pts.length) {
            processed.push({
              name: s.name,
              color: s.color,
              kind: s.kind || "output",
              points: pts
            });
          }
        });

        if (!processed.length) return null;

        if (minY === maxY) {
          minY -= 1;
          maxY += 1;
        }
        const yPad = (maxY - minY) * 0.08;
        minY -= yPad;
        maxY += yPad;

        return { series: processed, minIdx, maxIdx, minY, maxY };
      }

        function idxToYear(idx) {
        let q = idx % 4;
        let year = (idx - q) / 4;
        if (q === 0) {
            year -= 1;
        }
        return year;
        }

      function drawSingleChart(chartId, colIndex, rowIndex) {
        const meta = chartMeta[chartId];
        if (!meta) return;

        let allSeries = [];
        orderedScenariosForPdf.forEach(scenario => {
          const seriesForScenario = meta.buildSeries(scenario) || [];
          allSeries = allSeries.concat(seriesForScenario);
        });

        const indexed = toIndexedSeries(allSeries);
        if (!indexed) return;

        const cellX = chartsLeft + colIndex * (chartWidth + hGap);
        const cellY = chartsAreaTop + rowIndex * (chartHeight + vGap);

        // Chart title: bigger, centered
        const titleY = cellY + 16;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(meta.title, cellX + chartWidth / 2, titleY, { align: "center" });

        const plotLeft = cellX + 40;
        const plotRight = cellX + chartWidth - 10;
        const plotTop = cellY + 24;
        const plotBottom = cellY + chartHeight - 24;

        // Shaded actual-data range (same logic as HTML charts)
        const shadeMin = ranges.plotMin;
        const shadeMax = ranges.actualMax;
        const shadeMinIdx = parsePeriodToIndex(shadeMin);
        const shadeMaxIdx = parsePeriodToIndex(shadeMax);
        if (shadeMinIdx != null && shadeMaxIdx != null && shadeMaxIdx > shadeMinIdx) {
          const x0Idx = Math.max(shadeMinIdx, indexed.minIdx);
          const x1Idx = Math.min(shadeMaxIdx, indexed.maxIdx);
          if (x1Idx > x0Idx) {
            const x0 = plotLeft + ((x0Idx - indexed.minIdx) / Math.max(indexed.maxIdx - indexed.minIdx, 1)) * (plotRight - plotLeft);
            const x1 = plotLeft + ((x1Idx - indexed.minIdx) / Math.max(indexed.maxIdx - indexed.minIdx, 1)) * (plotRight - plotLeft);
            pdf.setFillColor(245, 248, 252); // light background
            pdf.rect(x0, plotTop, x1 - x0, plotBottom - plotTop, "F");
          }
        }

        pdf.setLineWidth(0.8);
        pdf.setDrawColor(0, 0, 0);
        pdf.line(plotLeft, plotTop, plotLeft, plotBottom);
        pdf.line(plotLeft, plotBottom, plotRight, plotBottom);

        const xRange = Math.max(indexed.maxIdx - indexed.minIdx, 1);
        const yRange = Math.max(indexed.maxY - indexed.minY, 1);

        // Faint grid color
        const gridColor = { r: 230, g: 234, b: 242 };

        // Horizontal gridlines and y-axis ticks
        const yTicks = 4;
        pdf.setFont("helvetica", "normal");
        for (let i = 0; i <= yTicks; i++) {
          const val = indexed.minY + (yRange * i) / yTicks;
          const yPos = plotBottom - ((val - indexed.minY) / yRange) * (plotBottom - plotTop);
          pdf.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
          pdf.setLineWidth(0.3);
          pdf.line(plotLeft, yPos, plotRight, yPos);
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.8);
          pdf.setFontSize(9);
          pdf.text(val.toFixed(1), plotLeft - 4, yPos + 2, { align: "right" });
        }

        // Vertical gridlines and x-axis ticks/labels
        const firstYear = idxToYear(indexed.minIdx);
        const lastYear = idxToYear(indexed.maxIdx);
        const yearSpan = Math.max(lastYear - firstYear, 1);
        const yearStep = yearSpan > 8 ? 2 : 1;

        for (let y = firstYear; y <= lastYear; y += yearStep) {
          const idxForYear = y * 4 + 1;
          const xPos =
            plotLeft + ((idxForYear - indexed.minIdx) / xRange) * (plotRight - plotLeft);
          if (xPos < plotLeft - 5 || xPos > plotRight + 5) continue;
          pdf.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
          pdf.setLineWidth(0.3);
          pdf.line(xPos, plotTop, xPos, plotBottom);
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.8);
          pdf.line(xPos, plotBottom, xPos, plotBottom - 4);
          pdf.setFontSize(9);
          pdf.text(String(y), xPos, plotBottom + 10, { align: "center" });
        }

        // Series lines and markers (thicker; dotted for potential series)
        indexed.series.forEach(s => {
          const rgb = hexToRgb(s.color);
          pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.setLineWidth(2.0);

          // Solid for output, dotted for potential
          const isPotential = s.kind === "potential";
          if (typeof pdf.setLineDash === "function") {
            if (isPotential) {
              pdf.setLineDash([3, 3], 0);
            } else {
              pdf.setLineDash([], 0);
            }
          }

          const pts = s.points;
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const x0 =
              plotLeft + ((p0.idx - indexed.minIdx) / xRange) * (plotRight - plotLeft);
            const x1 =
              plotLeft + ((p1.idx - indexed.minIdx) / xRange) * (plotRight - plotLeft);
            const y0 =
              plotBottom - ((p0.y - indexed.minY) / yRange) * (plotBottom - plotTop);
            const y1 =
              plotBottom - ((p1.y - indexed.minY) / yRange) * (plotBottom - plotTop);
            pdf.line(x0, y0, x1, y1);
          }

          // Markers for both output and potential
          pts.forEach(p => {
            const x = plotLeft + ((p.idx - indexed.minIdx) / xRange) * (plotRight - plotLeft);
            const y =
              plotBottom - ((p.y - indexed.minY) / yRange) * (plotBottom - plotTop);
            pdf.circle(x, y, 2.4, "F");
          });

          // Reset dash after each series
          if (typeof pdf.setLineDash === "function") {
            pdf.setLineDash([], 0);
          }
        });

        // y-axis label, slightly larger font
        if (meta.yLabel) {
          const yLabelX = cellX + 12;
          const yLabelY = (plotTop + plotBottom) / 2;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(meta.yLabel, yLabelX, yLabelY, {
            angle: 90,
            align: "center"
          });
        }
      }

      selectedChartIds.forEach((chartId, idx) => {
        const row = Math.floor(idx / chartCols);
        const col = idx % chartCols;
        if (row < chartRows) {
          drawSingleChart(chartId, col, row);
        }
      });

      const autoTable = pdf.autoTable;
      if (!autoTable) {
        alert("jsPDF autoTable plugin is not loaded. Please check the script imports.");
        return;
      }

        const scenarioColorByCol = {}; // colIndex -> [r,g,b]

      autoTable.call(pdf, {
        html: tableEl,
        startY: tableTop,
        theme: "grid",
        tableWidth: "auto",
        margin: { top: tableTop, left: margin, right: margin },
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 3,
          lineWidth: 0.1,
          halign: "center",
          valign: "middle"
        },
        headStyles: (colorCodeTableHeaders ? {
          fillColor: [248, 250, 252],
          lineWidth: 0.1,
          halign: "center",
          valign: "middle"
        } : {
          fillColor: [248, 250, 252],
          textColor: 0,
          lineWidth: 0.1,
          halign: "center",
          valign: "middle"
        }),
        didParseCell: function (data) {
          if (!colorCodeTableHeaders) return;

          // 1) Header rows
          if (data.section === "head") {
            // Row 0 = variable names (Output Gap, Policy Rate, etc.) -> keep black
            if (data.row.index === 0) {
              data.cell.styles.textColor = [0, 0, 0];
              return;
            }

            // Row 1 = scenario names -> color by scenario and remember color per column
            if (data.row.index === 1) {
              const scenarioName = String(data.cell.text || "").trim();
              const match = currentScenarios.find(s => s.name === scenarioName);
              if (match && match.color) {
                const rgb = hexToRgb(match.color);
                data.cell.styles.textColor = [rgb.r, rgb.g, rgb.b];
                scenarioColorByCol[data.column.index] = [rgb.r, rgb.g, rgb.b];
              } else {
                // fallback: black if no scenario match
                data.cell.styles.textColor = [0, 0, 0];
              }
            }
            return;
          }

          // 2) Body rows -> inherit color from their scenario column if available
          if (data.section === "body") {
            const colColor = scenarioColorByCol[data.column.index];
            if (colColor) {
              data.cell.styles.textColor = colColor;
            }
          }
        },
        didDrawPage: data => {
          const footerText =
            "Exported on " +
            new Date().toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          pdf.text(
            footerText,
            margin,
            pdf.internal.pageSize.getHeight() - 12
          );
        }
      });

      const ts = new Date();
      const yyyy = ts.getFullYear();
      const mm = String(ts.getMonth() + 1).padStart(2, "0");
      const dd = String(ts.getDate()).padStart(2, "0");
      pdf.save("MPC_Dashboard_" + yyyy + mm + dd + ".pdf");
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF export failed: " + (err && err.message ? err.message : err));
    }
  };


// Block E5 – Color helper for PDF

// Helper: convert hex color to RGB for PDF chart drawing
function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let c = String(hex).trim();
  if (c[0] === "#") c = c.slice(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}





