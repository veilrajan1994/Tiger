# Non-Functional Requirements

## Overview
The Retail Pricing Feed Management System serves a retail chain with stores across multiple countries. The system must meet enterprise-grade non-functional requirements while integrating AI-powered features via Google Gemini.

## 1. Performance

### Requirements
- API responses < 200ms for 95th percentile (non-AI endpoints)
- AI endpoints < 10 seconds (dependent on Gemini API latency)
- Initial page load < 2 seconds
- CSV upload: process 10,000 records in < 30 seconds
- Search results in < 500ms for typical queries

### How the Design Addresses This
- Database indexing on storeId, sku, date, and composite storeId+date
- Prisma connection pooling for efficient DB access
- CSV batch processing (500 records per transaction)
- Server-side pagination (50 records per page default, max 100)
- Memoized React components (React.memo, useCallback, useMemo) to minimize re-renders
- Lazy Gemini client initialization (no startup cost if AI unused)
- AI responses cached in component state (no re-fetch until user triggers refresh)

## 2. Scalability

### Requirements
- Support multiple application servers (horizontal scaling)
- Handle growing data volume (millions of pricing records)
- Support concurrent AI requests without blocking

### How the Design Addresses This
- Stateless JWT authentication (no server-side sessions)
- Database designed for Prisma datasource swap (SQLite → PostgreSQL)
- Async CSV processing (non-blocking upload endpoint)
- AI service uses lazy singleton pattern (single Gemini client instance)
- Rate limiting prevents AI endpoint abuse (100 req/15min)
- Batch DB operations reduce connection overhead

## 3. Availability

### Requirements
- Graceful error handling (no crashes on AI failures)
- Health check endpoint for monitoring
- Graceful shutdown on SIGTERM/SIGINT

### How the Design Addresses This
- `/health` endpoint returns status and timestamp
- Express error handler middleware catches all unhandled errors
- asyncHandler wrapper on all controller functions
- AI failures return user-friendly error messages (don't crash server)
- Graceful shutdown: closes HTTP server, disconnects Prisma, force-exits after 10s timeout
- Winston structured logging for error tracking

## 4. Security

### Requirements
- Secure authentication and authorization
- Role-based data access (store managers see only their store)
- Protection against common web vulnerabilities
- API key security for external AI service

### How the Design Addresses This
- JWT authentication with access + refresh token flow
- bcrypt password hashing (10 salt rounds)
- Role-based access enforced at controller level (ADMIN vs STORE_MANAGER)
- Store-scoped queries: STORE_MANAGER can only access assigned store data
- Helmet.js for HTTP security headers (XSS, clickjacking, MIME sniffing)
- CORS whitelist (only configured origin allowed)
- Rate limiting: 100 req/15min global, 20 req/15min for auth
- Prisma ORM prevents SQL injection (parameterized queries)
- Joi validation on all input endpoints
- File upload restrictions: CSV only, 10MB max, Multer validation
- Gemini API key stored in .env, never exposed to frontend
- AI query length capped at 500 characters, CSV validation capped at 5000 rows

## 5. Reliability

### Requirements
- No data loss or corruption during uploads
- ACID transactions for data modifications
- Comprehensive audit trail

### How the Design Addresses This
- Database transactions for batch upserts (500 records per transaction)
- Composite unique constraint (storeId + sku + date) prevents duplicates
- Foreign key constraints maintain referential integrity
- Audit log created on every pricing record update/delete
- Upload history tracks status, success/error counts, and error details
- Failed batches don't affect successful ones (partial completion supported)
- AI response sanitization (cleanJsonResponse strips markdown fences)

## 6. Maintainability

### Requirements
- Clean, readable, well-structured code
- Comprehensive logging
- Easy configuration management

### How the Design Addresses This
- TypeScript across full stack for type safety
- Modular architecture: controllers, services, middleware, routes, validators
- Structured Winston logging (JSON format with timestamps)
- Log levels: info for requests, error for failures with stack traces
- Environment configuration via .env with .env.example template
- Prisma schema as single source of truth for data model
- Prisma migrations for version-controlled schema changes
- Separation of concerns: AI logic in ai.service.ts, HTTP handling in ai.controller.ts

## 7. Usability

### Requirements
- Intuitive UI for non-technical store managers
- Clear feedback for all actions
- AI features accessible without training

### How the Design Addresses This
- Clean dashboard with stat cards and AI insights on load
- Natural language AI search bar with placeholder examples
- AI-parsed filters shown as tags so user sees what AI understood
- "AI Validate" button on upload page with color-coded results
- Report Generator on Dashboard accepts plain English queries
- Loading spinners and skeleton states during AI processing
- Error messages displayed inline with dismiss buttons
- Inline editing with Enter/Escape keyboard shortcuts

## 8. AI-Specific Non-Functional Requirements

### Requirements
- AI responses must be valid JSON (parseable by frontend)
- AI failures must not crash the application
- AI features must respect role-based access control
- AI costs must be controlled

### How the Design Addresses This
- Gemini configured with responseMimeType: 'application/json'
- cleanJsonResponse() strips markdown fences as fallback
- All AI endpoints wrapped in asyncHandler with try-catch
- AI service functions receive userRole and userStoreId for scoped queries
- Rate limiting on all /api/ai/* endpoints
- AI query length validation (max 500 chars)
- CSV validation limited to first 50 rows sent to AI (cost control)
- Temperature tuned per use case to balance creativity vs accuracy

## Summary Matrix

| NFR Category    | Key Requirement                    | Status         | Priority |

| Performance     | < 200ms API, < 10s AI              | ✅ Implemented | High     |
| Scalability     | Stateless, horizontal-ready        | ✅ Implemented | High     |
| Availability    | Graceful errors, health check      | ✅ Implemented | High     |
| Security        | JWT, RBAC, Helmet, rate-limit      | ✅ Implemented | Critical |
| Reliability     | ACID, audit trail, constraints     | ✅ Implemented | Critical |
| Maintainability | TypeScript, modular, logging       | ✅ Implemented | Medium   |
| Usability       | NL search, report gen, inline edit | ✅ Implemented | High     |
| AI Reliability  | JSON mode, fallback parsing        | ✅ Implemented | High     |
