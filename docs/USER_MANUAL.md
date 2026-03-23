# PMSS User Manual

This user manual walks you through the main features of **PMSS (Project Management & Site Systems)** so you can quickly start tracking budget, cost performance, and change orders for construction projects.

---

## 1. Getting Started

### 1.1 Install & Launch
1. Open a terminal in the project root.
2. Run:
   ```bash
   npm install
   npm run init-db
   npm start
   ```
3. Open your browser at **http://localhost:3000**.

> ⚠️ Do not open `index.html` directly using `file://` - the app needs the server API.


### 1.2 Load Sample Data
If you see an empty dashboard, click **"Load Sample Data"** to populate the system with a sample project, budget breakdown, EVM data, change orders, risks, cash flow, and more.

---

## 2. Project Management

### 2.1 Create a New Project
1. Click **+ Project** in the header.
2. Enter project name, optional description, start/end dates, and currency.
3. Click **Create**.

> ✅ The app defaults to **ETB (Ethiopian Birr)** for new projects (currency selector is still available).


### 2.2 Switch Between Projects
Use the project dropdown in the header to switch active projects.

---

## 3. Main Modules (Views)

The app is organized into modules accessible via the top navigation.

### 3.1 Dashboard
The executive dashboard shows:
- Total Budget, Actual Spend, and Estimate at Completion (EAC)
- % Complete, CPI, SPI
- Budget allocation chart
- Change Order impact chart


### 3.2 Cost Breakdown Structure (CBS)
Track your cost structure at a WBS level:
- Original budget
- Approved changes
- Current budget
- Actual cost
- ETC / EAC
- Variance


### 3.3 Earned Value Management (EVM)
Track EVM metrics, including:
- BAC, PV, EV, AC
- SPI / CPI
- EAC / VAC

Add new entries via **+ Add EVM Entry**.


### 3.4 Change Orders
Track change orders and approve them:
- Add a change order with cost & schedule impact.
- Approve pending change orders using the **Approve** button.


### 3.5 Risk Register
Track risks with probability, impact, and contingency dollars.
- Add a risk, then set allocated contingency.
- The dashboard uses this data for summary KPIs.


### 3.6 Cost Detail (Labor / Materials / Equipment)
Track breakdown of direct costs.
- Enter budget hours/prices or a budget amount.
- Track actual hours and actual amounts.


### 3.7 Subcontractors
Track subcontractor contracts and change order adjustments.


### 3.8 Vendor Bid Comparison
Create procurement packages and compare vendor bids.


### 3.9 Cash Flow Forecast
Track planned vs actual cash flow by month.


### 3.10 Cost Codes
Displays a reference list of CSI MasterFormat cost codes.

---

## 4. Exporting Data
All module tables include an **Export** button.
- Clicking **Export** downloads a CSV file for the current module.
- Use Excel or similar tools to view or share these exports.

---

## 5. Currency and Formatting
- The system formats all currency values using the selected project currency.
- By default, new projects use **ETB** (Ethiopian Birr).

---

## 6. Tips & Troubleshooting
- If the dashboard shows “No Data Yet”, create or load a project.
- If the app cannot reach the backend, it falls back to local storage for offline usage.
- To reset all sample data, run `npm run init-db` again (this clears the database and re-seeds data).

---

## 7. Files & Where to Find Things
- **`public/index.html`** – UI layout and modals.
- **`public/app.js`** – UI logic, API calls, formatting.
- **`server/index.js`** – REST API endpoints and business logic.
- **`database/schema.sql`** – Database schema definition.
- **`database/init.js`** / **`database/seed.js`** – Database initialization + sample data.

---

If you want more help using a specific module or workflow, open an issue or ask for an example scenario (e.g., “How do I record a change order and see its impact?”).