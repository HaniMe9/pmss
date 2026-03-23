# About PMSS

**PMSS** is a lightweight, browser-based **Project Management & Site Systems** tool built to help construction teams manage budgets, change orders, earned value, risks, vendors, and cash flow in a single, integrated experience.

## Purpose
The goal of PMSS is to provide a practical, easy-to-use dashboard for project controls and construction finance stakeholders. It offers:

- **Executive KPIs** (budget, spend, CPI/SPI, EAC)
- **Cost Breakdown and Budget Control** (CBS structure, actuals, variance)
- **Change Order Tracking** (approval workflow and impact tracking)
- **Earned Value Management (EVM)** reporting
- **Risk Register** and contingency tracking
- **Cost Item tracking** for labor, materials, equipment
- **Procurement comparisons** (vendor bids)
- **Cash flow forecasting** by period


## Who Is This For?
PMSS is a good fit for:

- Project managers and project controls professionals who want a simple, offline-capable planning tool
- Small to mid-sized construction teams who need a lightweight solution without enterprise complexity
- Anyone who wants to experiment with EVM, cash flow, and change order tracking in a single app


## Technology Stack

| Layer | Technology |
|------|------------|
| Backend | Node.js + Express |
| Database | SQLite (local file `database/pmss.db`) |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Deployment | Run locally via `npm start`, serves UI + API from the same server |


## Project Structure

```
pmss/
├── database/        # Schema, seed scripts, and SQLite database
├── server/          # Express API server
├── public/          # Frontend single-page application
└── docs/            # Architecture docs and user guides
```


## How to Extend

To add a new module or dataset:

1. Extend the database schema in `database/schema.sql`.
2. Add seed data in `database/seed.js` (and/or `database/init.js`).
3. Add API routes in `server/index.js`.
4. Add UI views and interactions in `public/index.html` + `public/app.js`.


## License
This project is provided under the terms of the MIT License (or the license you choose).

---

*Created by the PMSS team.*