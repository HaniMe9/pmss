import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = join(__dirname, 'pmss.db');
const db = new Database(dbPath);

// Disable foreign keys so we can drop tables in any order
db.pragma('foreign_keys = OFF');

// Drop existing tables so init is re-runnable (order matters: child tables first)
const dropOrder = [
  'vendor_bids', 'procurement_packages', 'vendors', 'subcontractors', 'cost_items', 'cash_flow',
  'evm_data', 'risks', 'change_orders', 'cbs_budgets', 'cbs_nodes',
  'cost_codes', 'projects'
];
dropOrder.forEach(t => db.exec(`DROP TABLE IF EXISTS ${t}`));

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

db.pragma('foreign_keys = ON');

// Seed sample cost codes (CSI-aligned)
const costCodes = [
  { code: '01', name: 'General Requirements', category: 'Overhead' },
  { code: '02', name: 'Existing Conditions', category: 'Materials' },
  { code: '03', name: 'Concrete', category: 'Materials' },
  { code: '04', name: 'Masonry', category: 'Materials' },
  { code: '05', name: 'Metals', category: 'Materials' },
  { code: '06', name: 'Wood & Plastics', category: 'Materials' },
  { code: '07', name: 'Thermal/Moisture', category: 'Materials' },
  { code: '08', name: 'Openings', category: 'Materials' },
  { code: '09', name: 'Finishes', category: 'Materials' },
  { code: '10', name: 'Specialties', category: 'Materials' },
  { code: 'LAB', name: 'Labor', category: 'Labor' },
  { code: 'EQP', name: 'Equipment', category: 'Equipment' },
  { code: 'SUB', name: 'Subcontractors', category: 'Subcontractors' },
];

const insCode = db.prepare('INSERT OR IGNORE INTO cost_codes (code, name, category) VALUES (?, ?, ?)');
costCodes.forEach(c => insCode.run(c.code, c.name, c.category));

// Seed sample project
const insProject = db.prepare(`
  INSERT INTO projects (name, description, start_date, end_date, currency) 
  VALUES (?, ?, ?, ?, ?)
`);
insProject.run(
  'Sample Commercial Tower',
  '24-story mixed-use development',
  '2025-01-01',
  '2026-12-31',
  'ETB'
);

// Seed CBS structure
const projectId = 1;
const cbsNodes = [
  { wbs: '1.0', name: 'Project Total', parent: null },
  { wbs: '1.1', name: 'Site Work', parent: 1 },
  { wbs: '1.2', name: 'Structure', parent: 1 },
  { wbs: '1.3', name: 'Building Envelope', parent: 1 },
  { wbs: '1.4', name: 'Interior Finishes', parent: 1 },
  { wbs: '1.5', name: 'MEP', parent: 1 },
  { wbs: '1.6', name: 'Indirect Costs', parent: 1 },
];

const insCbs = db.prepare(`
  INSERT INTO cbs_nodes (project_id, parent_id, wbs_code, name, level) VALUES (?, ?, ?, ?, ?)
`);

cbsNodes.forEach((n, i) => {
  const parentId = n.parent;
  const level = parentId ? 2 : 1;
  insCbs.run(projectId, parentId, n.wbs, n.name, level);
});

// Seed CBS budgets
const budgets = [
  { node: 1, orig: 25000000, changes: 0, comm: 8500000, actual: 6200000, etc: 16500000, eac: 22700000 },
  { node: 2, orig: 2500000, changes: 150000, comm: 1200000, actual: 980000, etc: 1720000, eac: 2700000 },
  { node: 3, orig: 8000000, changes: 0, comm: 3500000, actual: 2200000, etc: 5800000, eac: 8000000 },
  { node: 4, orig: 5000000, changes: 200000, comm: 800000, actual: 450000, etc: 4750000, eac: 5200000 },
  { node: 5, orig: 4000000, changes: 0, comm: 500000, actual: 280000, etc: 3720000, eac: 4000000 },
  { node: 6, orig: 3500000, changes: 50000, comm: 1200000, actual: 1650000, etc: 1900000, eac: 3550000 },
  { node: 7, orig: 2500000, changes: 0, comm: 350000, actual: 620000, etc: 1880000, eac: 2500000 },
];

