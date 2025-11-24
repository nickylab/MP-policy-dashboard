// core: UI flow, DOM, ranges, scenario list

// Block C1 – Global state & defaults
  
  // Global state
  const maxScenarios = 6;
  const scenarios = []; // {id, name, color, file, data}

  // Default ranges
  const defaultPlotMin = "2019Q4";
  const defaultPlotMax = "2030Q4";
  const defaultTableMin = "2019Q4";
  const defaultTableMax = "2030Q4";
  const defaultActualMin = "2019Q4";
  let availablePeriods = [];
  let currentScenarios = [];
  let colorCodeTableHeaders = false;
    let summaryFrequency = "quarterly"; // "quarterly" or "yearly"

    // Approximate row budgets for a single-page PDF table with current layout.
    // Yearly view: about 10–11 years fit comfortably on one page.
    // Quarterly view: about 40 quarters (~10 years) fit comfortably on one page.
    const MAX_TABLE_ROWS_PER_PAGE_YEARLY = 14;
    const MAX_TABLE_ROWS_PER_PAGE_QUARTERLY = 14;


// Block C2 – DOM element lookups & color-code checkbox wiring

      const scenarioListEl   = document.getElementById("scenario-list");
  const addScenarioBtn   = document.getElementById("add-scenario");
  const buildDashboardBtn = document.getElementById("build-dashboard");
  const configStepEl     = document.getElementById("config-step");
  const dashboardStepEl  = document.getElementById("dashboard-step");
  const backToConfigBtn  = document.getElementById("back-to-config");
  const scenarioCountLbl = document.getElementById("scenario-count-label");
    const downloadWrapperEl      = document.getElementById("download-wrapper");
    const downloadToggleBtn      = document.getElementById("download-toggle");
    const downloadMenuEl         = document.getElementById("download-menu");
    const downloadHtmlParentBtn  = document.getElementById("download-html-parent");
    const downloadHtmlSubmenuEl  = document.getElementById("download-html-submenu");
    const summaryTablesEl        = document.getElementById("summary-tables");
  const rangeConfigEl    = document.getElementById("range-config");
  const scenarioLegendEl = document.getElementById("scenario-legend");
  const summaryLegendEl  = document.getElementById("summary-legend");
  const rangeHeadingEl   = rangeConfigEl ? rangeConfigEl.querySelector("h2") : null;
  const rangeActionsEl   = rangeConfigEl ? rangeConfigEl.querySelector(".step-actions") : null;
  const colorCodeHeadersCheckbox = document.getElementById("color-code-headers");
  if (colorCodeHeadersCheckbox) {
    colorCodeHeadersCheckbox.addEventListener("change", () => {
      colorCodeTableHeaders = !!colorCodeHeadersCheckbox.checked;
      if (!colorCodeTableHeaders && summaryLegendEl) {
        summaryLegendEl.style.display = "none";
        summaryLegendEl.innerHTML = "";
      }
      reRenderIfReady();
    });
  }


