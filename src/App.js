const API = '/api';
let currentProjectId = null;
let currentCurrency = 'ETB';
let useLocalStore = false;
const LOCAL_KEY = 'pmss-local-data-v1';

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      const base = {
        nextIds: { project: 1, evm: 1, co: 1, risk: 1, cf: 1, ci: 1, sub: 1, vendor: 1, pkg: 1 },
        projects: [],
        cbs: {},
        evm: {},
        changeOrders: {},
        risks: {},
        cashFlow: {},
        costItems: {},
        subcontractors: {},
        vendors: [],
        procurement: {},
        costCodes: [
          { code: '01 00 00', name: 'General Requirements', category: 'Overhead' },
          { code: '03 30 00', name: 'Cast-in-Place Concrete', category: 'Structure' },
          { code: '04 20 00', name: 'Unit Masonry', category: 'Structure' },
          { code: '05 50 00', name: 'Metal Fabrications', category: 'Structure' },
          { code: '06 10 00', name: 'Rough Carpentry', category: 'Architectural' },
          { code: '09 90 00', name: 'Painting and Coating', category: 'Finishes' },
        ],
      };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(base));
      return base;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load local store, resetting', e);
    localStorage.removeItem(LOCAL_KEY);
    return loadLocalData();
  }
}

function saveLocalData(db) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
}

