# PMSS — All-in-One Construction Cost Management System

A fully integrated financial control framework for construction projects: CBS, Budget Control, Change Orders, EVM, Risk, Vendor Comparison, Cash Flow, and Executive Reporting.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database (creates pmss.db with sample data)
npm run init-db

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

> **Tip:** Use the **Help** dropdown in the top-right to access the **User Manual** and **About** docs directly in the app.

> **Important:** Use the full URL. Do not open the HTML file directly (file://) — the API won't work.

> **Empty dashboard?** Click **"Load Sample Data"** to populate a sample project with CBS, EVM, change orders, and more.

> **Port in use?** Stop the other process, or run `npm start` with `PORT=3001` (e.g. `set PORT=3001 && npm start` on Windows).

## Modules

| Module | Description |
|--------|-------------|
| **Executive Dashboard** | KPIs, budget allocation, change order impact |
| **CBS** | Cost Breakdown Structure with budget, actuals, ETC, EAC, variance |
| **EVM** | Earned Value Management (BAC, PV, EV, AC, SPI, CPI, EAC, VAC) |
| **Change Orders** | Lifecycle tracking, approval workflow |
| **Risk Register** | Probability × impact, contingency allocation |
| **Cost Detail** | Labor, Materials, Equipment tracking (budget vs actual) |
| **Subcontractors** | Original contract, change orders, invoiced, retention, % complete |
| **Vendor Bids** | Side-by-side comparison, lowest bid, add vendor/package |
| **Cash Flow** | Planned vs actual by period |
| **Cost Codes** | CSI MasterFormat reference (Labor, Materials, Equipment, Subs, Overhead) |

## Excel Export

Each module has an **Export** button. Downloaded CSV files open in Excel.

## Architecture

- **Backend:** Node.js + Express + SQLite
- **Frontend:** Vanilla HTML/CSS/JS
- **Data model:** See `docs/ARCHITECTURE.md`

## Project Structure

```
pmss/
├─ public/
│  └─ index.html
├─ src/
│  ├─ App.js
│  ├─ index.js
│  └─ styles.css
├─ server/
│  └─ index.js
├─ database/
│  ├─ init.js
│  ├─ seed.js
│  ├─ schema.sql
│  └─ pmss.db
├─ docs/
├─ package.json
└─ ...
```

## API Endpoints

- `GET/POST /api/projects` — List or create projects
- `GET /api/dashboard/:id` — Dashboard summary
- `GET /api/cbs/:id` — CBS nodes with budgets
- `GET /api/cost-codes` — Cost code reference
- `GET/POST /api/evm` — EVM data
- `GET /api/change-orders/:id` — Change orders
- `GET /api/risks/:id` — Risk register
- `GET/POST /api/cost-items/:id` — Labor/Materials/Equipment
- `GET/POST /api/subcontractors/:id` — Subcontractors
- `GET /api/vendors` — Vendors
- `GET/POST /api/procurement` — Procurement packages
- `POST /api/vendor-bids` — Add vendor bid
- `GET /api/cash-flow/:id` — Cash flow
- `GET /api/export/:id/:module` — CSV export (cbs, evm, change-orders, risks, cash-flow, cost-items, subcontractors)
<img width="1517" height="813" alt="image" src="https://github.com/user-attachments/assets/85cdd63b-2afc-44d3-811b-cc05529c267b" />
<img width="1918" height="662" alt="image" src="https://github.com/user-attachments/assets/8611a4c7-d77f-425f-8a51-2d81c91897a5" />


  