// Block C3 – Range getters & period aggregation for selects
    const plotMinInput   = document.getElementById("plot-min");
  const plotMaxInput   = document.getElementById("plot-max");
  const actualMinInput = document.getElementById("actual-min");
  const actualMaxInput = document.getElementById("actual-max");
  const tableMinInput  = document.getElementById("table-min");
  const tableMaxInput  = document.getElementById("table-max");


  function getRangeConfig() {
    return {
      plotMin: (plotMinInput && plotMinInput.value) || defaultPlotMin,
      plotMax: (plotMaxInput && plotMaxInput.value) || defaultPlotMax,
      actualMin: (plotMinInput && plotMinInput.value) || defaultPlotMin,
      actualMax: (actualMaxInput && actualMaxInput.value) || defaultActualMax,
      tableMin: (tableMinInput && tableMinInput.value) || defaultTableMin,
      tableMax: (tableMaxInput && tableMaxInput.value) || defaultTableMax
    };
  }


  
  function getAllPeriodsFromScenarios(scens) {
    const set = new Set();
    scens.forEach(s => {
      (s.data || []).forEach(r => {
        if (r.period != null && r.period !== "") {
          const p = String(r.period).trim();
          if (parsePeriodToIndex(p) != null) {
            set.add(p);
          }
        }
      });
    });
    const arr = Array.from(set);
    arr.sort((a, b) => parsePeriodToIndex(a) - parsePeriodToIndex(b));
    return arr;
  }

  function populateSelectFromPeriods(selectEl, defaultVal, isMax) {
    if (!selectEl || !availablePeriods.length) return;
    selectEl.innerHTML = "";
    availablePeriods.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      selectEl.appendChild(opt);
    });

    const first = availablePeriods[0];
    const last = availablePeriods[availablePeriods.length - 1];
    const firstIdx = parsePeriodToIndex(first);
    const lastIdx = parsePeriodToIndex(last);

    let chosen = defaultVal;
    const chosenIdx = chosen && parsePeriodToIndex(chosen);

    if (!chosenIdx) {
      chosen = isMax ? last : first;
    } else {
      if (chosenIdx < firstIdx) chosen = first;
      if (chosenIdx > lastIdx) chosen = last;
    }

    selectEl.value = chosen;
  }

  function populateRangeSelects() {
    if (!availablePeriods.length) return;
    populateSelectFromPeriods(plotMinInput, defaultPlotMin, false);
    populateSelectFromPeriods(plotMaxInput, defaultPlotMax, true);
    populateSelectFromPeriods(actualMinInput, defaultActualMin, false);
    populateSelectFromPeriods(actualMaxInput, defaultActualMax, true);
    populateSelectFromPeriods(tableMinInput, defaultTableMin, false);
    populateSelectFromPeriods(tableMaxInput, defaultTableMax, true);

    // Keep actual-min aligned with plot-min and non-editable
    if (plotMinInput && actualMinInput) {
      actualMinInput.value = plotMinInput.value;
      actualMinInput.disabled = true;
    }
  }

  function refreshAvailablePeriodsAndSelects() {
    const scensWithData = scenarios.filter(s => Array.isArray(s.data) && s.data.length > 0);
    if (!scensWithData.length) {
      availablePeriods = [];
      return;
    }
    availablePeriods = getAllPeriodsFromScenarios(scensWithData);
    populateRangeSelects();
  }


  // Block C4 – Scenario row creation & upload logic

  // Helpers
  function createScenarioRow(id, scenario) {
    const row = document.createElement("div");
    row.className = "scenario-row";
    row.dataset.id = id;

    row.innerHTML = `
      <div>
        <label>Scenario name</label>
        <input type="text" placeholder="e.g. MPC Dec-25 (Day 1)" class="scenario-name">
      </div>
      <div>
        <label>Line color</label>
        <input type="color" class="scenario-color" value="${scenario.color}">
      </div>
      <div>
        <label>CSV file</label>
        <input type="file" accept=".csv" class="scenario-file">
      </div>
      <button type="button" class="remove-scenario" title="Remove scenario">&times;</button>
    `;

    // Wire remove
    row.querySelector(".remove-scenario").addEventListener("click", () => {
      const idx = scenarios.findIndex(s => s.id === id);
      if (idx >= 0) scenarios.splice(idx, 1);
      row.remove();
      refreshAvailablePeriodsAndSelects();
    });

    // Wire inputs to state
    row.querySelector(".scenario-name").addEventListener("input", e => {
      const s = scenarios.find(s => s.id === id);
      if (s) s.name = e.target.value;
    });
    row.querySelector(".scenario-color").addEventListener("input", e => {
      const s = scenarios.find(s => s.id === id);
      if (s) s.color = e.target.value;
    });
    row.querySelector(".scenario-file").addEventListener("change", e => {
      const s = scenarios.find(s => s.id === id);
      const file = e.target.files[0] || null;
      if (s) s.file = file;

      if (file) {
        // Extract name
        let fname = file.name.replace(/\.[^/.]+$/, ""); // remove extension

        // Convert "chartpackcsv_Dec25_Internal Briefing" into "MPC Dec-25 (Internal Briefing)"
        // Step 1: extract month+year (e.g. Dec25)
        const match = fname.match(/_(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})/i);
        let scenarioLabel = "";

        if (match) {
          const m = match[1];
          const y = match[2];
          scenarioLabel = `MPC ${m}-${y}`;
        } else {
          scenarioLabel = "MPC Scenario";
        }

        // Step 2: extract descriptor after month-year
        const parts = fname.split(match ? match[0] : "");
        if (parts.length > 1) {
          let desc = parts[1].replace(/[_-]+/g, " ").trim();
          if (desc) scenarioLabel += ` (${desc})`;
        }

        // Update scenario state + input field
        s.name = scenarioLabel;
        row.querySelector(".scenario-name").value = scenarioLabel;

        // Parse this file immediately to populate data and refresh ranges
        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            const rows = results.data.filter(r => r.period != null && r.period !== "");
            augmentScenarioDataWithGrowth(rows);
            s.data = rows;
            refreshAvailablePeriodsAndSelects();
          },
          error: err => {
            console.error(err);
            alert("There was a problem reading " + file.name + ". Please check the format.");
          }
        });
      }
    });

    return row;
  }



  // Block C5 – Adding scenarios, parsing, validation, build/back buttons
  function addScenario() {
    if (scenarios.length >= maxScenarios) {
      alert(`You can upload at most ${maxScenarios} scenarios for now.`);
      return;
    }
    const id = Date.now() + "_" + Math.random().toString(16).slice(2);
    const defaultColors = [
      "#1f77b4", // blue
      "#ff7f0e", // orange
      "#2ca02c", // green
      "#d62728", // red
      "#9467bd", // purple
      "#8c564b", // brown
      "#e377c2", // pink
      "#7f7f7f", // gray
      "#bcbd22", // olive
      "#17becf"  // teal
    ];
    const scenario = {
      id,
      name: "",
      color: defaultColors[scenarios.length] || "#000000",
      file: null,
      data: null
    };
    scenarios.push(scenario);
    const row = createScenarioRow(id, scenario);
    scenarioListEl.appendChild(row);
  }

  // Initialize with 2 rows by default
  addScenario();
  addScenario();

  addScenarioBtn.addEventListener("click", addScenario);


    // Parse one scenario CSV into scenario.data
  function parseScenario(scenario) {
    return new Promise((resolve, reject) => {
      if (!scenario.file) {
        return reject(new Error("Missing file for scenario " + (scenario.name || "")));
      }
      Papa.parse(scenario.file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: results => {
          const rows = results.data.filter(r => r.period != null && r.period !== "");
          augmentScenarioDataWithGrowth(rows);
          scenario.data = rows;
          resolve(scenario);
        },
        error: err => reject(err)
      });
    });
  }

  function validateScenarios() {
    const valid = scenarios.filter(s => s.file);
    if (valid.length === 0) {
      alert("Please upload at least one CSV file.");
      return null;
    }
    // Fill default names
    valid.forEach((s, idx) => {
      if (!s.name || !s.name.trim()) {
        s.name = "Scenario " + (idx + 1);
      }
    });
    return valid;
  }


