# Retail Pricing Feed Management System

## Overview
A full-stack web application for managing pricing feeds from retail stores across multiple countries.

## Technology Stack
- **Frontend**: React 18, TypeScript, Material-UI, Axios
- **Backend**: Node.js, Express, TypeScript, PostgreSQL, Prisma ORM
- **File Processing**: CSV Parser
- **Authentication**: JWT
- **Validation**: Joi

## Features
- CSV file upload for pricing feeds
- Advanced search and filtering
- Edit and update pricing records
- Multi-store, multi-country support
- Audit logging
- Data validation

## Project Structure
```
TigerAnalytics/
├── backend/          # Node.js Express API
├── frontend/         # React application
├── docs/            # Documentation and diagrams
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure database connection in .env
npx prisma migrate dev
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Documentation
See `/docs` folder for:
- Context Diagram
- Solution Architecture
- Design Decisions
- Non-Functional Requirements Analysis
- Assumptions

## License
MIT
