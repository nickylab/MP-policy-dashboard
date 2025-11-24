# MP-policy-dashboard
Interactive HTML dashboard for comparing policy rate projections and macro scenarios.

---

## Features

- Upload up to 6 MPC scenarios from CSV chartpacks
- Auto naming of scenarios from file names (for example, `chartpackcsv_Dec25_Internal Briefing`)
- Shared time range controls for:
  - Plot range (all charts)
  - Actual data shading range
  - Summary table range
- Nine interactive charts (Plotly):
  - Output gap
  - Output and potential output (log levels)
  - Headline inflation (%YoY)
  - Core inflation (%YoY)
  - Policy rate
  - Policy rate in 0.25 step form
  - Potential growth
  - Core inflation (%QoQ annualized)
  - Headline inflation (%QoQ annualized)
- Summary table with:
  - Quarterly or yearly view
  - Variable selection (output gap, policy rate, inflation, GDP growth, etc.)
  - Optional color coded scenario headers
- Export options:
  - Interactive HTML (keeps all controls)
  - Fixed HTML snapshot (frozen layout for sharing)
  - Vector PDF chart pack (A3 landscape) with charts and summary table

---

## Tech stack

- Pure static front end
  - HTML, CSS, JavaScript
- Libraries
  - [Plotly](https://plotly.com/javascript/) for charts
  - [PapaParse](https://www.papaparse.com/) for CSV parsing
  - [jsPDF](https://github.com/parallax/jsPDF) + `jspdf-autotable` for PDF export

No build tooling is required. You can open the main HTML file directly in a browser or host it on GitHub Pages.

---

## Folder structure

```text
.
├── policy_dashboard.html        # Main entry page
├── css/
│   └── policy_dashboard.css     # Styles for layout, cards, charts, table, menu
└── js/
    ├── policy_dashboard.core.js   # UI flow, DOM wiring, ranges, scenario list
    ├── policy_dashboard.data.js   # Variable registry and calculations
    ├── policy_dashboard.charts.js # Plotly charts
    ├── policy_dashboard.summary.js# Summary tables
    └── policy_dashboard.export.js # HTML and PDF export logic
```