async function localApi(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  const parts = path.split('/').filter(Boolean);
  const db = loadLocalData();

  const num = v => (v == null || isNaN(+v) ? 0 : +v);

  if (!parts.length) return {};
  const root = parts[0];

  // --- Projects & init ---
  if (root === 'projects') {
    if (method === 'GET') return db.projects;
    if (method === 'POST') {
      const p = {
        id: db.nextIds.project++,
        name: body.name || 'New Project',
        description: body.description || '',
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        currency: body.currency || 'ETB',
      };
      db.projects.push(p);
      saveLocalData(db);
      return p;
    }
  }

  if (root === 'init' && method === 'POST') {
    // Simple demo data
    const proj = {
      id: 1,
      name: 'Sample Tower Project',
      description: 'Demo data for PMSS',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      currency: 'ETB',
    };
    const data = {
      nextIds: { project: 2, evm: 2, co: 2, risk: 2, cf: 2, ci: 2, sub: 2, vendor: 2, pkg: 2 },
      projects: [proj],
      cbs: {
        1: [
          { wbs_code: '01', name: 'Sitework', original_budget: 150000, approved_changes: 10000, current_budget: 160000, actual_cost: 80000, etc: 80000, eac: 160000, variance: 0 },
          { wbs_code: '02', name: 'Structure', original_budget: 500000, approved_changes: 25000, current_budget: 525000, actual_cost: 260000, etc: 265000, eac: 525000, variance: 0 },
        ],
      },
      evm: {
        1: [
          {
            id: 1,
            report_date: '2025-03-31',
            bac: 685000,
            pv: 200000,
            ev: 190000,
            ac: 195000,
            sv: -10000,
            cv: -5000,
            spi: 0.95,
            cpi: 0.97,
            eac: 706186,
            vac: -21186,
          },
        ],
      },
      changeOrders: {
        1: [
          { id: 1, project_id: 1, co_number: 'CO-001', description: 'Foundation redesign', cost_impact: 20000, schedule_impact_days: 7, priority: 'High', status: 'Pending' },
        ],
      },
      risks: {
        1: [
          { id: 1, project_id: 1, title: 'Material price escalation', description: '', probability: 3, impact: 4, allocated_contingency: 30000, used_contingency: 0, remaining_contingency: 30000, risk_owner: 'PM', status: 'Open' },
        ],
      },
      cashFlow: {
        1: [
          { id: 1, project_id: 1, period_date: '2025-03-01', planned_spend: 100000, actual_spend: 95000, variance: -5000, cumulative_planned: 250000, cumulative_actual: 240000 },
        ],
      },
      costItems: { 1: [] },
      subcontractors: { 1: [] },
      vendors: [
        { id: 1, name: 'Acme Concrete', contact_person: 'John Doe', email: '', phone: '', payment_terms: 'Net 30' },
      ],
      procurement: {
        1: [
          { id: 1, project_id: 1, package_name: 'Structural Concrete', description: '', lead_time_days: 30, vendor_name: 'Acme Concrete', bid_amount: 480000, score: 90 },
        ],
      },
      costCodes: db.costCodes || [],
    };
    saveLocalData(data);
    return { ok: true };
  }

  // --- Dashboard ---
  if (root === 'dashboard' && parts[1]) {
    const pid = parts[1];
    const cbsRows = db.cbs[pid] || [];
    const coRows = db.changeOrders[pid] || [];
    const evmRows = db.evm[pid] || [];
    const totalBudget = cbsRows.reduce((s, r) => s + num(r.current_budget || r.original_budget), 0);
    const totalActual = cbsRows.reduce((s, r) => s + num(r.actual_cost), 0);
    const approvedImpact = coRows.filter(r => r.status === 'Approved').reduce((s, r) => s + num(r.cost_impact), 0);
    const pendingImpact = coRows.filter(r => r.status !== 'Approved').reduce((s, r) => s + num(r.cost_impact), 0);
    const latestEvm = evmRows[0] || {};
    const bac = latestEvm.bac || totalBudget;
    const cpi = latestEvm.cpi;
    const ev = latestEvm.ev || 0;
    const eacFromEvm = cpi ? bac / cpi : null;
    const eac = eacFromEvm != null ? eacFromEvm : (latestEvm.eac || totalBudget);
    const pctComplete = bac ? Math.round((ev / bac) * 100) : 0;
    return {
      budget: { total: totalBudget, actual: totalActual, eac },
      pctComplete,
      evm: { cpi: latestEvm.cpi, spi: latestEvm.spi },
      changeOrders: { approved_impact: approvedImpact, pending_impact: pendingImpact },
    };
  }

  // --- Simple per-project collections ---
  const projectCollections = {
    cbs: 'cbs',
    evm: 'evm',
    'change-orders': 'changeOrders',
    risks: 'risks',
    'cash-flow': 'cashFlow',
    'cost-items': 'costItems',
    subcontractors: 'subcontractors',
    procurement: 'procurement',
  };

  if (root in projectCollections) {
    const key = projectCollections[root];

    // GET /root/:projectId
    if (method === 'GET' && parts[1]) {
      const pid = parts[1];
      return (db[key][pid] || []).slice().sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    // POST /root
    if (method === 'POST') {
      const pid = String(body.project_id || parts[1] || currentProjectId || 1);
      if (!db[key][pid]) db[key][pid] = [];

      if (root === 'evm') {
        const id = db.nextIds.evm++;
        const row = {
          id,
          project_id: +pid,
          report_date: body.report_date,
          bac: num(body.bac),
          pv: num(body.pv),
          ev: num(body.ev),
          ac: num(body.ac),
        };
        // derive metrics
        row.sv = row.ev - row.pv;
        row.cv = row.ev - row.ac;
        row.spi = row.pv ? row.ev / row.pv : null;
        row.cpi = row.ac ? row.ev / row.ac : null;
        row.eac = row.cpi ? row.bac / row.cpi : row.bac;
        row.vac = row.bac - row.eac;
        db[key][pid].unshift(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'change-orders') {
        const id = db.nextIds.co++;
        const row = {
          id,
          project_id: +pid,
          co_number: body.co_number,
          description: body.description,
          cost_impact: num(body.cost_impact),
          schedule_impact_days: num(body.schedule_impact_days),
          priority: body.priority || 'Medium',
          status: body.status || 'Pending',
        };
        db[key][pid].unshift(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'risks') {
        const id = db.nextIds.risk++;
        const row = {
          id,
          project_id: +pid,
          title: body.title,
          description: body.description,
          probability: num(body.probability) || 1,
          impact: num(body.impact) || 1,
          allocated_contingency: num(body.allocated_contingency),
          used_contingency: 0,
          remaining_contingency: num(body.allocated_contingency),
          risk_owner: body.risk_owner || '',
          mitigation_plan: body.mitigation_plan || '',
          status: 'Open',
        };
        row.risk_score = row.probability * row.impact;
        db[key][pid].unshift(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'cash-flow') {
        const id = db.nextIds.cf++;
        const existing = db[key][pid].slice().sort((a, b) => (a.period_date || '').localeCompare(b.period_date || ''));
        const row = {
          id,
          project_id: +pid,
          period_date: body.period_date,
          planned_spend: num(body.planned_spend),
          actual_spend: num(body.actual_spend),
        };
        row.variance = row.actual_spend - row.planned_spend;
        const prev = existing[existing.length - 1] || { cumulative_planned: 0, cumulative_actual: 0 };
        row.cumulative_planned = prev.cumulative_planned + row.planned_spend;
        row.cumulative_actual = prev.cumulative_actual + row.actual_spend;
        db[key][pid].push(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'cost-items') {
        const id = db.nextIds.ci++;
        const row = {
          id,
          project_id: +pid,
          category: body.category,
          description: body.description,
          budget_hours: body.budget_hours != null ? +body.budget_hours : null,
          budget_rate: body.budget_rate != null ? +body.budget_rate : null,
          budget_amount: body.budget_amount != null ? +body.budget_amount : null,
          actual_hours: num(body.actual_hours),
          actual_amount: num(body.actual_amount),
        };
        db[key][pid].push(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'subcontractors') {
        const id = db.nextIds.sub++;
        const row = {
          id,
          project_id: +pid,
          vendor_id: body.vendor_id,
          original_contract: num(body.original_contract),
          change_orders_total: num(body.change_orders_total),
        };
        const vendor = db.vendors.find(v => v.id == body.vendor_id);
        row.vendor_name = vendor ? vendor.name : 'Vendor';
        row.revised_contract = row.original_contract + row.change_orders_total;
        row.invoiced_to_date = 0;
        row.retention_held = 0;
        row.percent_complete = 0;
        row.status = 'Active';
        db[key][pid].push(row);
        saveLocalData(db);
        return row;
      }

      if (root === 'procurement') {
        const id = db.nextIds.pkg++;
        if (!db[key][pid]) db[key][pid] = [];
        const row = {
          id,
          project_id: +pid,
          package_name: body.package_name,
          description: body.description,
          lead_time_days: body.lead_time_days != null ? +body.lead_time_days : null,
        };
        db[key][pid].push(row);
        saveLocalData(db);
        return row;
      }
    }

    // PATCH /change-orders/:id (approve)
    if (root === 'change-orders' && method === 'PATCH' && parts[1]) {
      const id = +parts[1];
      Object.keys(db.changeOrders).forEach(pid => {
        const list = db.changeOrders[pid];
        const row = list.find(r => r.id === id);
        if (row) {
          row.status = body.status || row.status;
        }
      });
      saveLocalData(db);
      return { ok: true };
    }
  }

  // --- Vendors (not project-scoped) ---
  if (root === 'vendors') {
    if (method === 'GET') return db.vendors;
    if (method === 'POST') {
      const id = db.nextIds.vendor++;
      const row = {
        id,
        name: body.name,
        contact_person: body.contact_person,
        email: body.email,
        phone: body.phone,
        payment_terms: body.payment_terms,
      };
      db.vendors.push(row);
      saveLocalData(db);
      return row;
    }
  }

  // --- Cost codes ---
  if (root === 'cost-codes' && method === 'GET') {
    return db.costCodes || [];
  }

  return {};
}

const $ = id => document.getElementById(id);
function fmt(n) {
  if (n == null || isNaN(+n)) return '—';
  const rounded = Math.round(+n);
  // Use a simple, consistent Birr label to avoid platform Intl differences.
  return 'Birr ' + rounded.toLocaleString('en-US');
}

function setCurrencyFromProjects(projects, projectId) {
  if (!projects || !projects.length || !projectId) return;
  const p = projects.find(x => String(x.id) === String(projectId));
  // Always display as Birr per your request (even if existing DB currency is legacy).
  currentCurrency = (p && p.currency) ? p.currency : 'ETB';
}

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:1rem;right:1rem;padding:0.75rem 1.25rem;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;z-index:1000;animation:fadeIn 0.2s';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// --- Navigation ---
function attachNav() {
  const nav = document.querySelector('.nav');
  if (nav) {
    nav.addEventListener('click', e => {
      const btn = e.target.closest('.nav-btn');
      if (!btn) return;
      const viewId = 'view-' + (btn.dataset.view || '');
      const viewEl = $(viewId);
      if (!viewEl) return;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      viewEl.classList.add('active');
      loadView(btn.dataset.view || 'dashboard');
    });
  }
  const projectSel = $('projectSelect');
  if (projectSel) {
    projectSel.addEventListener('change', e => {
      const v = e.target.value;
      currentProjectId = v ? +v : null;
      // Update currency based on selected project (server or local)
      const options = Array.from(projectSel.options || []);
      const selectedId = options.length ? projectSel.value : null;
      // Re-fetch the projects list (cheap) to keep currency consistent
      (async () => {
        try {
          const projects = await api('/projects');
          const list = Array.isArray(projects) ? projects : (projects && Array.isArray(projects.projects) ? projects.projects : []);
          setCurrencyFromProjects(list, selectedId);
        } catch (_) {
          // ignore
        }
        loadView(document.querySelector('.nav-btn.active') && document.querySelector('.nav-btn.active').dataset ? document.querySelector('.nav-btn.active').dataset.view : 'dashboard');
      })();
    });
  }
}

async function init() {
  // Wire up navigation and modals FIRST so clicks/typing work immediately
  attachNav();
  setupModals();

  let serverReachable = false;
  try {
    const res = await fetch(API + '/projects');
    if (!res.ok) throw new Error('Server not available');
    serverReachable = true;
    const data = await res.json();
    const projects = Array.isArray(data) ? data : (data.projects || []);
    const sel = $('projectSelect');
    if (sel) {
      sel.innerHTML = projects.length
        ? projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        : '<option value="">No projects</option>';
      currentProjectId = projects.length ? projects[0].id : null;
      if (projects.length) sel.value = String(currentProjectId);
    }
    setCurrencyFromProjects(projects, currentProjectId);
    updateDashboardEmptyState(projects.length, serverReachable);
  } catch (err) {
    console.warn('Server not reachable, using local storage', err);
    useLocalStore = true;
    const projects = await localApi('/projects');
    const sel = $('projectSelect');
    if (sel) {
      sel.innerHTML = projects.length
        ? projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        : '<option value="">No projects</option>';
      currentProjectId = projects.length ? projects[0].id : null;
      if (projects.length) sel.value = String(currentProjectId);
    }
    setCurrencyFromProjects(projects, currentProjectId);
    updateDashboardEmptyState(projects.length, false);
  }
  loadView('dashboard');
}

function updateDashboardEmptyState(hasProjects, serverOk) {
  const emptyEl = $('dashboard-empty');
  const contentEl = $('dashboard-content');
  const msgEl = $('dashboard-server-msg');
  if (!emptyEl || !contentEl) return;
  if (hasProjects) {
    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'flex';
    contentEl.style.display = 'none';
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.textContent = serverOk
        ? ''
        : 'Using local storage. Click "Load Sample Data" or "Create New Project" to get started.';
    }
  }
}

async function refreshProjects() {
  let list = [];
  try {
    const projects = await api('/projects');
    if (Array.isArray(projects)) {
      list = projects;
    } else if (projects && Array.isArray(projects.projects)) {
      list = projects.projects;
    } else {
      list = [];
    }
  } catch (_) {
    list = [];
  }
  const sel = $('projectSelect');
  if (sel) {
    sel.innerHTML = list.length
      ? list.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
      : '<option value="">No projects</option>';
    if (list.length) {
      currentProjectId = list[list.length - 1].id;
      sel.value = String(currentProjectId);
    }
  }
  setCurrencyFromProjects(list, currentProjectId);
  updateDashboardEmptyState(list.length, true);
  return list;
}

function loadView(view) {
  const loaders = {
    dashboard: loadDashboard,
    cbs: loadCBS,
    evm: loadEVM,
    'change-orders': loadChangeOrders,
    risks: loadRisks,
    'cost-items': loadCostItems,
    subcontractors: loadSubcontractors,
    vendors: loadVendors,
    cashflow: loadCashFlow,
    'cost-codes': loadCostCodes,
  };
  const fn = loaders[view];
  if (fn) fn();
}

function needProject() {
  if (!currentProjectId) {
    toast('Select a project first', 'warning');
    return false;
  }
  return true;
}

async function api(path, opts = {}) {
  if (useLocalStore) {
    return localApi(path, opts);
  }
  try {
    const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error(res.statusText || 'Request failed');
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.warn('API call failed, switching to local store', err);
    useLocalStore = true;
    return localApi(path, opts);
  }
}

// --- Dashboard ---
async function loadDashboard() {
    const dashBudget = $('dash-budget'), chartBudget = $('chart-budget'), chartCO = $('chart-co');
  if (!dashBudget) return;
  if (!currentProjectId) {
    ['dash-budget','dash-actual','dash-eac','dash-pct','dash-cpi','dash-spi'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
    if (chartBudget) chartBudget.innerHTML = '<p class="text-muted">No project selected. Click "+ Project" to create one.</p>';
    if (chartCO) chartCO.innerHTML = '';
    return;
  }
  try {
    const d = await api('/dashboard/' + currentProjectId);
    const b = d && d.budget ? d.budget : {};
    const pct = (d && typeof d.pctComplete === 'number') ? d.pctComplete : 0;
    const pctText = (Math.round(pct * 10) / 10).toString();
    $('dash-budget').textContent = fmt(typeof b.total === 'number' ? b.total : 0);
    $('dash-actual').textContent = fmt(typeof b.actual === 'number' ? b.actual : 0);
    $('dash-eac').textContent = fmt(typeof b.eac === 'number' ? b.eac : 0);
    $('dash-pct').textContent = (pctText + '%');
    const evm = d.evm || {};
    $('dash-cpi').textContent = evm.cpi != null ? evm.cpi.toFixed(2) : '—';
    $('dash-spi').textContent = evm.spi != null ? evm.spi.toFixed(2) : '—';

    const cbs = await api('/cbs/' + currentProjectId);
    const total = cbs.reduce((s, r) => s + (r.current_budget || 0), 0);
    if (chartBudget) {
      chartBudget.innerHTML = cbs.filter(r => r.current_budget > 0).slice(0, 6).map(r => {
        const pct = total ? (r.current_budget / total * 100) : 0;
        return `<div class="chart-bar"><span>${(r.wbs_code || '')} ${(r.name || '')}</span><div class="chart-bar-fill" style="width:${pct}%;background:var(--accent)"></div><span>${pct.toFixed(0)}%</span></div>`;
      }).join('') || '<p class="text-muted">No budget data</p>';
    }
    const co = d.changeOrders || {};
    const tot = (co.approved_impact || 0) + (co.pending_impact || 0);
    if (chartCO) {
      chartCO.innerHTML = `
        <div class="chart-bar"><span>Approved</span><div class="chart-bar-fill" style="width:${tot ? (co.approved_impact || 0) / tot * 100 : 0}%;background:var(--success)"></div><span>${fmt(co.approved_impact)}</span></div>
        <div class="chart-bar"><span>Pending</span><div class="chart-bar-fill" style="width:${tot ? (co.pending_impact || 0) / tot * 100 : 0}%;background:var(--warning)"></div><span>${fmt(co.pending_impact)}</span></div>
      `;
    }
  } catch (e) {
    toast('Failed to load dashboard', 'danger');
    console.error(e);
  }
}

async function loadCBS() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/cbs/' + currentProjectId);
    const tbody = document.querySelector('#cbs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.wbs_code || ''}</td>
        <td>${r.name || ''}</td>
        <td class="num">${fmt(r.original_budget)}</td>
        <td class="num">${fmt(r.approved_changes)}</td>
        <td class="num">${fmt(r.current_budget)}</td>
        <td class="num">${fmt(r.actual_cost)}</td>
        <td class="num">${fmt(r.etc)}</td>
        <td class="num">${fmt(r.eac)}</td>
        <td class="num ${(r.variance || 0) < 0 ? 'negative' : 'positive'}">${fmt(r.variance)}</td>
      </tr>
    `).join('');
  } catch (e) {
    toast('Failed to load CBS', 'danger');
  }
}

async function loadEVM() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/evm/' + currentProjectId);
    const latest = rows[0];
    const evmGrid = $('evm-cards');
    const tbody = document.querySelector('#evm-table tbody');
    if (!evmGrid || !tbody) return;
    if (latest) {
      evmGrid.innerHTML = `
        <div class="evm-card"><div class="label">BAC</div><div class="value">${fmt(latest.bac)}</div></div>
        <div class="evm-card"><div class="label">PV</div><div class="value">${fmt(latest.pv)}</div></div>
        <div class="evm-card"><div class="label">EV</div><div class="value">${fmt(latest.ev)}</div></div>
        <div class="evm-card"><div class="label">AC</div><div class="value">${fmt(latest.ac)}</div></div>
        <div class="evm-card"><div class="label">SPI</div><div class="value ${(latest.spi || 0) >= 1 ? 'positive' : 'negative'}">${latest.spi != null ? latest.spi.toFixed(2) : '—'}</div></div>
        <div class="evm-card"><div class="label">CPI</div><div class="value ${(latest.cpi || 0) >= 1 ? 'positive' : 'negative'}">${latest.cpi != null ? latest.cpi.toFixed(2) : '—'}</div></div>
        <div class="evm-card"><div class="label">EAC</div><div class="value">${fmt(latest.eac)}</div></div>
        <div class="evm-card"><div class="label">VAC</div><div class="value ${(latest.vac || 0) >= 0 ? 'positive' : 'negative'}">${fmt(latest.vac)}</div></div>
      `;
    } else evmGrid.innerHTML = '<p>No EVM data. Add an entry to get started.</p>';
    tbody.innerHTML = rows.map(r => {
      const sv = typeof r.sv === 'number' ? r.sv : (r.ev - r.pv);
      const cv = typeof r.cv === 'number' ? r.cv : (r.ev - r.ac);
      return `<tr>
        <td>${r.report_date || ''}</td>
        <td class="num">${fmt(r.bac)}</td>
        <td class="num">${fmt(r.pv)}</td>
        <td class="num">${fmt(r.ev)}</td>
        <td class="num">${fmt(r.ac)}</td>
        <td class="num ${(sv || 0) >= 0 ? 'positive' : 'negative'}">${fmt(sv)}</td>
        <td class="num ${(cv || 0) >= 0 ? 'positive' : 'negative'}">${fmt(cv)}</td>
        <td class="num">${r.spi != null ? r.spi.toFixed(2) : '—'}</td>
        <td class="num">${r.cpi != null ? r.cpi.toFixed(2) : '—'}</td>
        <td class="num">${fmt(r.eac)}</td>
        <td class="num">${fmt(r.vac)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    toast('Failed to load EVM', 'danger');
  }
}

async function loadChangeOrders() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/change-orders/' + currentProjectId);
    const tbody = document.querySelector('#co-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.co_number || ''}</td>
        <td>${r.description || ''}</td>
        <td><span class="badge badge-${(r.status || '').toLowerCase()}">${r.status || ''}</span></td>
        <td class="num">${fmt(r.cost_impact)}</td>
        <td>${r.schedule_impact_days || 0} days</td>
        <td>
          ${r.status === 'Pending' ? `<button class="btn-secondary btn-sm" data-approve-co="${r.id}">Approve</button>` : ''}
        </td>
      </tr>
    `).join('');
    const viewEl = tbody.closest('.view');
    const approveButtons = viewEl ? viewEl.querySelectorAll('[data-approve-co]') : [];
    approveButtons.forEach(btn => {
      btn.onclick = async () => {
        try {
          await api('/change-orders/' + btn.dataset.approveCo, { method: 'PATCH', body: JSON.stringify({ status: 'Approved' }) });
          toast('Change order approved');
          loadChangeOrders();
          loadDashboard();
        } catch (e) {
          toast('Failed to approve', 'danger');
        }
      };
    });
  } catch (e) {
    toast('Failed to load change orders', 'danger');
  }
}

async function loadRisks() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/risks/' + currentProjectId);
    const tbody = document.querySelector('#risk-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => {
      const score = (typeof r.risk_score === 'number') ? r.risk_score : (r.probability * r.impact);
      const remaining = (typeof r.remaining_contingency === 'number')
        ? r.remaining_contingency
        : (r.allocated_contingency - r.used_contingency);
      return `
      <tr>
        <td>${r.title || ''}</td>
        <td>${score}</td>
        <td class="num">${fmt(r.allocated_contingency)}</td>
        <td class="num">${fmt(r.used_contingency)}</td>
        <td class="num">${fmt(remaining)}</td>
        <td>${r.risk_owner || '—'}</td>
        <td>${r.status || ''}</td>
      </tr>
    `;
    }).join('');
  } catch (e) {
    toast('Failed to load risks', 'danger');
  }
}

async function loadCostItems() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/cost-items/' + currentProjectId);
    const tbody = document.querySelector('#cost-items-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => {
      const hasBudgetAmount = typeof r.budget_amount === 'number';
      const calcBudget = r.budget_hours && r.budget_rate ? r.budget_hours * r.budget_rate : null;
      const budget = hasBudgetAmount ? r.budget_amount : calcBudget;
      const baseForVariance = (typeof budget === 'number') ? budget : (typeof r.actual_amount === 'number' ? r.actual_amount : null);
      const variance = baseForVariance != null ? (r.actual_amount || 0) - baseForVariance : null;
      return `<tr>
        <td>${r.category || ''}</td>
        <td>${r.description || '—'}</td>
        <td class="num">${typeof r.budget_hours === 'number' ? r.budget_hours : '—'}</td>
        <td class="num">${r.budget_rate != null ? fmt(r.budget_rate) : '—'}</td>
        <td class="num">${fmt(budget)}</td>
        <td class="num">${typeof r.actual_hours === 'number' ? r.actual_hours : '—'}</td>
        <td class="num">${fmt(r.actual_amount)}</td>
        <td class="num ${(variance || 0) < 0 ? 'negative' : 'positive'}">${fmt(variance)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    toast('Failed to load cost items', 'danger');
  }
}

async function loadSubcontractors() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/subcontractors/' + currentProjectId);
    const tbody = document.querySelector('#sub-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.vendor_name || '—'}</td>
        <td class="num">${fmt(r.original_contract)}</td>
        <td class="num">${fmt(r.change_orders_total)}</td>
        <td class="num">${fmt(r.revised_contract)}</td>
        <td class="num">${fmt(r.invoiced_to_date)}</td>
        <td class="num">${fmt(r.retention_held)}</td>
        <td class="num">${r.percent_complete != null ? r.percent_complete + '%' : '—'}</td>
        <td>${r.status || 'Active'}</td>
      </tr>
    `).join('');
  } catch (e) {
    toast('Failed to load subcontractors', 'danger');
  }
}

async function loadVendors() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/procurement/' + currentProjectId);
    const byPkg = {};
    rows.forEach(r => {
      if (!byPkg[r.id]) byPkg[r.id] = { name: r.package_name, bids: [] };
      if (r.vendor_name) byPkg[r.id].bids.push({ vendor: r.vendor_name, amount: r.bid_amount, score: r.score });
    });
    const container = $('vendor-packages');
    if (!container) return;
    const lowest = arr => arr.length ? Math.min(...arr.map(b => b.amount)) : 0;
    container.innerHTML = Object.values(byPkg).map(pkg => {
      const low = lowest(pkg.bids);
      return `
        <div class="vendor-package">
          <h4>${pkg.name || ''}</h4>
          ${pkg.bids.map(b => `
            <div class="vendor-bid ${b.amount === low ? 'lowest' : ''}">
              <strong>${b.vendor || ''}</strong>
              <span class="num">${fmt(b.amount)}</span>
              ${b.amount === low ? '<span class="badge badge-approved">Lowest</span>' : ''}
            </div>
          `).join('')}
          ${!pkg.bids.length ? '<p class="text-muted">No bids yet</p>' : ''}
        </div>
      `;
    }).join('') || '<p>No procurement packages. Add one to compare vendor bids.</p>';
  } catch (e) {
    toast('Failed to load vendor bids', 'danger');
  }
}

async function loadCostCodes() {
  try {
    const rows = await api('/cost-codes');
    const tbody = document.querySelector('#cost-codes-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => `<tr><td>${r.code || ''}</td><td>${r.name || ''}</td><td>${r.category || ''}</td></tr>`).join('');
  } catch (e) {
    toast('Failed to load cost codes', 'danger');
  }
}

async function loadCashFlow() {
  if (!currentProjectId) return;
  try {
    const rows = await api('/cash-flow/' + currentProjectId);
    const tbody = document.querySelector('#cf-table tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => {
      const v = (typeof r.variance === 'number') ? r.variance : (r.actual_spend - r.planned_spend);
      return `<tr>
        <td>${r.period_date || ''}</td>
        <td class="num">${fmt(r.planned_spend)}</td>
        <td class="num">${fmt(r.actual_spend)}</td>
        <td class="num ${(v || 0) >= 0 ? 'positive' : 'negative'}">${fmt(v)}</td>
        <td class="num">${fmt(r.cumulative_planned)}</td>
        <td class="num">${fmt(r.cumulative_actual)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    toast('Failed to load cash flow', 'danger');
  }
}

function openModal(id) {
  const m = $(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = $(id);
  if (m) m.classList.remove('open');
}

function setupModals() {
  if ($('btn-load-sample')) $('btn-load-sample').addEventListener('click', async () => {
    try {
      await api('/init', { method: 'POST' });
      toast('Sample data loaded');
      const projects = await refreshProjects();
      if (projects.length) {
        currentProjectId = projects[0].id;
        $('projectSelect').value = String(currentProjectId);
        loadDashboard();
      }
    } catch (err) {
      toast('Failed to load sample data', 'danger');
      console.error(err);
    }
  });
  if ($('btn-create-first')) $('btn-create-first').addEventListener('click', () => openModal('modal-project'));

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-content').forEach(c => {
    c.addEventListener('click', e => e.stopPropagation());
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  if ($('btn-add-project')) $('btn-add-project').addEventListener('click', () => openModal('modal-project'));
  if ($('form-project')) $('form-project').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/projects', { method: 'POST', body: JSON.stringify({ name: fd.get('name') || 'New Project', description: fd.get('description'), start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, currency: fd.get('currency') || 'ETB' }) });
      closeModal('modal-project');
      e.target.reset();
      const projects = await refreshProjects();
      if (projects.length) {
        currentProjectId = projects[projects.length - 1].id;
        $('projectSelect').value = currentProjectId;
        toast('Project created');
        loadDashboard();
      }
    } catch (err) {
      toast('Failed to create project', 'danger');
    }
  });

  // Help dropdown (User Manual / About)
  const helpBtn = $('btn-help');
  const helpMenu = $('help-menu');
  if (helpBtn && helpMenu) {
    helpBtn.addEventListener('click', () => {
      const open = helpBtn.closest('.dropdown');
      if (open) open.classList.toggle('open');
    });

    document.addEventListener('click', e => {
      const open = document.querySelector('.dropdown.open');
      if (!open) return;
      if (open.contains(e.target)) return;
      open.classList.remove('open');
    });

    helpMenu.addEventListener('click', async e => {
      const btn = e.target.closest('button[data-help]');
      if (!btn) return;
      const docKey = btn.dataset.help;
      openModal('modal-help');
      await loadHelpDoc(docKey);
      const openDrop = document.querySelector('.dropdown.open');
      if (openDrop) openDrop.classList.remove('open');
    });
  }

  if ($('btn-add-co')) $('btn-add-co').addEventListener('click', () => {
    if (!needProject()) return;
    $('co-project-id').value = currentProjectId;
    openModal('modal-co');
  });
  if ($('form-co')) $('form-co').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/change-orders', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), co_number: fd.get('co_number'), description: fd.get('description'), cost_impact: +fd.get('cost_impact') || 0, schedule_impact_days: +fd.get('schedule_impact_days') || 0, priority: fd.get('priority') || 'Medium' }) });
      closeModal('modal-co');
      e.target.reset();
      toast('Change order added');
      loadChangeOrders();
      loadDashboard();
    } catch (err) {
      toast('Failed to add change order', 'danger');
    }
  });

  if ($('btn-add-risk')) $('btn-add-risk').addEventListener('click', () => {
    if (!needProject()) return;
    $('risk-project-id').value = currentProjectId;
    openModal('modal-risk');
  });
  if ($('form-risk')) $('form-risk').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/risks', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), title: fd.get('title'), description: fd.get('description'), probability: +fd.get('probability'), impact: +fd.get('impact'), allocated_contingency: +fd.get('allocated_contingency') || 0, risk_owner: fd.get('risk_owner'), mitigation_plan: fd.get('mitigation_plan') }) });
      closeModal('modal-risk');
      e.target.reset();
      toast('Risk added');
      loadRisks();
    } catch (err) {
      toast('Failed to add risk', 'danger');
    }
  });

  if ($('btn-add-evm')) $('btn-add-evm').addEventListener('click', () => {
    if (!needProject()) return;
    $('evm-project-id').value = currentProjectId;
    const rf = $('form-evm');
    if (rf && rf.querySelector('[name=report_date]')) {
      rf.querySelector('[name=report_date]').value = new Date().toISOString().slice(0, 10);
    }
    openModal('modal-evm');
  });
  if ($('form-evm')) $('form-evm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/evm', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), report_date: fd.get('report_date'), bac: +fd.get('bac'), pv: +fd.get('pv') || 0, ev: +fd.get('ev') || 0, ac: +fd.get('ac') || 0 }) });
      closeModal('modal-evm');
      toast('EVM entry added');
      loadEVM();
      loadDashboard();
    } catch (err) {
      toast('Failed to add EVM entry', 'danger');
    }
  });

  // Live EVM calculations preview
  const evmForm = $('form-evm');
  const evmPreview = $('evm-preview');
  if (evmForm && evmPreview) {
    const updateEvmPreview = () => {
      const bac = +evmForm.querySelector('[name=bac]').value || 0;
      const pv = +evmForm.querySelector('[name=pv]').value || 0;
      const ev = +evmForm.querySelector('[name=ev]').value || 0;
      const ac = +evmForm.querySelector('[name=ac]').value || 0;
      const sv = ev - pv;
      const cv = ev - ac;
      const spi = pv ? ev / pv : null;
      const cpi = ac ? ev / ac : null;
      const eac = cpi ? bac / cpi : bac;
      const etc = eac - ac;
      const vac = bac - eac;
      evmPreview.innerHTML = `
        <div>SV: <strong>${sv.toFixed(2)}</strong>, CV: <strong>${cv.toFixed(2)}</strong></div>
        <div>SPI: <strong>${spi != null ? spi.toFixed(2) : '—'}</strong>, CPI: <strong>${cpi != null ? cpi.toFixed(2) : '—'}</strong></div>
        <div>EAC: <strong>${fmt(eac)}</strong>, ETC: <strong>${fmt(etc)}</strong>, VAC: <strong>${fmt(vac)}</strong></div>
      `;
    };
    ['bac', 'pv', 'ev', 'ac'].forEach(name => {
      const input = evmForm.querySelector(`[name=${name}]`);
      if (input) input.addEventListener('input', updateEvmPreview);
    });
    updateEvmPreview();
  }

  if ($('btn-add-cf')) $('btn-add-cf').addEventListener('click', () => {
    if (!needProject()) return;
    $('cf-project-id').value = currentProjectId;
    const cf = $('form-cf');
    if (cf && cf.querySelector('[name=period_date]')) {
      cf.querySelector('[name=period_date]').value = new Date().toISOString().slice(0, 7);
    }
    openModal('modal-cf');
  });
  if ($('form-cf')) $('form-cf').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const month = fd.get('period_date') + '-01';
      await api('/cash-flow', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), period_date: month, planned_spend: +fd.get('planned_spend') || 0, actual_spend: +fd.get('actual_spend') || 0 }) });
      closeModal('modal-cf');
      toast('Period saved');
      loadCashFlow();
    } catch (err) {
      toast('Failed to save period', 'danger');
    }
  });

  // Live Cash Flow variance preview
  const cfForm = $('form-cf');
  const cfPreview = $('cf-preview');
  if (cfForm && cfPreview) {
    const updateCfPreview = () => {
      const planned = +cfForm.querySelector('[name=planned_spend]').value || 0;
      const actual = +cfForm.querySelector('[name=actual_spend]').value || 0;
      const variance = actual - planned;
      cfPreview.innerHTML = `<div>Variance: <strong class="${variance >= 0 ? 'positive' : 'negative'}">${fmt(variance)}</strong></div>`;
    };
    ['planned_spend', 'actual_spend'].forEach(name => {
      const input = cfForm.querySelector(`[name=${name}]`);
      if (input) input.addEventListener('input', updateCfPreview);
    });
    updateCfPreview();
  }

  if ($('btn-add-cost-item')) $('btn-add-cost-item').addEventListener('click', () => {
    if (!needProject()) return;
    $('ci-project-id').value = currentProjectId;
    openModal('modal-cost-item');
  });
  if ($('form-cost-item')) $('form-cost-item').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/cost-items', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), category: fd.get('category'), description: fd.get('description'), budget_hours: +fd.get('budget_hours') || null, budget_rate: +fd.get('budget_rate') || null, budget_amount: +fd.get('budget_amount') || null, actual_hours: +fd.get('actual_hours') || 0, actual_amount: +fd.get('actual_amount') || 0 }) });
      closeModal('modal-cost-item');
      e.target.reset();
      toast('Cost item added');
      loadCostItems();
    } catch (err) {
      toast('Failed to add cost item', 'danger');
    }
  });

  // Live Cost Item budget & variance preview
  const ciForm = $('form-cost-item');
  const ciPreview = $('ci-preview');
  if (ciForm && ciPreview) {
    const updateCiPreview = () => {
      const bh = +ciForm.querySelector('[name=budget_hours]').value || 0;
      const br = +ciForm.querySelector('[name=budget_rate]').value || 0;
      const baRaw = ciForm.querySelector('[name=budget_amount]').value;
      const ba = baRaw !== '' ? +baRaw : null;
      const autoBudget = bh && br ? bh * br : null;
      const budget = ba != null ? ba : autoBudget;
      const ah = +ciForm.querySelector('[name=actual_hours]').value || 0;
      const aa = +ciForm.querySelector('[name=actual_amount]').value || 0;
      const variance = budget != null ? aa - budget : null;
      ciPreview.innerHTML = `
        <div>Budget amount: <strong>${budget != null ? fmt(budget) : '—'}</strong></div>
        <div>Variance: <strong class="${(variance || 0) < 0 ? 'negative' : 'positive'}">${variance != null ? fmt(variance) : '—'}</strong></div>
      `;
    };
    ['budget_hours', 'budget_rate', 'budget_amount', 'actual_hours', 'actual_amount'].forEach(name => {
      const input = ciForm.querySelector(`[name=${name}]`);
      if (input) input.addEventListener('input', updateCiPreview);
    });
    updateCiPreview();
  }

  if ($('btn-add-sub')) $('btn-add-sub').addEventListener('click', async () => {
    if (!needProject()) return;
    try {
      const vendors = await api('/vendors');
      $('sub-project-id').value = currentProjectId;
      const sel = $('sub-vendor-select');
      sel.innerHTML = vendors.length ? vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('') : '<option value="">No vendors — add one in Vendor Bids</option>';
      openModal('modal-sub');
    } catch (err) {
      toast('Failed to load vendors', 'danger');
    }
  });
  if ($('form-sub')) $('form-sub').addEventListener('submit', async e => {
    e.preventDefault();
    const vid = $('sub-vendor-select')?.value;
    if (!vid) {
      toast('Add a vendor first (Vendor Bids → + Vendor)', 'warning');
      return;
    }
    try {
      const fd = new FormData(e.target);
      await api('/subcontractors', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), vendor_id: +vid, original_contract: +fd.get('original_contract'), change_orders_total: +fd.get('change_orders_total') || 0 }) });
      closeModal('modal-sub');
      toast('Subcontractor added');
      loadSubcontractors();
    } catch (err) {
      toast('Failed to add subcontractor', 'danger');
    }
  });

  // Live Subcontractor revised contract preview
  const subForm = $('form-sub');
  const subPreview = $('sub-preview');
  if (subForm && subPreview) {
    const updateSubPreview = () => {
      const original = +subForm.querySelector('[name=original_contract]').value || 0;
      const changes = +subForm.querySelector('[name=change_orders_total]').value || 0;
      const revised = original + changes;
      subPreview.innerHTML = `<div>Revised contract: <strong>${fmt(revised)}</strong></div>`;
    };
    ['original_contract', 'change_orders_total'].forEach(name => {
      const input = subForm.querySelector(`[name=${name}]`);
      if (input) input.addEventListener('input', updateSubPreview);
    });
    updateSubPreview();
  }

  if ($('btn-add-vendor')) $('btn-add-vendor').addEventListener('click', () => openModal('modal-vendor'));
  if ($('form-vendor')) $('form-vendor').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/vendors', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), contact_person: fd.get('contact_person'), email: fd.get('email'), phone: fd.get('phone'), payment_terms: fd.get('payment_terms') }) });
      closeModal('modal-vendor');
      e.target.reset();
      toast('Vendor added');
      loadVendors();
    } catch (err) {
      toast('Failed to add vendor', 'danger');
    }
  });

  if ($('btn-add-package')) $('btn-add-package').addEventListener('click', () => {
    if (!needProject()) return;
    $('pkg-project-id').value = currentProjectId;
    openModal('modal-package');
  });
  if ($('form-package')) $('form-package').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await api('/procurement', { method: 'POST', body: JSON.stringify({ project_id: +fd.get('project_id'), package_name: fd.get('package_name'), description: fd.get('description'), lead_time_days: +fd.get('lead_time_days') || null }) });
      closeModal('modal-package');
      toast('Package added');
      loadVendors();
    } catch (err) {
      toast('Failed to add package', 'danger');
    }
  });

  // Live Risk score & contingency preview
  const riskForm = $('form-risk');
  const riskPreview = $('risk-preview');
  if (riskForm && riskPreview) {
    const updateRiskPreview = () => {
      const prob = +riskForm.querySelector('[name=probability]').value || 0;
      const impact = +riskForm.querySelector('[name=impact]').value || 0;
      const alloc = +riskForm.querySelector('[name=allocated_contingency]').value || 0;
      const score = prob * impact;
      riskPreview.innerHTML = `
        <div>Risk score (P×I): <strong>${score}</strong></div>
        <div>Remaining contingency: <strong>${fmt(alloc)}</strong></div>
      `;
    };
    ['probability', 'impact', 'allocated_contingency'].forEach(name => {
      const input = riskForm.querySelector(`[name=${name}]`);
      if (input) input.addEventListener('input', updateRiskPreview);
    });
    updateRiskPreview();
  }

  // Risk AI suggestion
  const btnRiskSuggest = document.getElementById('btn-risk-suggest');
  if (btnRiskSuggest && riskForm) {
    btnRiskSuggest.addEventListener('click', async () => {
      try {
        const fd = new FormData(riskForm);
        const payload = {
          title: fd.get('title'),
          description: fd.get('description'),
        };
        const resp = await api('/risk-suggest', { method: 'POST', body: JSON.stringify(payload) });
        if (typeof resp.probability === 'number') {
          riskForm.querySelector('[name=probability]').value = String(resp.probability);
        }
        if (typeof resp.impact === 'number') {
          riskForm.querySelector('[name=impact]').value = String(resp.impact);
        }
        if (resp.mitigation_plan && riskForm.querySelector('[name=mitigation_plan]')) {
          riskForm.querySelector('[name=mitigation_plan]').value = resp.mitigation_plan;
        }
        updateRiskPreview();
        toast('AI suggestion applied to risk fields');
      } catch (err) {
        console.error(err);
        toast('Failed to get AI risk suggestion', 'danger');
      }
    });
  }

  // Export handlers
  const exports = [
    ['export-cbs', 'cbs'], ['export-evm', 'evm'], ['export-co', 'change-orders'], ['export-risk', 'risks'],
    ['export-cf', 'cash-flow'], ['export-cost-items', 'cost-items'], ['export-subcontractors', 'subcontractors']
  ];
  exports.forEach(([id, module]) => {
    const el = $(id);
    if (el) el.addEventListener('click', e => {
      e.preventDefault();
      if (!currentProjectId) {
        toast('Select a project first', 'warning');
        return;
      }
      window.open(API + '/export/' + currentProjectId + '/' + module);
    });
  });

  // AI assistant handlers
  const aiQuestion = document.getElementById('ai-question');
  const aiAnswer = document.getElementById('ai-answer');
  const btnAsk = document.getElementById('btn-ai-ask');
  const btnSummary = document.getElementById('btn-ai-summary');

  if (btnAsk && aiQuestion && aiAnswer) {
    btnAsk.addEventListener('click', async () => {
      if (!currentProjectId) {
        toast('Select a project first', 'warning');
        return;
      }
      const q = aiQuestion.value.trim();
      if (!q) {
        toast('Type a question for the AI assistant', 'warning');
        return;
      }
      aiAnswer.textContent = 'Thinking...';
      try {
        const resp = await api('/ask', {
          method: 'POST',
          body: JSON.stringify({ project_id: currentProjectId, question: q }),
        });
        aiAnswer.textContent = resp.answer || 'No answer returned.';
      } catch (err) {
        console.error(err);
        aiAnswer.textContent = 'Failed to get AI answer.';
      }
    });
  }

  if (btnSummary && aiAnswer) {
    btnSummary.addEventListener('click', async () => {
      if (!currentProjectId) {
        toast('Select a project first', 'warning');
        return;
      }
      aiAnswer.textContent = 'Generating summary...';
      try {
        const resp = await api('/report/' + currentProjectId);
        aiAnswer.textContent = resp.summary || 'No summary available.';
      } catch (err) {
        console.error(err);
        aiAnswer.textContent = 'Failed to generate summary.';
      }
    });
  }
}

