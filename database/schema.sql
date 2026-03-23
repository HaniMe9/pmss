-- PMSS - All-in-One Construction Cost Management System
-- Database Schema - SQLite compatible

-- Projects (root entity)
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    currency TEXT DEFAULT 'ETB',
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cost Codes (CSI MasterFormat aligned)
CREATE TABLE cost_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT CHECK(category IN ('Labor', 'Materials', 'Equipment', 'Subcontractors', 'Overhead')),
    parent_id INTEGER REFERENCES cost_codes(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CBS (Cost Breakdown Structure) - hierarchical
CREATE TABLE cbs_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    parent_id INTEGER REFERENCES cbs_nodes(id),
    cost_code_id INTEGER REFERENCES cost_codes(id),
    wbs_code TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CBS Budget & Actuals (per node)
CREATE TABLE cbs_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cbs_node_id INTEGER NOT NULL REFERENCES cbs_nodes(id),
    original_budget REAL DEFAULT 0,
    approved_changes REAL DEFAULT 0,
    committed_cost REAL DEFAULT 0,
    actual_cost REAL DEFAULT 0,
    etc REAL DEFAULT 0,
    eac REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cbs_node_id) REFERENCES cbs_nodes(id)
);

-- EVM (Earned Value Management)
CREATE TABLE evm_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    report_date DATE NOT NULL,
    bac REAL NOT NULL,
    pv REAL DEFAULT 0,
    ev REAL DEFAULT 0,
    ac REAL DEFAULT 0,
    spi REAL,
    cpi REAL,
    eac REAL,
    etc REAL,
    vac REAL,
    tcpi REAL,
    performance_rating TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Change Orders
CREATE TABLE change_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    cbs_node_id INTEGER REFERENCES cbs_nodes(id),
    co_number TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
    cost_impact REAL DEFAULT 0,
    schedule_impact_days INTEGER DEFAULT 0,
    priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    submitted_date DATE,
    approved_date DATE,
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Risk Register
CREATE TABLE risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    cbs_node_id INTEGER REFERENCES cbs_nodes(id),
    title TEXT NOT NULL,
    description TEXT,
    probability INTEGER CHECK(probability BETWEEN 1 AND 5),
    impact INTEGER CHECK(impact BETWEEN 1 AND 5),
    allocated_contingency REAL DEFAULT 0,
    used_contingency REAL DEFAULT 0,
    trigger_event TEXT,
    risk_owner TEXT,
    mitigation_plan TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Vendors
CREATE TABLE vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    payment_terms TEXT,
    warranty TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Procurement Packages (for vendor comparison)
CREATE TABLE procurement_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    cbs_node_id INTEGER REFERENCES cbs_nodes(id),
    package_name TEXT NOT NULL,
    description TEXT,
    lead_time_days INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Vendor Bids
CREATE TABLE vendor_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL REFERENCES procurement_packages(id),
    vendor_id INTEGER NOT NULL REFERENCES vendors(id),
    bid_amount REAL NOT NULL,
    lead_time_days INTEGER,
    score INTEGER,
    notes TEXT,
    is_awarded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES procurement_packages(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Cash Flow (monthly planned vs actual)
CREATE TABLE cash_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    period_date DATE NOT NULL,
    planned_spend REAL DEFAULT 0,
    actual_spend REAL DEFAULT 0,
    cumulative_planned REAL DEFAULT 0,
    cumulative_actual REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, period_date),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Cost Items (Labor, Materials, Equipment - detailed tracking by CBS node)
CREATE TABLE cost_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    cbs_node_id INTEGER REFERENCES cbs_nodes(id),
    category TEXT NOT NULL CHECK(category IN ('Labor', 'Materials', 'Equipment')),
    description TEXT,
    budget_hours REAL,
    budget_rate REAL,
    budget_amount REAL,
    actual_hours REAL DEFAULT 0,
    actual_amount REAL DEFAULT 0,
    variance REAL,
    unit TEXT,
    quantity_ordered REAL,
    quantity_received REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Subcontractors detail
CREATE TABLE subcontractors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    cbs_node_id INTEGER REFERENCES cbs_nodes(id),
    vendor_id INTEGER REFERENCES vendors(id),
    original_contract REAL NOT NULL,
    change_orders_total REAL DEFAULT 0,
    revised_contract REAL,
    invoiced_to_date REAL DEFAULT 0,
    retention_held REAL DEFAULT 0,
    percent_complete REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Indexes for performance
CREATE INDEX idx_cbs_project ON cbs_nodes(project_id);
CREATE INDEX idx_cbs_parent ON cbs_nodes(parent_id);
CREATE INDEX idx_change_orders_project ON change_orders(project_id);
CREATE INDEX idx_risks_project ON risks(project_id);
CREATE INDEX idx_cash_flow_project ON cash_flow(project_id);
CREATE INDEX idx_evm_project ON evm_data(project_id);
CREATE INDEX idx_cost_items_project ON cost_items(project_id);
