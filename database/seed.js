import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runSeed(db) {
  db.pragma('foreign_keys = OFF');
  const dropOrder = [
    'vendor_bids', 'procurement_packages', 'vendors', 'subcontractors', 'cost_items', 'cash_flow',
    'evm_data', 'risks', 'change_orders', 'cbs_budgets', 'cbs_nodes', 'cost_codes', 'projects'
  ];
  dropOrder.forEach(t => db.exec(`DROP TABLE IF EXISTS ${t}`));
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.pragma('foreign_keys = ON');

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

  db.prepare(`INSERT INTO projects (name, description, start_date, end_date, currency) VALUES (?, ?, ?, ?, ?)`)
    .run('Sample Commercial Tower', '24-story mixed-use development', '2025-01-01', '2026-12-31', 'ETB');

  const projectId = 1;
  const cbsNodes = [
    { wbs: '1.0', name: 'Project Total', parent: null }, { wbs: '1.1', name: 'Site Work', parent: 1 },
    { wbs: '1.2', name: 'Structure', parent: 1 }, { wbs: '1.3', name: 'Building Envelope', parent: 1 },
    { wbs: '1.4', name: 'Interior Finishes', parent: 1 }, { wbs: '1.5', name: 'MEP', parent: 1 },
    { wbs: '1.6', name: 'Indirect Costs', parent: 1 },
  ];
  const insCbs = db.prepare('INSERT INTO cbs_nodes (project_id, parent_id, wbs_code, name, level) VALUES (?, ?, ?, ?, ?)');
  cbsNodes.forEach(n => insCbs.run(projectId, n.parent, n.wbs, n.name, n.parent ? 2 : 1));

  const budgets = [
    [1, 25000000, 0, 8500000, 6200000, 16500000, 22700000], [2, 2500000, 150000, 1200000, 980000, 1720000, 2700000],
    [3, 8000000, 0, 3500000, 2200000, 5800000, 8000000], [4, 5000000, 200000, 800000, 450000, 4750000, 5200000],
    [5, 4000000, 0, 500000, 280000, 3720000, 4000000], [6, 3500000, 50000, 1200000, 1650000, 1900000, 3550000],
    [7, 2500000, 0, 350000, 620000, 1880000, 2500000],
  ];
  const insBudget = db.prepare('INSERT INTO cbs_budgets (cbs_node_id, original_budget, approved_changes, committed_cost, actual_cost, etc, eac) VALUES (?, ?, ?, ?, ?, ?, ?)');
  budgets.forEach(([node, o, c, comm, act, etc, eac]) => insBudget.run(node, o, c, comm, act, etc, eac));

  const bac = 25000000, ac = 6200000, ev = 5800000, pv = 6000000;
  const cpi = ev / ac, spi = ev / pv, eac = bac / cpi, etc = eac - ac, vac = bac - eac, tcpi = (bac - ev) / (bac - ac);
  db.prepare(`INSERT INTO evm_data (project_id, report_date, bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi, performance_rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(projectId, '2025-02-28', bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi, 'Under Review');

  [[projectId, 'CO-001', 'Additional excavation for utilities', 'Approved', 85000, 5],
   [projectId, 'CO-002', 'Upgrade facade glass specification', 'Pending', 200000, 0],
   [projectId, 'CO-003', 'Soil remediation scope increase', 'Approved', 65000, 10]].forEach(([pid, co, desc, st, imp, days]) =>
    db.prepare('INSERT INTO change_orders (project_id, co_number, description, status, cost_impact, schedule_impact_days, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(pid, co, desc, st, imp, days, 'Medium'));

  [[projectId, 'Material price escalation', 4, 4, 250000, 0], [projectId, 'Labor shortage delays', 3, 3, 150000, 25000],
   [projectId, 'Weather delays', 2, 2, 100000, 0]].forEach(([pid, t, p, i, a, u]) =>
    db.prepare('INSERT INTO risks (project_id, title, probability, impact, allocated_contingency, used_contingency, risk_owner) VALUES (?, ?, ?, ?, ?, ?, ?)').run(pid, t, p, i, a, u, 'PM'));

  const insV = db.prepare('INSERT INTO vendors (name, contact_person, payment_terms) VALUES (?, ?, ?)');
  insV.run('ABC Steel Inc', 'John Smith', 'Net 30');
  insV.run('Premier Concrete Co', 'Maria Garcia', 'Net 45');
  insV.run('Metro Foundations', 'David Lee', 'Net 30');

  db.prepare('INSERT INTO procurement_packages (project_id, package_name, description, lead_time_days) VALUES (?, ?, ?, ?)')
    .run(projectId, 'Structural Steel', 'Supply and erect structural steel', 90);
  db.prepare('INSERT INTO vendor_bids (package_id, vendor_id, bid_amount, lead_time_days, score) VALUES (1,1,4200000,90,92),(1,2,4450000,75,88),(1,3,3980000,120,85)').run();

  const insCI = db.prepare('INSERT INTO cost_items (project_id, category, description, budget_hours, budget_rate, budget_amount, actual_hours, actual_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insCI.run(projectId, 'Labor', 'Structural steel erection', 5000, 45, null, 1200, 54000);
  insCI.run(projectId, 'Labor', 'Concrete placement', 3000, 38, null, 800, 30400);
  insCI.run(projectId, 'Materials', 'Reinforcement steel', null, null, 450000, null, 380000);
  insCI.run(projectId, 'Equipment', 'Crane rental', 90, 1200, null, 25, 30000);

  db.prepare(`INSERT INTO subcontractors (project_id, vendor_id, original_contract, change_orders_total, revised_contract, invoiced_to_date, retention_held, percent_complete) VALUES (1,1,4200000,0,4200000,1680000,84000,40),(1,2,1850000,150000,2000000,600000,60000,30)`).run();

  const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
  const planned = [1800000, 2200000, 2500000, 2400000, 2300000, 2100000], actual = [1650000, 2050000, 0, 0, 0, 0];
  let cumP = 0, cumA = 0;
  const insCF = db.prepare('INSERT INTO cash_flow (project_id, period_date, planned_spend, actual_spend, cumulative_planned, cumulative_actual) VALUES (?, ?, ?, ?, ?, ?)');
  months.forEach((m, i) => { cumP += planned[i]; cumA += actual[i] || 0; insCF.run(projectId, m + '-01', planned[i], actual[i] || 0, cumP, cumA); });
}
