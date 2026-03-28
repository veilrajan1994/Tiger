# Design Decisions

## Technology Stack

### 1. React 18 with TypeScript (Frontend)
- Component reusability with memo, useCallback, useMemo for performance
- React Context API for auth state (no Redux needed for this scale)
- React Router v6 for client-side routing with PrivateRoute guards
- Axios with interceptors for automatic JWT refresh on 401
- Alternatives considered: Angular (heavier), Vue.js (smaller ecosystem)

### 2. Node.js + Express with TypeScript (Backend)
- Full-stack TypeScript for shared type safety
- Non-blocking I/O ideal for CSV streaming and AI API calls
- Express middleware chain: helmet → cors → rate-limit → body-parser → routes → error handler
- Alternatives considered: Java Spring Boot (verbose), Python Django (slower I/O)

### 3. SQLite with Prisma ORM (Database)
- SQLite for development simplicity (single file, no server setup)
- Prisma provides type-safe queries, automatic migrations, and schema-first design
- Composite unique constraint (storeId + sku + date) enforced at DB level
- Indexed on storeId, sku, date, and composite storeId+date for fast queries
- Production path: swap to PostgreSQL by changing datasource in schema.prisma
- Alternatives considered: MongoDB (not ideal for relational pricing data), raw SQL (error-prone)

### 4. Google Gemini AI (gemini-2.5-flash)
- Replaced OpenAI GPT-4o-mini due to API quota issues and cost
- @google/generative-ai SDK with lazy singleton initialization
- JSON response mode (responseMimeType: 'application/json') for structured outputs
- cleanJsonResponse() helper strips markdown fences when model wraps JSON in code blocks
- Temperature tuned per use case: 0 for search parsing, 0.5 for reports, 0.7 for insights
- Alternatives considered: OpenAI (quota exceeded, higher cost), Anthropic Claude (no JSON mode at time)

## Architecture Decisions

### 5. Monorepo Structure
- `/backend` and `/frontend` in same repo for simplified development
- Shared understanding of API contracts without separate type packages
- Single git history for coordinated changes

### 6. JWT Authentication with Refresh Tokens
- Stateless auth enables horizontal scaling
- Access token (24h) + refresh token (7d) stored in localStorage
- Axios interceptor auto-refreshes on 401 without user intervention
- Role-based access: ADMIN (full access) and STORE_MANAGER (scoped to assigned store)

### 7. Async CSV Processing
- Upload endpoint returns immediately with uploadId
- CSV processed asynchronously (non-blocking)
- Frontend polls `/upload/:id/status` every 2 seconds
- Batch upsert in transactions of 500 records for memory efficiency
- Store ID resolution done in single query, then mapped in-memory

### 8. AI Service as Lazy Singleton
- Gemini client initialized on first use, not at server startup
- Prevents crash if API key is missing but AI features aren't used
- Single model instance reused across all AI functions
- All AI responses parsed through cleanJsonResponse() to handle markdown wrapping

### 9. AI-Powered CSV Validation (Pre-Upload)
- Client-side CSV parsing (file.text() + split) sends rows as JSON to backend
- Backend sends first 50 rows to Gemini with list of valid store IDs
- Gemini checks: missing fields, invalid stores, price outliers, date formats, duplicates, suspicious patterns
- Returns severity-tagged issues with suggestions
- Runs before upload so user can fix issues first

### 10. Natural Language Report Generation
- Gathers comprehensive data: totals, price stats, store breakdown, top products, recent uploads
- User provides free-text query like "Weekly pricing report for Tokyo store"
- Gemini generates structured report: title, period, sections, key metrics, recommendations
- Rendered as a formatted card on the Dashboard page below AI Insights

## UI/UX Decisions

### 13. Custom CSS (No UI Library)
- Lightweight, no dependency on Material-UI or similar
- Custom components: StatCard, InsightsCard, FilterPanel, PricingRow, etc.
- All components memoized with React.memo for render performance
- Consistent design language with CSS variables

### 12. Report Generator on Dashboard
- Report Generator placed directly on Dashboard below AI Insights card
- Input field with Enter key support for quick generation
- Structured output: title, period, key metrics grid, sections, recommendations
- No separate AI Hub page — keeps navigation simple

### 15. Inline Editing in Pricing Table
- Click-to-edit on productName and price cells
- Enter to save, Escape to cancel
- Immediate PUT request with optimistic UI update
- Audit log created server-side on every edit

### 16. AI Validate Button on Upload Page
- Purple "AI Validate" button alongside "Upload File" button
- Runs before upload so user can review issues
- Validation results shown with color-coded severity (red errors, yellow warnings)
- Non-blocking: user can still upload without validating

## Performance Decisions

### 17. Database Indexing
- Indexes: storeId, sku, date, storeId+date composite, email
- Composite unique constraint prevents duplicate pricing entries
- Supports common query patterns: filter by store, date range, SKU search

### 18. Rate Limiting
- Global: 100 requests per 15 minutes per IP
- Auth endpoints: 20 requests per 15 minutes (stricter)
- Prevents abuse of AI endpoints which have external API costs

### 19. Memoized React Components
- All sub-components wrapped in React.memo
- Callbacks stabilized with useCallback
- Computed values cached with useMemo
- Prevents unnecessary re-renders in data-heavy pages

## Security Decisions

### 20. Password Hashing
- bcrypt with 10 salt rounds
- Industry standard, resistant to rainbow table attacks

### 21. Store-Scoped Access Control
- STORE_MANAGER role can only access their assigned store's data
- Enforced at controller level on every query (not just UI)
- AI features also respect store scoping

### 22. Input Validation
- Joi schemas on auth and pricing endpoints
- AI endpoints validate query length (max 500 chars) and row count (max 5000)
- File upload: CSV only, max 10MB, validated by Multer

### 23. Environment Variables
- All secrets in .env (JWT_SECRET, GEMINI_API_KEY)
- .env.example provided as template without real values
- dotenv loaded at server startup
