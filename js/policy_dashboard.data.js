// data: period helpers, series, growth calcs

// Block D1 – Growth & inflation augmentation

  function augmentScenarioDataWithGrowth(rows) {
    if (!Array.isArray(rows)) return rows;

    const validRows = rows.filter(r =>
      r.period != null &&
      r.period !== "" &&
      parsePeriodToIndex(r.period) != null
    );

    if (!validRows.length) return rows;

    // Sort by time so we can compute 4-quarter rolling stats
    const sorted = [...validRows].sort((a, b) => {
      return parsePeriodToIndex(a.period) - parsePeriodToIndex(b.period);
    });

    const indexMap = {};
    sorted.forEach(r => {
      const idx = parsePeriodToIndex(r.period);
      if (idx != null) indexMap[idx] = r;
    });

    function rollingMean(key, i) {
      const window = 4;
      if (i < window - 1) return null;
      let sum = 0;
      let count = 0;
      for (let k = i - window + 1; k <= i; k++) {
        const v = sorted[k][key];
        if (typeof v !== "number" || isNaN(v)) return null;
        sum += v;
        count++;
      }
      if (count < window) return null;
      return sum / count;
    }

    // First pass: compute quarterly y_growth, annual_GDP, and 4Q rolling means
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const idx = parsePeriodToIndex(r.period);
      const prev = idx != null ? indexMap[idx - 4] : null;

      const yNow  = typeof r.y === "number" ? r.y : null;
      const yPrev = prev && typeof prev.y === "number" ? prev.y : null;

      // y_growth = (y / lag(y, 4) - 1) * 100
      if (yNow != null && yPrev != null && yPrev !== 0) {
        r.y_growth = (yNow / yPrev - 1) * 100;
      } else {
        r.y_growth = r.y_growth ?? null;
      }

      const p = String(r.period).trim();
      if (/Q4$/.test(p) && typeof r.dyA_nonsa === "number") {
        r.annual_GDP = r.dyA_nonsa;
      } else {
        r.annual_GDP = r.annual_GDP ?? null;
      }

      // 4-quarter averages for yearly view
      const avgGap = rollingMean("ygap", i);
      if (avgGap != null) {
        r.avg_ygap = avgGap;
      }

      const cpiMA = rollingMean("cpi_nonsa", i);
      if (cpiMA != null) {
        r.cpi_ma4 = cpiMA;
      }

      const coreMA = rollingMean("core_nonsa", i);
      if (coreMA != null) {
        r.core_ma4 = coreMA;
      }
    }

    // Second pass: yearly HL_inf and CORE_inf from 4Q moving averages
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const idx = parsePeriodToIndex(r.period);
      const prev = idx != null ? indexMap[idx - 4] : null;

      if (typeof r.cpi_ma4 === "number" && prev && typeof prev.cpi_ma4 === "number" && prev.cpi_ma4 !== 0) {
        r.HL_inf = (r.cpi_ma4 / prev.cpi_ma4 - 1) * 100;
      } else {
        r.HL_inf = r.HL_inf ?? null;
      }

      if (typeof r.core_ma4 === "number" && prev && typeof prev.core_ma4 === "number" && prev.core_ma4 !== 0) {
        r.CORE_inf = (r.core_ma4 / prev.core_ma4 - 1) * 100;
      } else {
        r.CORE_inf = r.CORE_inf ?? null;
      }
    }

    return rows;
  }



  // Block D2 – Current quarter label + default actual max

    function getCurrentQuarterLabel() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const q = Math.floor(month / 3) + 1;
    return year + "Q" + q;
  }
  const defaultActualMax = getCurrentQuarterLabel();



  // Block D3 – Period parsing helpers

  // Helpers for period range
  function parsePeriodToIndex(p) {
    if (p == null) return null;
    const m = /^(\d{4})Q([1-4])$/.exec(String(p).trim());
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const q = parseInt(m[2], 10);
    if (!year || !q) return null;
    return year * 4 + q;
  }

  function indexToPeriod(idx) {
  if (typeof idx !== "number" || !isFinite(idx)) return null;
  let q = idx % 4;
  let year = (idx - q) / 4;
  if (q === 0) {
    q = 4;
    year -= 1;
  }
  return year + "Q" + q;
}

  function periodInRange(p, minP, maxP) {
    const idx = parsePeriodToIndex(p);
    if (idx == null) return true; // if we cannot parse, do not filter out
    const minIdx = minP ? parsePeriodToIndex(minP) : null;
    const maxIdx = maxP ? parsePeriodToIndex(maxP) : null;
    if (minIdx != null && idx < minIdx) return false;
    if (maxIdx != null && idx > maxIdx) return false;
    return true;
  }

  function parsePeriodParts(p) {
    const m = /^(\d{4})Q([1-4])$/.exec(String(p).trim());
    if (!m) return null;
    return { year: parseInt(m[1], 10), q: parseInt(m[2], 10) };
  }

