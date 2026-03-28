# Assumptions

## Business Assumptions

### Store Operations
- Each store has a unique Store ID (e.g., STORE001 through STORE005)
- Stores operate in different countries (USA, UK, Japan, France, Australia)
- Pricing updates occur via CSV upload (daily or weekly)
- Store managers have basic computer literacy and internet access
- One price per SKU per store per day (enforced by unique constraint)

### Pricing Data
- Each product has a unique SKU within a store
- Prices are numeric (Float), stored in default currency USD
- Historical pricing data is maintained indefinitely
- CSV files follow the format: Store ID, SKU, Product Name, Price, Date
- Date formats accepted: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY

### User Access
- Two roles: ADMIN (full access) and STORE_MANAGER (scoped to assigned store)
- Store managers can only view/edit/upload for their assigned store
- Admin users can access all stores and delete records
- Users authenticate via email + password
- Default credentials seeded: admin@example.com/admin123, {city}@example.com/manager123

## Technical Assumptions

### Infrastructure
- Application runs locally (development mode)
- Backend: Node.js on port 5000
- Frontend: React dev server on port 3000
- SQLite database (file-based, no separate DB server needed)
- For production: swap SQLite → PostgreSQL by changing Prisma datasource

### AI Service
- Google Gemini API key is valid and has sufficient quota
- Gemini 2.5 Flash model is available (fallback: update model name in ai.service.ts)
- AI responses are JSON but may be wrapped in markdown fences (handled by cleanJsonResponse)
- AI latency is 2-8 seconds per request (acceptable for non-real-time features)
- AI features degrade gracefully if API key is missing or invalid (error shown, app continues)

### CSV File Format
- UTF-8 encoded
- First row contains headers: "Store ID", "SKU", "Product Name", "Price", "Date"
- Comma-separated values
- File size typically < 10MB (hard limit enforced)
- Maximum ~50,000 records per file

### Browser Support
- Modern browsers: Chrome, Firefox, Safari, Edge (latest versions)
- JavaScript and cookies enabled
- Minimum screen resolution: 1024x768

### Development Environment
- Node.js 18+ installed
- npm package manager
- Windows, macOS, or Linux
- PowerShell execution policy may need to be set to RemoteSigned on Windows

## AI Feature Assumptions

### Natural Language Search
- Users write queries in English
- Gemini can correctly map store names to store UUIDs from provided list
- Relative date expressions ("last week", "this month") are resolved by Gemini using today's date
- Search results are limited to 50 records per query

### Dashboard Insights
- Insights are generated from current database state (not cached)
- Insights refresh on page load and manual refresh button click
- Gemini produces valid JSON with summary, highlights, and recommendations fields

### CSV Validation
- First 50 rows are representative of the full file
- Validation checks: missing fields, invalid store IDs, price outliers, date formats, duplicates
- Validation is optional (user can upload without validating)
- Maximum 5000 rows sent for validation

### Report Generation
- Reports generated from current database state
- User provides free-text query describing desired report on the Dashboard
- Gemini structures output as: title, period, sections, key metrics, recommendations
- Reports are not persisted (generated on demand)

## Data Assumptions

### Data Quality
- Store IDs are pre-registered in the system (seeded or bootstrapped)
- SKUs follow a consistent format (e.g., SKU001)
- Product names are in English
- Prices are positive numbers
- Dates are valid and parseable

### Data Integrity
- Composite unique constraint (storeId + sku + date) prevents duplicates
- Upsert logic: existing records updated, new records created
- Foreign key relationships maintained (PricingRecord → Store, User → Store, AuditLog → User)

### Data Retention
- Pricing records: retained indefinitely
- Audit logs: retained indefinitely
- Upload history: retained indefinitely
- JWT access tokens: 24 hours
- JWT refresh tokens: 7 days

## Security Assumptions

### Authentication
- Passwords hashed with bcrypt (10 salt rounds)
- JWT secret stored in .env (not committed to version control)
- Failed login returns generic "Invalid credentials" (no user enumeration)

### Authorization
- Role-based access control is sufficient (no fine-grained permissions)
- Store scoping enforced at controller level on every request
- AI features respect the same role-based scoping

### API Security
- CORS configured for frontend origin only (http://localhost:3000)
- Rate limiting prevents brute force and AI endpoint abuse
- Gemini API key never exposed to frontend (backend-only)

## Out of Scope

- Multi-currency support (all prices stored as-is)
- Real-time price synchronization between stores
- Offline mode / PWA
- Mobile application
- Multi-language UI (English only)
- ERP/POS system integration
- Email notifications
- Advanced workflow approvals
- User self-registration (accounts created by admin/seed)
- AI model fine-tuning or custom training
- AI response caching/persistence
- Export to PDF/Excel (future enhancement)