// Main build dashboard action
  buildDashboardBtn.addEventListener("click", () => {
    const validScenarios = scenarios.filter(s => Array.isArray(s.data) && s.data.length > 0);
    if (!validScenarios.length) {
      alert("Please upload at least one valid CSV file before building the dashboard.");
      return;
    }

    // Ensure ranges are populated if not done yet
    if (!availablePeriods.length) {
      availablePeriods = getAllPeriodsFromScenarios(validScenarios);
      populateRangeSelects();
    }

    currentScenarios = validScenarios;

    // Hide upload card, keep range card visible (as part of dashboard), show dashboard
    configStepEl.style.display = "none";
    dashboardStepEl.style.display = "block";
    if (rangeConfigEl) {
      rangeConfigEl.style.display = "block";
    }
    // On the dashboard page: no "2." and no Build button
    if (rangeHeadingEl) {
      rangeHeadingEl.textContent = "Set plot and table ranges";
    }
    if (rangeActionsEl) {
      rangeActionsEl.style.display = "none";
    }

    scenarioCountLbl.textContent = `${validScenarios.length} scenario${validScenarios.length > 1 ? "s" : ""} loaded`;
    renderDashboard(currentScenarios);
  });

  backToConfigBtn.addEventListener("click", () => {
    dashboardStepEl.style.display = "none";
    configStepEl.style.display = "block";
    if (rangeConfigEl) {
      rangeConfigEl.style.display = "block";
    }
    // Back on the first page: show "2." and the Build button again
    if (rangeHeadingEl) {
      rangeHeadingEl.textContent = "2. Set plot and table ranges";
    }
    if (rangeActionsEl) {
      rangeActionsEl.style.display = "flex";
    }
  });