async function loadHelpDoc(docKey) {
  const title = $('help-title');
  const content = $('help-content');
  if (!content) return;

  if (docKey === 'user-manual') {
    if (title) title.textContent = 'User Manual';
    content.textContent = 'Loading...';
    await fetchAndRenderMarkdown('/docs/USER_MANUAL.md', content);
  } else if (docKey === 'about') {
    if (title) title.textContent = 'About';
    content.textContent = 'Loading...';
    await fetchAndRenderMarkdown('/docs/ABOUT.md', content);
  }
}

async function fetchAndRenderMarkdown(url, container) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status} ${res.statusText})`);
    }
    const md = await res.text();
    container.innerHTML = renderMarkdown(md);
  } catch (err) {
    container.innerHTML = `
      <p class="text-danger">Unable to load document: ${escapeHtml(err.message)}</p>
      <p>If you're running the app via <code>file://</code>, the built-in docs will not load. Run the server using <code>npm start</code> and open <code>http://localhost:3000</code>.</p>
      <p><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open in new tab</a></p>
    `;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  const flushList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      html += '<p></p>';
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushList();
      const level = Math.min(headerMatch[1].length, 3);
      html += `<h${level}>${escapeHtml(headerMatch[2])}</h${level}>`;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        inList = true;
        html += '<ul>';
      }
      html += `<li>${escapeHtml(trimmed.slice(2))}</li>`;
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushList();
      i += 1;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      html += `<pre>${escapeHtml(codeLines.join('\n'))}</pre>`;
      continue;
    }

    html += `<p>${escapeHtml(trimmed)}</p>`;
  }

  flushList();
  return html;
}

// Run when DOM is ready (script is at end of body, but handle async/defer)
function boot() {
  try {
    init();
  } catch (err) {
    console.error('Init failed:', err);
    toast('Error: ' + err.message + ' — check console', 'danger');
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