// Block D4 – X-axis layout builder

  function buildXAxisLayout(ranges) {
    if (!availablePeriods.length) return {};
    const inPlot = availablePeriods.filter(p =>
      periodInRange(p, ranges.plotMin, ranges.plotMax)
    );
    if (!inPlot.length) return {};

    // Decide tick density based on how many quarters are in range
    const n = inPlot.length;
    let mode; // "all", "yearly", "biennial"
    if (n <= 12) {
      mode = "all";          // up to 3 years: show every quarter label
    } else if (n <= 40) {
      mode = "yearly";       // medium: show roughly yearly ticks
    } else {
      mode = "biennial";     // long horizon: show every 2 years
    }

    // Helper: pick one representative quarter per year (prefer Q1, else Q1 in that year, else fallback)
    const periodSet = new Set(inPlot);
    const firstParts = parsePeriodParts(inPlot[0]);
    const lastParts  = parsePeriodParts(inPlot[inPlot.length - 1]);
    if (!firstParts || !lastParts) return {};

    const tickvals = [];
    const ticktext = [];
    const stepYears = mode === "biennial" ? 2 : 1;

    for (let y = firstParts.year; y <= lastParts.year; y += stepYears) {
      let candidate = `${y}Q1`;
      if (!periodSet.has(candidate)) {
        // Try to find Q1 in this year in the plot range
        const alt = inPlot.find(p => {
          const parts = parsePeriodParts(p);
          return parts && parts.year === y && parts.q === 1;
        });
        if (!alt) {
          // Fallback: any quarter in this year in the plot range
          const fallback = inPlot.find(p => {
            const parts = parsePeriodParts(p);
            return parts && parts.year === y;
          });
          if (fallback) candidate = fallback; else continue;
        } else {
          candidate = alt;
        }
      }
      if (!periodInRange(candidate, ranges.plotMin, ranges.plotMax)) continue;
      tickvals.push(candidate);
      ticktext.push(String(y));
    }

    if (mode === "all") {
      // For short ranges, show all quarter labels
      return {
        tickmode: "array",
        tickvals: inPlot,
        ticktext: inPlot
      };
    }

    // For yearly/biennial: always use full Qx labels for tickvals, year for ticktext
    return {
      tickmode: "array",
      tickvals: tickvals,     // full Qx labels preserved
      ticktext: ticktext      // year-only text
    };
  }


// Block D5 – Generic series extractor
  function getSeries(scenario, colName, minPeriod, maxPeriod) {
    const rows = scenario.data || [];
    const x = [];
    const y = [];
    for (const r of rows) {
      const xv = r.period;
      const yv = r[colName];
      if (
        xv != null &&
        xv !== "" &&
        typeof yv === "number" &&
        !isNaN(yv) &&
        periodInRange(xv, minPeriod, maxPeriod)
      ) {
        x.push(xv);
        y.push(yv);
      }
    }
    return { x, y };
  }



