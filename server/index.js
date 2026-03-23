import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runSeed } from '../database/seed.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || join(__dirname, '../database/pmss.db'));

const app = express();

// --- Basic logging middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.use('/docs', express.static(join(__dirname, '../docs')));
// Allow the frontend HTML in /public to reference /src/App.js and /src/styles.css
app.use('/src', express.static(join(__dirname, '../src')));

// --- Simple validation helpers ---
function requireFields(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
  return missing;
}

function validateNumberFields(body, fields) {
  const invalid = fields.filter(f => body[f] !== undefined && body[f] !== null && body[f] !== '' && Number.isNaN(Number(body[f])));
  return invalid;
}

// --- Projects ---
app.get('/api/projects', (_, res) => {
  const rows = db.prepare('SELECT * FROM projects').all();
  res.json(rows);
});

app.get('/api/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(row || {});
});

app.post('/api/init', (_, res) => {
  try {
    runSeed(db);
    res.json({ ok: true, message: 'Sample data loaded' });
  } catch (err) {
    console.error('Init failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', (req, res, next) => {
  try {
    const { name, description, start_date, end_date, currency } = req.body || {};
    const missing = requireFields({ name: name || 'New Project' }, ['name']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const result = db.prepare(`
      INSERT INTO projects (name, description, start_date, end_date, currency)
      VALUES (?, ?, ?, ?, ?)
    `).run(name || 'New Project', description || null, start_date || null, end_date || null, currency || 'ETB');
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// --- AI helper endpoints (stubbed for now) ---
app.post('/api/ask', (req, res) => {
  const { project_id, question } = req.body || {};
  if (!project_id || !question) {
    return res.status(400).json({ error: 'project_id and question are required' });
  }
  const pid = project_id;
  const dash = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(b.original_budget) + SUM(b.approved_changes),0)
       FROM cbs_budgets b
       JOIN cbs_nodes n ON n.id = b.cbs_node_id
       WHERE n.project_id = ?) as total_budget,
      (SELECT COALESCE(SUM(b.actual_cost),0)
       FROM cbs_budgets b
       JOIN cbs_nodes n ON n.id = b.cbs_node_id
       WHERE n.project_id = ?) as actual_spend
  `).get(pid, pid);
  const evm = db.prepare(`
    SELECT * FROM evm_data WHERE project_id = ? ORDER BY report_date DESC LIMIT 1
  `).get(pid);
  const coStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'Approved' THEN cost_impact ELSE 0 END) as approved_impact,
      SUM(CASE WHEN status = 'Pending' THEN cost_impact ELSE 0 END) as pending_impact
    FROM change_orders WHERE project_id = ?
  `).get(pid);
  const summary = {
    total_budget: dash?.total_budget || 0,
    actual_spend: dash?.actual_spend || 0,
    latest_evm: evm || {},
    change_orders: coStats || { approved_impact: 0, pending_impact: 0 },
  };
  // Simple rule-based explanation as a placeholder for a real LLM call
  const cpi = evm?.cpi;
  const spi = evm?.spi;
  const fmtMoney = v => (v == null || isNaN(Number(v))) ? '0' : Number(v).toLocaleString('en-US');
  let answer = 'AI summary based on current data:\n';
  answer += `Total budget is Birr ${fmtMoney(summary.total_budget)}, actual spend is Birr ${fmtMoney(summary.actual_spend)}.\n`;
  if (cpi != null) answer += `Cost performance index (CPI) is ${cpi.toFixed(2)}.\n`;
  if (spi != null) answer += `Schedule performance index (SPI) is ${spi.toFixed(2)}.\n`;
  if ((summary.change_orders.approved_impact || 0) > 0 || (summary.change_orders.pending_impact || 0) > 0) {
    answer += `Approved change orders add Birr ${fmtMoney(summary.change_orders.approved_impact || 0)} and pending add Birr ${fmtMoney(summary.change_orders.pending_impact || 0)} to the contract value.\n`;
  }
  answer += 'You can refine this explanation by integrating a real LLM API.';
  res.json({ answer, summary });
});

app.post('/api/risk-suggest', (req, res) => {
  const { title, description } = req.body || {};
  const base = (title || '').toLowerCase() + ' ' + (description || '').toLowerCase();
  let probability = 3;
  let impact = 3;
  if (base.includes('weather') || base.includes('rain')) {
    probability = 4; impact = 3;
  }
  if (base.includes('concrete') || base.includes('foundation')) {
    probability = 3; impact = 4;
  }
  const mitigation = 'Clarify scope with stakeholders, include contingency in budget, and monitor this risk in weekly meetings.';
  res.json({
    probability,
    impact,
    mitigation_plan: mitigation,
  });
});

app.get('/api/report/:projectId', (req, res) => {
  const pid = req.params.projectId;
  const dash = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(b.original_budget) + SUM(b.approved_changes),0)
       FROM cbs_budgets b
       JOIN cbs_nodes n ON n.id = b.cbs_node_id
       WHERE n.project_id = ?) as total_budget,
      (SELECT COALESCE(SUM(b.actual_cost),0)
       FROM cbs_budgets b
       JOIN cbs_nodes n ON n.id = b.cbs_node_id
       WHERE n.project_id = ?) as actual_spend
  `).get(pid, pid);
  const evm = db.prepare(`
    SELECT * FROM evm_data WHERE project_id = ? ORDER BY report_date DESC LIMIT 1
  `).get(pid);
  const coStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'Approved' THEN cost_impact ELSE 0 END) as approved_impact,
      SUM(CASE WHEN status = 'Pending' THEN cost_impact ELSE 0 END) as pending_impact
    FROM change_orders WHERE project_id = ?
  `).get(pid);
  const cpi = evm?.cpi;
  const spi = evm?.spi;
  const eac = evm?.eac;
  const fmtMoney = v => (v == null || isNaN(Number(v))) ? '0' : Number(v).toLocaleString('en-US');
  let text = 'Executive summary for project ' + pid + ':\n\n';
  text += `Planned budget: Birr ${fmtMoney(dash?.total_budget || 0)}, actual spend to date: Birr ${fmtMoney(dash?.actual_spend || 0)}.\n`;
  if (eac != null) text += `Current estimate at completion (EAC) is Birr ${fmtMoney(eac)}.\n`;
  if (cpi != null) text += `CPI is ${cpi.toFixed(2)} (values below 1.00 indicate cost overrun).\n`;
  if (spi != null) text += `SPI is ${spi.toFixed(2)} (values below 1.00 indicate schedule delay).\n`;
  if (coStats) {
    text += `Approved change orders total Birr ${fmtMoney(coStats.approved_impact || 0)}, pending total Birr ${fmtMoney(coStats.pending_impact || 0)}.\n`;
  }
  res.json({ summary: text });
});

// --- Dashboard summary ---
app.get('/api/dashboard/:projectId', (req, res) => {
  const pid = req.params.projectId;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const cbs = db.prepare(`
    SELECT SUM(b.original_budget) as total_budget,
           SUM(b.approved_changes) as total_changes,
           SUM(b.actual_cost) as actual_spend,
           SUM(b.eac) as eac
    FROM cbs_budgets b
    JOIN cbs_nodes n ON n.id = b.cbs_node_id
    WHERE n.project_id = ?
  `).get(pid);

  const evm = db.prepare(`
    SELECT * FROM evm_data WHERE project_id = ? ORDER BY report_date DESC LIMIT 1
  `).get(pid);

  const coStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'Approved' THEN cost_impact ELSE 0 END) as approved_impact,
      SUM(CASE WHEN status = 'Pending' THEN cost_impact ELSE 0 END) as pending_impact
    FROM change_orders WHERE project_id = ?
  `).get(pid);

  const riskStats = db.prepare(`
    SELECT SUM(allocated_contingency) as allocated,
           SUM(used_contingency) as used
    FROM risks WHERE project_id = ?
  `).get(pid);

  const totalBudget = (cbs?.total_budget || 0) + (cbs?.total_changes || 0);

  // Align with classic EVM logic:
  // BAC: total budget, CPI: cost efficiency, EAC ≈ BAC / CPI, % Complete ≈ EV / BAC.
  const bac = evm?.bac || totalBudget;
  const cpi = evm?.cpi;
  const ev = evm?.ev || 0;
  const eacFromEvm = cpi ? bac / cpi : null;
  const eac = eacFromEvm != null ? eacFromEvm : (cbs?.eac || totalBudget);
  const pctComplete = bac > 0 ? (ev / bac) * 100 : 0;

  res.json({
    project,
    budget: { total: totalBudget, actual: cbs?.actual_spend || 0, eac },
    evm: evm || {},
    changeOrders: coStats || { approved_impact: 0, pending_impact: 0 },
    risk: riskStats || { allocated: 0, used: 0 },
    pctComplete: Math.min(100, pctComplete),
  });
});

// --- CBS ---
app.get('/api/cbs/:projectId', (req, res) => {
  const nodes = db.prepare(`
    SELECT n.*, cc.code as cost_code, cc.name as cost_code_name,
           b.original_budget, b.approved_changes, (b.original_budget + COALESCE(b.approved_changes, 0)) as current_budget,
           b.committed_cost, b.actual_cost, b.etc, b.eac,
           (b.original_budget + COALESCE(b.approved_changes, 0) - COALESCE(b.eac, 0)) as variance,
           CASE WHEN (b.original_budget + COALESCE(b.approved_changes, 0)) > 0 
                THEN ((b.original_budget + COALESCE(b.approved_changes, 0) - COALESCE(b.eac, 0)) / (b.original_budget + COALESCE(b.approved_changes, 0))) * 100 
                ELSE 0 END as variance_pct
    FROM cbs_nodes n
    LEFT JOIN cost_codes cc ON cc.id = n.cost_code_id
    LEFT JOIN cbs_budgets b ON b.cbs_node_id = n.id
    WHERE n.project_id = ?
    ORDER BY n.wbs_code
  `).all(req.params.projectId);
  res.json(nodes);
});

// --- EVM ---
app.get('/api/evm/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT *, (ev - pv) as sv, (ev - ac) as cv FROM evm_data
    WHERE project_id = ? ORDER BY report_date DESC
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/evm', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'report_date', 'bac']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['bac', 'pv', 'ev', 'ac']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const project_id = Number(body.project_id);
    const report_date = body.report_date;
    const bac = Number(body.bac);
    const pv = Number(body.pv || 0);
    const ev = Number(body.ev || 0);
    const ac = Number(body.ac || 0);

    const sv = ev - pv;
    const cv = ev - ac;
    const spi = pv ? ev / pv : null;
    const cpi = ac ? ev / ac : null;
    const eac = cpi ? bac / cpi : bac;
    const etc = eac - ac;
    const vac = bac - eac;
    const tcpi = (bac - ac) ? (bac - ev) / (bac - ac) : null;

    const result = db.prepare(`
      INSERT INTO evm_data (project_id, report_date, bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(project_id, report_date, bac, pv, ev, ac, spi, cpi, eac, etc, vac, tcpi);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// --- Change Orders ---
app.get('/api/change-orders/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT co.*, n.wbs_code, n.name as cbs_name FROM change_orders co
    LEFT JOIN cbs_nodes n ON n.id = co.cbs_node_id
    WHERE co.project_id = ? ORDER BY co.created_at DESC
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/change-orders', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'co_number', 'description']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['cost_impact', 'schedule_impact_days']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, cbs_node_id, co_number, description, status, cost_impact, schedule_impact_days, priority } = body;
    const result = db.prepare(`
      INSERT INTO change_orders (project_id, cbs_node_id, co_number, description, status, cost_impact, schedule_impact_days, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      cbs_node_id || null,
      co_number,
      description,
      status || 'Pending',
      cost_impact || 0,
      schedule_impact_days || 0,
      priority || 'Medium'
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/change-orders/:id', (req, res) => {
  const { status, approved_by } = req.body;
  db.prepare('UPDATE change_orders SET status = ?, approved_by = ?, approved_date = date("now") WHERE id = ?').run(status, approved_by || null, req.params.id);
  res.json({ ok: true });
});

// --- Risks ---
app.get('/api/risks/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT *, (probability * impact) as risk_score,
           (allocated_contingency - used_contingency) as remaining_contingency
    FROM risks WHERE project_id = ? ORDER BY (probability * impact) DESC
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/risks', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'title', 'probability', 'impact']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['probability', 'impact', 'allocated_contingency']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, title, description, probability, impact, allocated_contingency, risk_owner, mitigation_plan } = body;
    const result = db.prepare(`
      INSERT INTO risks (project_id, title, description, probability, impact, allocated_contingency, risk_owner, mitigation_plan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      title,
      description || '',
      probability,
      impact,
      allocated_contingency || 0,
      risk_owner || null,
      mitigation_plan || null
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// --- Cost Codes ---
app.get('/api/cost-codes', (_, res) => {
  const rows = db.prepare('SELECT * FROM cost_codes ORDER BY code').all();
  res.json(rows);
});

// --- Cost Items (Labor, Materials, Equipment) ---
app.get('/api/cost-items/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT ci.*, n.wbs_code, n.name as cbs_name FROM cost_items ci
    LEFT JOIN cbs_nodes n ON n.id = ci.cbs_node_id
    WHERE ci.project_id = ? ORDER BY ci.category, ci.id
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/cost-items', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'category', 'description']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['budget_hours', 'budget_rate', 'budget_amount', 'actual_hours', 'actual_amount']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, cbs_node_id, category, description, budget_hours, budget_rate, budget_amount, actual_hours, actual_amount } = body;
    const result = db.prepare(`
      INSERT INTO cost_items (project_id, cbs_node_id, category, description, budget_hours, budget_rate, budget_amount, actual_hours, actual_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      cbs_node_id || null,
      category,
      description || '',
      budget_hours || null,
      budget_rate || null,
      budget_amount || null,
      actual_hours || 0,
      actual_amount || 0
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// --- Subcontractors ---
app.get('/api/subcontractors/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, v.name as vendor_name, n.wbs_code FROM subcontractors s
    LEFT JOIN vendors v ON v.id = s.vendor_id
    LEFT JOIN cbs_nodes n ON n.id = s.cbs_node_id
    WHERE s.project_id = ? ORDER BY s.id
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/subcontractors', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'vendor_id', 'original_contract']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['original_contract', 'change_orders_total']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, vendor_id, cbs_node_id, original_contract, change_orders_total } = body;
    const rev = (original_contract || 0) + (change_orders_total || 0);
    const result = db.prepare(`
      INSERT INTO subcontractors (project_id, vendor_id, cbs_node_id, original_contract, change_orders_total, revised_contract)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(project_id, vendor_id, cbs_node_id || null, original_contract || 0, change_orders_total || 0, rev);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// --- Vendors & Bids ---
app.get('/api/vendors', (_, res) => {
  const rows = db.prepare('SELECT * FROM vendors').all();
  res.json(rows);
});

app.post('/api/vendors', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['name']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const { name, contact_person, email, phone, payment_terms } = body;
    const result = db.prepare(`
      INSERT INTO vendors (name, contact_person, email, phone, payment_terms)
      VALUES (?, ?, ?, ?, ?)
    `).run(name || '', contact_person || null, email || null, phone || null, payment_terms || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

app.post('/api/procurement', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'package_name']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['lead_time_days']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, package_name, description, lead_time_days } = body;
    const result = db.prepare(`
      INSERT INTO procurement_packages (project_id, package_name, description, lead_time_days)
      VALUES (?, ?, ?, ?)
    `).run(project_id, package_name || '', description || null, lead_time_days || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

app.post('/api/vendor-bids', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['package_id', 'vendor_id', 'bid_amount']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['bid_amount', 'lead_time_days', 'score']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { package_id, vendor_id, bid_amount, lead_time_days, score } = body;
    const result = db.prepare(`
      INSERT INTO vendor_bids (package_id, vendor_id, bid_amount, lead_time_days, score)
      VALUES (?, ?, ?, ?, ?)
    `).run(package_id, vendor_id, bid_amount, lead_time_days || null, score || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

app.get('/api/procurement/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, v.name as vendor_name, vb.bid_amount, vb.lead_time_days, vb.score, vb.is_awarded
    FROM procurement_packages p
    LEFT JOIN vendor_bids vb ON vb.package_id = p.id
    LEFT JOIN vendors v ON v.id = vb.vendor_id
    WHERE p.project_id = ?
  `).all(req.params.projectId);
  res.json(rows);
});

// --- Cash Flow ---
app.get('/api/cash-flow/:projectId', (req, res) => {
  const rows = db.prepare(`
    SELECT *, (actual_spend - planned_spend) as variance FROM cash_flow
    WHERE project_id = ? ORDER BY period_date
  `).all(req.params.projectId);
  res.json(rows);
});

app.post('/api/cash-flow', (req, res, next) => {
  try {
    const body = req.body || {};
    const missing = requireFields(body, ['project_id', 'period_date']);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    const numInvalid = validateNumberFields(body, ['planned_spend', 'actual_spend']);
    if (numInvalid.length) {
      return res.status(400).json({ error: 'Invalid numeric fields', fields: numInvalid });
    }
    const { project_id, period_date } = body;
    const planned_spend = body.planned_spend || 0;
    const actual_spend = body.actual_spend || 0;
    const existing = db.prepare('SELECT id FROM cash_flow WHERE project_id = ? AND period_date = ?').get(project_id, period_date);
    if (existing) {
      db.prepare('UPDATE cash_flow SET planned_spend = ?, actual_spend = ? WHERE id = ?')
        .run(planned_spend || 0, actual_spend || 0, existing.id);
      return res.json({ id: existing.id });
    }
    const result = db.prepare(`
      INSERT INTO cash_flow (project_id, period_date, planned_spend, actual_spend, cumulative_planned, cumulative_actual)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const prev = db.prepare('SELECT MAX(cumulative_planned) as cp, MAX(cumulative_actual) as ca FROM cash_flow WHERE project_id = ?').get(project_id);
    const cumP = (prev?.cp || 0) + (planned_spend || 0);
    const cumA = (prev?.ca || 0) + (actual_spend || 0);
    result.run(project_id, period_date, planned_spend || 0, actual_spend || 0, cumP, cumA);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Excel/CSV Export (opens in Excel) ---
app.get('/api/export/:projectId/:module', (req, res) => {
  const { projectId, module } = req.params;
  let rows = [], filename = 'export';

  switch (module) {
    case 'cbs':
      rows = db.prepare(`
        SELECT n.wbs_code as WBS, n.name as Name, b.original_budget as "Original Budget",
               b.approved_changes as "Approved Changes",
               (b.original_budget + COALESCE(b.approved_changes,0)) as "Current Budget",
               b.actual_cost as Actual, b.etc as ETC, b.eac as EAC
        FROM cbs_nodes n
        LEFT JOIN cbs_budgets b ON b.cbs_node_id = n.id
        WHERE n.project_id = ?
      `).all(projectId);
      filename = 'cbs';
      break;
    case 'evm':
    case 'change-orders':
    case 'risks':
    case 'cash-flow':
    case 'cost-items':
    case 'subcontractors':
      const tables = { evm: 'evm_data', 'change-orders': 'change_orders', risks: 'risks', 'cash-flow': 'cash_flow', 'cost-items': 'cost_items', subcontractors: 'subcontractors' };
      rows = db.prepare(`SELECT * FROM ${tables[module]} WHERE project_id = ? ORDER BY 1`).all(projectId);
      filename = module;
      break;
    default:
      return res.status(400).json({ error: 'Unknown module' });
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(r =>
    headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
  )].join('\n');

  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// --- Central error handler ---
// Must be added after all routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Ensure numeric port. process.env.PORT is a string, and "port + 1" becomes string concatenation.
const PORT = Number.parseInt(process.env.PORT, 10);
const SERVER_PORT = Number.isFinite(PORT) ? PORT : 3000;

function startServer(port, attempt = 0) {
  if (attempt > 20) {
    console.error('Unable to find a free port after many attempts.');
    process.exitCode = 1;
    return;
  }
  const server = app.listen(port, () => console.log(`PMSS API running at http://localhost:${port}`));
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, attempt + 1);
    } else {
      console.error('Server failed to start:', err);
      process.exitCode = 1;
    }
  });
}
startServer(SERVER_PORT);
