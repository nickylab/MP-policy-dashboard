// summary: summary tables

// Block S1 – Variable registry for the table
  const tableVarConfig = {
    ygap: {
      id: "ygap",
      label: "Output Gap (%)",
      accessor: r => Number(r.ygap)
    },
    policy: {
      id: "policy",
      label: "Policy Rate (%)",
      accessor: r => Number(r.i)
    },
    policyStep: {
      id: "policyStep",
      label: "Policy Rate (%, step)",
      accessor: r => {
        const v = Number(r.i);
        if (typeof v === "number" && !isNaN(v)) {
          return Math.round(v / 0.25) * 0.25;
        }
        return NaN;
      }
    },
    headlineYoy: {
      id: "headlineYoy",
      label: "Headline Inflation (%YoY)",
      accessor: r => Number(r.picpi4)
    },
    coreYoy: {
      id: "coreYoy",
      label: "Core Inflation (%YoY)",
      accessor: r => Number(r.pi4)
    },
    gdp: {
      id: "gdp",
      label: "GDP Growth (%YoY)",
      accessor: r => Number(r.y_growth)
    }
  };


// Block S2 – Summary legend (for colored headers)

  function renderSummaryLegend(scenarios) {
    if (!summaryLegendEl) return;
    if (!colorCodeTableHeaders || !scenarios || !scenarios.length) {
      summaryLegendEl.style.display = "none";
      summaryLegendEl.innerHTML = "";
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
    summaryLegendEl.innerHTML = items.join("");
    summaryLegendEl.style.display = "block";
  }



  // Block S3 – renderSummaryTables

    function renderSummaryTables(scenarios, ranges) {
    const tableMin = ranges.tableMin;
    const tableMax = ranges.tableMax;
    renderSummaryLegend(scenarios);

    // Determine which variables are selected
    const varCheckboxes = document.querySelectorAll(".table-var-checkbox");
    const activeVarIds = Array.from(varCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute("data-var-id"))
      .filter(id => !!tableVarConfig[id]);

    if (!activeVarIds.length) {
      summaryTablesEl.innerHTML = "<p style='font-size:13px;color:var(--muted);'>Select at least one variable to display.</p>";
      return;
    }

    const vars = activeVarIds.map(id => ({
      id,
      label: tableVarConfig[id].label
    }));

    // Decide frequency: quarterly or yearly
    const isYearly = (summaryFrequency === "yearly");

    // Collect all periods within the table range across all scenarios
    const periodSet = new Set();
    scenarios.forEach(s => {
      (s.data || []).forEach(r => {
        const p = r.period;
        if (p != null && p !== "" && periodInRange(p, tableMin, tableMax)) {
          periodSet.add(String(p).trim());
        }
      });
    });

    let periods = Array.from(periodSet);
    periods.sort((a, b) => parsePeriodToIndex(a) - parsePeriodToIndex(b));

    if (!periods.length) {
      summaryTablesEl.innerHTML = "<p style='font-size:13px;color:var(--muted);'>No observations in the selected table range.</p>";
      return;
    }

    // Yearly aggregation helpers
    let yearlyPeriods = [];
    let yearlyLookups = {};
    if (isYearly) {
      // Build yearly period list: use the year extracted from any 4Q or any quarter in that year
      const yearSet = new Set();
      periods.forEach(p => {
        const parts = parsePeriodParts(p);
        if (parts) yearSet.add(parts.year);
      });
      const years = Array.from(yearSet).sort((a, b) => a - b);
      yearlyPeriods = years.map(y => String(y));

      // For each scenario, compute yearly aggregates
      scenarios.forEach(s => {
        const ymap = {};
        const byYear = {};

        (s.data || []).forEach(r => {
          const p = r.period;
          if (p == null || p === "") return;
          if (!periodInRange(p, tableMin, tableMax)) return;
          const parts = parsePeriodParts(p);
          if (!parts) return;
          const year = parts.year;
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(r);
        });

        Object.keys(byYear).forEach(yk => {
          const year = parseInt(yk, 10);
          const rows = byYear[year].sort((a, b) => parsePeriodToIndex(a.period) - parsePeriodToIndex(b.period));

          const candidateQ4 = rows.find(r => {
            const parts = parsePeriodParts(r.period);
            return parts && parts.q === 4;
          });
          const repRow = candidateQ4 || rows[rows.length - 1];

          const aggregated = Object.assign({}, repRow);

          if (Array.isArray(rows) && rows.length) {
            const last = rows[rows.length - 1];
            aggregated.ygap = (typeof last.avg_ygap === "number") ? last.avg_ygap : aggregated.ygap;
            aggregated.picpi4 = (typeof last.HL_inf === "number") ? last.HL_inf : aggregated.picpi4;
            aggregated.pi4 = (typeof last.CORE_inf === "number") ? last.CORE_inf : aggregated.pi4;
            aggregated.y_growth = (typeof last.dyA_nonsa === "number") ? last.dyA_nonsa : aggregated.y_growth;
            aggregated.annual_GDP = (typeof last.dyA_nonsa === "number") ? last.dyA_nonsa : aggregated.annual_GDP;
          }

          aggregated.period = String(year);
          ymap[aggregated.period] = aggregated;
        });

        yearlyLookups[s.name] = ymap;
      });
    }

    // For each scenario, build a lookup: period -> raw row (quarterly)
    const lookups = {};
    scenarios.forEach(s => {
      const map = {};
      (s.data || []).forEach(r => {
        const p = r.period;
        if (p == null || p === "") return;
        if (!periodInRange(p, tableMin, tableMax)) return;
        const key = String(p).trim();
        map[key] = r;
      });
      lookups[s.name] = map;
    });

    const scenariosOrdered = scenarios.map(s => s.name);
    const scenarioColorMap = {};
    scenarios.forEach(s => {
      scenarioColorMap[s.name] = s.color;
    });

    const displayPeriods = isYearly ? yearlyPeriods : periods;

    let html = `
      <table>
        <thead>
          <tr>
            <th rowspan="2">${isYearly ? "Year" : "Period"}</th>
    `;

    // First header row: variable names spanning all scenarios
    vars.forEach(v => {
      html += `<th colspan="${scenariosOrdered.length}">${v.label}</th>`;
    });

    html += `
          </tr>
          <tr>
    `;

    // Second header row: scenario names under each variable
    vars.forEach(() => {
      scenariosOrdered.forEach(name => {
        const color = colorCodeTableHeaders ? scenarioColorMap[name] : null;
        const colorStyle = color ? ` style="color:${color};"` : "";
        html += `<th${colorStyle}>${name}</th>`;
      });
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    // Body rows
    if (!isYearly) {
      // Quarterly: one row per period
      displayPeriods.forEach(p => {
        html += `<tr><td>${p}</td>`;
        vars.forEach(v => {
          const cfg = tableVarConfig[v.id];
          scenariosOrdered.forEach(name => {
            const lu = lookups[name] || {};
            const rec = lu[p];
            const color = colorCodeTableHeaders ? scenarioColorMap[name] : null;
            const styleAttr = color ? ` style="color:${color};"` : "";
            let val = "";
            if (rec && cfg && typeof cfg.accessor === "function") {
              const raw = cfg.accessor(rec);
              if (typeof raw === "number" && !isNaN(raw)) {
                val = raw.toFixed(2);
              }
            }
            html += `<td${styleAttr}>${val}</td>`;
          });
        });
        html += `</tr>`;
      });
    } else {
      // Yearly: one row per year
      displayPeriods.forEach(yearStr => {
        html += `<tr><td>${yearStr}</td>`;
        const year = parseInt(yearStr, 10);

        vars.forEach(v => {
          scenariosOrdered.forEach(name => {
            const color = colorCodeTableHeaders ? scenarioColorMap[name] : null;
            const styleAttr = color ? ` style="color:${color};"` : "";
            const cfg = tableVarConfig[v.id];

            const ymap = yearlyLookups[name] || {};
            const rec = ymap[yearStr];

            let val = "";
            if (rec && cfg && typeof cfg.accessor === "function") {
              const raw = cfg.accessor(rec);
              if (typeof raw === "number" && !isNaN(raw)) {
                val = raw.toFixed(2);
              }
            }
            html += `<td${styleAttr}>${val}</td>`;
          });
        });

        html += `</tr>`;
      });
    }

    html += "</tbody></table>";
    summaryTablesEl.innerHTML = html;
  }

  