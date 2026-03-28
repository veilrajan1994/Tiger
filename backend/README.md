# Backend API - Pricing Feed Management

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and configure:
- Database connection string
- JWT secrets
- CORS origin
- Other settings

### 3. Setup Database

Install PostgreSQL 14+ and create a database:
```sql
CREATE DATABASE pricing_feed_db;
```

### 4. Run Migrations
```bash
npx prisma migrate dev
```

### 5. Generate Prisma Client
```bash
npx prisma generate
```

### 6. Seed Database (Optional)

Create a seed file to add sample stores and users:
```bash
npx prisma db seed
```

### 7. Start Development Server
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Pricing Records
- `GET /api/pricing` - List pricing records (with filters)
- `GET /api/pricing/:id` - Get single record
- `PUT /api/pricing/:id` - Update record
- `DELETE /api/pricing/:id` - Delete record (admin only)

### Upload
- `POST /api/upload/csv` - Upload CSV file
- `GET /api/upload/history` - Upload history
- `GET /api/upload/:id/status` - Upload status

### Stores
- `GET /api/stores` - List stores
- `GET /api/stores/:id` - Get store details

## Database Schema

See `prisma/schema.prisma` for complete schema.

Key tables:
- `users` - User accounts
- `stores` - Store information
- `pricing_records` - Pricing data
- `audit_logs` - Audit trail
- `upload_history` - CSV upload tracking

## Testing

Create test users:
```bash
# Admin user
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "admin123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "ADMIN"
}

# Store manager
POST /api/auth/register
{
  "email": "manager@example.com",
  "password": "manager123",
  "firstName": "Store",
  "lastName": "Manager",
  "role": "STORE_MANAGER",
  "storeId": "<store-uuid>"
}
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure proper CORS origins
4. Enable HTTPS
5. Setup database backups
6. Configure logging
7. Setup monitoring
