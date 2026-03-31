# Solution Architecture

## High-Level Architecture

┌────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                React SPA (TypeScript)                        │  │
│  │                                                              │  │
│  │  Pages:                                                      │  │
│  │  • Login          — JWT authentication                       │  │
│  │  • Dashboard      — Stats + AI Insights & Generator Report   │  │
│  │  • Pricing List   — Search, filter, inline edit, AI Search   │  │
│  │  • Upload CSV     — Drag-drop upload + AI Validation         │  │
│  │                                                              │  │
│  │  Shared: Layout (sidebar nav), PrivateRoute, AuthContext     │  │
│  │  HTTP Client: Axios with JWT interceptors + auto-refresh     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTPS / REST API (port 3000 → 5000)
                           │
┌──────────────────────────▼─────────────────────────────────────────┐
│                      Application Layer                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │          Node.js + Express API (TypeScript, port 5000)       │  │
│  │                                                              │  │
│  │  Controllers:                                                │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                │  │
│  │  │   Auth     │ │  Upload    │ │  Pricing   │                │  │
│  │  │ Controller │ │ Controller │ │ Controller │                │  │
│  │  └────────────┘ └────────────┘ └────────────┘                │  │
│  │  ┌────────────┐ ┌────────────┐                               │  │
│  │  │   Store    │ │    AI      │ ← 4 endpoints                 │  │
│  │  │ Controller │ │ Controller │   (search, insights,          │  │
│  │  └────────────┘ └────────────┘    validate, report)          │  │
│  │  Services:                                                   │  │
│  │  ┌────────────┐ ┌────────────┐                               │  │
│  │  │   Audit    │ │    AI      │ ← Google Gemini integration   │  │
│  │  │  Service   │ │  Service   │   (gemini-2.5-flash model)    │  │
│  │  └────────────┘ └────────────┘                               │  │
│  │                                                              │  │
│  │  Middleware: JWT Auth, Joi Validation, Error Handler,        │  │
│  │             Helmet, CORS, Rate Limiting, Multer (uploads)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────┬──────────────────────┘
                           │ Prisma ORM       │ HTTPS
                           │                  │
┌──────────────────────────▼─────┐  ┌────────▼─────────────────────┐
│          Data Layer            │  │     External AI Service      │
│  ┌────────────────────────┐    │  │  ┌───────────────────────┐   │
│  │    SQLite Database     │    │  │  │  Google Gemini AI     │   │
│  │    (via Prisma ORM)    │    │  │  │  (gemini-2.5-flash)   │   │
│  │                        │    │  │  │                       │   │
│  │  Tables:               │    │  │  │  Features:            │   │
│  │  • users               │    │  │  │  • NL Query Parsing   │   │
│  │  • stores              │    │  │  │  • Dashboard Insights │   │
│  │  • pricing_records     │    │  │  │  • CSV Validation     │   │
│  │  • audit_logs          │    │  │  │  • Report Generation  │   │
│  │  • upload_history      │    │  │  │                       │   │
│  │  Indexes: storeId,     │    │  │  │                       │   │
│  │  sku, date, storeId+   │    │  │  │  Config:              │   │
│  │  date composite        │    │  │  │  • JSON response mode │   │
│  │                        │    │  │  │  • Lazy initialization│   │
│  │  Unique: storeId +     │    │  │  │  • Response sanitizer │   │
│  │  sku + date            │    │  │  └───────────────────────┘   │
│  └────────────────────────┘    │  │                              │
└────────────────────────────────┘  └──────────────────────────────┘

## Component Details

### Frontend (React)
- Framework: React 18 with TypeScript
- State Management: React Context API + Hooks (useCallback, useMemo, memo)
- HTTP Client: Axios with JWT interceptors and automatic token refresh
- Routing: React Router v6 with PrivateRoute guard
- UI: Custom CSS components (no external UI library)
- Pages: Login, Dashboard, PricingList, Upload

### Backend (Node.js)
- Runtime: Node.js with TypeScript (ts-node + nodemon for dev)
- Framework: Express.js
- ORM: Prisma (SQLite for development)
- Authentication: JWT (jsonwebtoken) with access + refresh tokens
- Validation: Joi schema validation
- CSV Processing: csv-parser with streaming
- AI: @google/generative-ai (Gemini 2.5 Flash)
- Security: helmet, cors, express-rate-limit
- Logging: Winston (JSON structured logs)
- File Upload: Multer (disk storage)

### Database (SQLite via Prisma)
- 5 tables: users, stores, pricing_records, audit_logs, upload_history
- Composite unique constraint: storeId + sku + date
- Indexed columns: email, storeId, sku, date, storeId+date
- UUID primary keys

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint         | Description                              |
|--------|------------------|------------------------------------------|
| POST   | `/auth/login`    | User login (returns JWT + refresh token) |
| POST   | `/auth/register` | User registration                        |
| POST   | `/auth/refresh`  | Refresh expired JWT token                |

### Pricing Records (`/api/pricing`)
| Method | Endpoint       | Description                        |
|--------|----------------|------------------------------------|
| GET    | `/pricing`     | Search/filter with pagination      |
| GET    | `/pricing/:id` | Get single record                  |
| PUT    | `/pricing/:id` | Update record (price, productName) |
| DELETE | `/pricing/:id` | Delete record (admin only)         |

### Upload (`/api/upload`)
| Method | Endpoint             | Description                        |
|--------|----------------------|------------------------------------|
| POST   | `/upload/csv`        | Upload CSV file (async processing) |
| GET    | `/upload/history`    | Upload history with pagination     |
| GET    | `/upload/:id/status` | Poll upload processing status      |

### Stores (`/api/stores`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/stores`| List all stores |

### Bootstrap (`/api/bootstrap`)
| Method | Endpoint       | Description                                    |
|--------|----------------|------------------------------------------------|
| GET    | `/bootstrap`   | Create/reset store manager accounts (dev only) |

### AI Features (`/api/ai`)
| Method | Endpoint | Description |
|--------|-------------------|------------------------------------------------------------|
| POST   | `/ai/search`      | Natural language search (Gemini parses query → DB filters) |
| GET    | `/ai/insights`    | Dashboard insights (aggregated stats → Gemini analysis)    |
| POST   | `/ai/validate-csv`| AI-powered CSV data quality validation                     |
| POST   | `/ai/report`      | Natural language report generation                         |

## AI Integration Architecture

┌─────────────────────────────────────────────────────────┐
│                   AI Service Layer                      │
│                                                         │
│  getGeminiModel()  ← Lazy singleton, initialized once   │
│       │                                                 │
│       ├── parseNaturalLanguageQuery()                   │
│       │     Input: user query + store list              │
│       │     Output: ParsedSearchFilters (JSON)          │
│       │                                                 │
│       ├── generateDashboardInsights()                   │
│       │     Input: aggregated DB stats                  │
│       │     Output: summary + highlights + recs         │
│       │                                                 │
│       ├── validateCSVWithAI()                           │
│       │     Input: CSV rows + valid store IDs           │
│       │     Output: issues with severity + suggestions  │
│       │                                                 │
│       └── generateReport()                              │
│             Input: NL query + comprehensive DB stats    │
│             Output: structured report with sections     │
│                                                         │
│  cleanJsonResponse()  ← Strips markdown fences from AI  │
└─────────────────────────────────────────────────────────┘