// Block C6 – Download menu UI (but not export internals)

  if (downloadToggleBtn && downloadMenuEl) {
    downloadToggleBtn.addEventListener("click", () => {
      downloadMenuEl.classList.toggle("open");
      if (downloadHtmlSubmenuEl) {
        downloadHtmlSubmenuEl.classList.remove("open");
      }
    });

    if (downloadHtmlParentBtn && downloadHtmlSubmenuEl) {
      downloadHtmlParentBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        downloadHtmlSubmenuEl.classList.toggle("open");
      });
    }

    downloadMenuEl.querySelectorAll("button[data-download]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-download");
        downloadMenuEl.classList.remove("open");
        if (downloadHtmlSubmenuEl) {
          downloadHtmlSubmenuEl.classList.remove("open");
        }

        if (action === "html-interactive") {
          downloadStandaloneDashboard(false);
        } else if (action === "html-fixed") {
          downloadStandaloneDashboard(true);
        } else if (action === "pdf") {
          handlePdfDownloadClick();
        }
      });
    });

    document.addEventListener("click", evt => {
      if (!downloadWrapperEl) return;
      if (!downloadWrapperEl.contains(evt.target)) {
        downloadMenuEl.classList.remove("open");
        if (downloadHtmlSubmenuEl) {
          downloadHtmlSubmenuEl.classList.remove("open");
        }
      }
    });
  }

// Block C7 – Re-render helper & range change wiring

  function reRenderIfReady() {
    if (dashboardStepEl.style.display !== "none" && currentScenarios && currentScenarios.length) {
      renderDashboard(currentScenarios);
    }
  }

  [plotMinInput, plotMaxInput, actualMinInput, actualMaxInput, tableMinInput, tableMaxInput].forEach(el => {
    if (!el) return;
    el.addEventListener("change", () => {
      // Keep actual-min locked to plot-min
      if (el === plotMinInput && actualMinInput) {
        actualMinInput.value = plotMinInput.value;
      }
      reRenderIfReady();
    });
  });

// Block C8 – Chart visibility + DOMContentLoaded wiring
 // Chart visibility toggles
  function applyChartVisibility() {
    const toggles = document.querySelectorAll(".chart-toggle");
    toggles.forEach(toggle => {
      const targetId = toggle.getAttribute("data-chart-id");
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      targetEl.style.display = toggle.checked ? "block" : "none";
    });

    // After visibility changes, force Plotly to recompute sizes
    const visibleCharts = document.querySelectorAll(".chart-box");
    visibleCharts.forEach(box => {
      if (box.style.display !== "none" && typeof Plotly !== "undefined" && Plotly.Plots && typeof Plotly.Plots.resize === "function") {
        Plotly.Plots.resize(box);
      }
    });
  }

  // Initialize visibility and listen for changes
  document.addEventListener("DOMContentLoaded", () => {
    applyChartVisibility();
    const toggles = document.querySelectorAll(".chart-toggle");
    toggles.forEach(toggle => {
      toggle.addEventListener("change", applyChartVisibility);
    });

    const tableVarCheckboxes = document.querySelectorAll(".table-var-checkbox");
    tableVarCheckboxes.forEach(cb => {
      cb.addEventListener("change", reRenderIfReady);
    });
    const freqRadios = document.querySelectorAll(".table-frequency-radio");
    freqRadios.forEach(r => {
      if (r.checked) summaryFrequency = r.value;
      r.addEventListener("change", e => {
        if (e.target.checked) {
          summaryFrequency = e.target.value;
          reRenderIfReady();
        }
      });
    });
  });

  // Block C9 – Orchestrator: renderDashboard

    function renderDashboard(scenarios) {
    const ranges = getRangeConfig();
    renderScenarioLegend(scenarios);
    renderOutputGapChart(scenarios, ranges);
    renderOutputLevelsChart(scenarios, ranges);
    renderHeadlineYoyChart(scenarios, ranges);
    renderCoreYoyChart(scenarios, ranges);
    renderPolicyChart(scenarios, ranges);
    renderPolicyStepChart(scenarios, ranges);
    renderPotentialGrowthChart(scenarios, ranges);
    renderCoreQoqChart(scenarios, ranges);
    renderHeadlineQoqChart(scenarios, ranges);
    renderSummaryTables(scenarios, ranges);

    // Ensure all charts fit their grid cells on initial render
    const visibleCharts = document.querySelectorAll(".chart-box");
    visibleCharts.forEach(box => {
      if (box.style.display !== "none" && typeof Plotly !== "undefined" && Plotly.Plots && typeof Plotly.Plots.resize === "function") {
        Plotly.Plots.resize(box);
      }
    });
  }

















