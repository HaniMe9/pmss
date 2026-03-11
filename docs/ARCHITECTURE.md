# PMSS - Architecture & Data Model

## System Overview

The All-in-One Construction Cost Management System integrates all financial control modules through a shared data model centered on the Cost Breakdown Structure (CBS).

## Entity Relationship Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Project      │────▶│      CBS        │────▶│   Cost Items    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │              ┌────────┴────────┐              │
         │              ▼                 ▼              │
         │       ┌──────────────┐  ┌──────────────┐      │
         │       │  EVM Values  │  │  Change Orders│      │
         │       └──────────────┘  └──────────────┘      │
         │              │                 │              │
         ▼              ▼                 ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cash Flow Forecast (Time-phased)                │
└─────────────────────────────────────────────────────────────┘
         │
         ├──▶ Risk Register ──▶ Contingency
         ├──▶ Vendor Bids
         └──▶ Cost Codes (CSI Reference)
```

## Core Entities

### 1. Project
- Root entity for all project data
- Fields: name, description, start_date, end_date, currency, status

### 2. CBS (Cost Breakdown Structure)
- Hierarchical WBS/CBS mapping
- Parent-child relationships
- Links to cost codes

### 3. Cost Items (per CBS node)
- Original budget, approved changes, current budget
- Committed, actual, ETC, EAC
- Variance $ and %

### 4. EVM (Earned Value Management)
- BAC, PV, EV, AC
- SV, CV, SPI, CPI
- EAC, ETC, VAC, TCPI

### 5. Change Orders
- Status: Pending / Approved / Rejected
- Cost impact, schedule impact
- Linked to CBS nodes

### 6. Risk Register
- Probability, impact, ranking
- Contingency allocation & drawdown

### 7. Cost Codes
- CSI MasterFormat aligned
- Labor, Materials, Equipment, Subs, Overhead

### 8. Vendors & Bids
- Vendor comparison per procurement package

### 9. Cash Flow
- Monthly planned vs actual by period