const insBudget = db.prepare(`
  INSERT INTO cbs_budgets (cbs_node_id, original_budget, approved_changes, committed_cost, actual_cost, etc, eac)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
budgets.forEach(b => insBudget.run(b.node, b.orig, b.changes, b.comm, b.actual, b.etc, b.eac));

// Seed EVM
const bac = 25000000;
const ac = 6200000;
const ev = 5800000;
const pv = 6000000;
const cpi = ev / ac;
const spi = ev / pv;
const eac = bac / cpi;
const etc = eac - ac;
const vac = bac - eac;
const tcpi = (bac - ev) / (bac - ac);

db.prepare(`
  INSERT INTO evm_data (project_id, report_date, bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi, performance_rating)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(projectId, '2025-02-28', bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi, 'Under Review');

// Seed change orders
const cos = [
  { co: 'CO-001', desc: 'Additional excavation for utilities', status: 'Approved', impact: 85000, days: 5 },
  { co: 'CO-002', desc: 'Upgrade facade glass specification', status: 'Pending', impact: 200000, days: 0 },
  { co: 'CO-003', desc: 'Soil remediation scope increase', status: 'Approved', impact: 65000, days: 10 },
];

const insCO = db.prepare(`
  INSERT INTO change_orders (project_id, co_number, description, status, cost_impact, schedule_impact_days, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
cos.forEach(c => insCO.run(projectId, c.co, c.desc, c.status, c.impact, c.days, 'Medium'));

// Seed risks
const risks = [
  { title: 'Material price escalation', prob: 4, impact: 4, alloc: 250000, used: 0 },
  { title: 'Labor shortage delays', prob: 3, impact: 3, alloc: 150000, used: 25000 },
  { title: 'Weather delays', prob: 2, impact: 2, alloc: 100000, used: 0 },
];

const insRisk = db.prepare(`
  INSERT INTO risks (project_id, title, probability, impact, allocated_contingency, used_contingency, risk_owner)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
risks.forEach(r => insRisk.run(projectId, r.title, r.prob, r.impact, r.alloc, r.used, 'PM'));

// Seed vendors & bids
const vendors = [
  { name: 'ABC Steel Inc', contact: 'John Smith', terms: 'Net 30' },
  { name: 'Premier Concrete Co', contact: 'Maria Garcia', terms: 'Net 45' },
  { name: 'Metro Foundations', contact: 'David Lee', terms: 'Net 30' },
];

const insVendor = db.prepare(`
  INSERT INTO vendors (name, contact_person, payment_terms) VALUES (?, ?, ?)
`);
vendors.forEach(v => insVendor.run(v.name, v.contact, v.terms));

db.prepare(`
  INSERT INTO procurement_packages (project_id, package_name, description, lead_time_days)
  VALUES (?, ?, ?, ?)
`).run(projectId, 'Structural Steel', 'Supply and erect structural steel', 90);

db.prepare(`
  INSERT INTO vendor_bids (package_id, vendor_id, bid_amount, lead_time_days, score)
  VALUES (1, 1, 4200000, 90, 92), (1, 2, 4450000, 75, 88), (1, 3, 3980000, 120, 85)
`).run();

// Seed cost items (Labor, Materials, Equipment)
const costItems = [
  { cat: 'Labor', desc: 'Structural steel erection', bh: 5000, br: 45, ah: 1200, aa: 54000 },
  { cat: 'Labor', desc: 'Concrete placement', bh: 3000, br: 38, ah: 800, aa: 30400 },
  { cat: 'Materials', desc: 'Reinforcement steel', budget: 450000, actual: 380000 },
  { cat: 'Equipment', desc: 'Crane rental', bh: 90, br: 1200, ah: 25, aa: 30000 },
];
const insCostItem = db.prepare(`
  INSERT INTO cost_items (project_id, category, description, budget_hours, budget_rate, budget_amount, actual_hours, actual_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
costItems.forEach(c => {
  const bH = c.bh ?? 0, bR = c.br ?? 0, bA = c.budget ?? (bH * bR);
  insCostItem.run(projectId, c.cat, c.desc, bH || null, bR || null, bA, c.ah || null, c.aa ?? c.actual ?? 0);
});

// Seed subcontractors
db.prepare(`
  INSERT INTO subcontractors (project_id, vendor_id, original_contract, change_orders_total, revised_contract, invoiced_to_date, retention_held, percent_complete)
  VALUES (1, 1, 4200000, 0, 4200000, 1680000, 84000, 40),
         (1, 2, 1850000, 150000, 2000000, 600000, 60000, 30)
`).run();

// Seed cash flow (6 months)
const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
const planned = [1800000, 2200000, 2500000, 2400000, 2300000, 2100000];
const actual = [1650000, 2050000, 0, 0, 0, 0];
let cumPlanned = 0, cumActual = 0;

const insCF = db.prepare(`
  INSERT INTO cash_flow (project_id, period_date, planned_spend, actual_spend, cumulative_planned, cumulative_actual)
  VALUES (?, ?, ?, ?, ?, ?)
`);

months.forEach((m, i) => {
  cumPlanned += planned[i];
  cumActual += actual[i] || 0;
  insCF.run(projectId, m + '-01', planned[i], actual[i] || 0, cumPlanned, cumActual);
});

db.close();
console.log('Database initialized with sample data at database/pmss.db');
