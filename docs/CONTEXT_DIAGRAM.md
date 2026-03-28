# Context Diagram

## System Context

┌───────────────────────────────────────────────────────────────────────┐
│                          External Context                             │
│                                                                       │
│  ┌──────────────┐                                   ┌──────────────┐  │
│  │   Store      │                                   │   Admin      │  │
│  │   Managers   │                                   │   Users      │  │
│  └──────┬───────┘                                   └──────┬───────┘  │
│         │                                                  │          │
│         │ Upload CSV Files                                 │ Manage   │
│         │ Search/Edit Records                              │ System   │
│         │ AI Search & Reports                              │ System   │
│         │                                                  │          │
│         └──────────────────┬───────────────────────────────┘          │
│                            │                                          │
│                            ▼                                          │
│         ┌──────────────────────────────────────────────┐              │
│         │                                              │              │
│         │    Retail Pricing Feed Management System     │              │
│         │                                              │              │
│         │  • CSV Upload & AI Validation                │              │
│         │  • Pricing Data Storage & CRUD               │              │
│         │  • AI-Powered Natural Language Search        │              │
│         │  • AI Dashboard Insights                     │              │
│         │  • AI Report Generator (Dashboard)           │              │
│         │  • Record Management & Inline Editing        │              │
│         │  • Audit Logging                             │              │
│         │  • Multi-tenant Role-Based Access            │              │
│         │                                              │              │
│         └───────┬──────────────┬──────────────┬────────┘              │
│                 │              │              │                       │
│                 ▼              ▼              ▼                       │
│         ┌────────────┐ ┌────────────┐ ┌─────────────────┐             │
│         │  SQLite    │ │   File     │ │  Google Gemini  │             │
│         │  Database  │ │   Storage  │ │  AI API         │             │
│         │  (Prisma)  │ │  (Local)   │ │  (gemini-2.5-   │             │
│         │            │ │            │ │   flash)        │             │
│         └────────────┘ └────────────┘ └─────────────────┘             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘


## Actors

### Store Managers
- Upload pricing CSV files for their assigned store
- AI-validate CSV data before uploading
- Search pricing records using natural language (AI Search)
- View and edit pricing information (inline editing)
- View AI-generated dashboard insights
- Generate AI reports from the Dashboard

### Admin Users
- All Store Manager capabilities across all stores
- Delete pricing records
- View system-wide AI insights
- Generate cross-store reports
- Monitor upload history and audit logs

## External Systems

### SQLite Database (via Prisma ORM)
- Stores all pricing records, users, stores, audit logs, upload history
- Enforces unique constraints (storeId + SKU + date)
- Indexed for fast search on storeId, SKU, date

### File Storage (Local)
- Temporary storage for uploaded CSV files
- Files cleaned up after processing

### Google Gemini AI API (gemini-2.5-flash)
- Natural language search query parsing
- Dashboard insights generation
- CSV data quality validation
- Natural language report generation

## Data Flows

```
1. CSV Upload Flow:
   User → Select CSV → [AI Validate (optional)] → Upload → 
   Backend CSV Parser → Row Validation → Store ID Resolution → 
   Batch Upsert (500/batch) → Upload History → Result

2. AI Search Flow:
   User → Natural Language Query → Gemini AI → Parsed Filters →
   Prisma Query → Database → Paginated Results → Frontend

3. AI Insights Flow:
   Dashboard Load → Aggregate DB Stats → Gemini AI Analysis →
   Summary + Highlights + Recommendations → Dashboard Card

4. AI CSV Validation Flow:
   User → Select CSV → Click "AI Validate" → Parse CSV Client-Side →
   Send Rows to Backend → Gemini AI Analysis → Validation Report

5. Report Generation Flow:
   Dashboard → User Types Natural Language Query →
   Aggregate DB Data → Gemini AI → Structured Report with
   Sections + Metrics + Recommendations

6. Edit Flow:
   User → Inline Edit Cell → PUT /api/pricing/:id →
   Validation → Database Update → Audit Log → UI Update

7. Auth Flow:
   Login → JWT Token + Refresh Token → Stored in localStorage →
   Auto-refresh on 401 → Role-based route access

