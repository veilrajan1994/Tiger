# Frontend - Pricing Feed Management

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and set:
```
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Start Development Server
```bash
npm start
```

The application will open at `http://localhost:3000`

## Features

### Login
- JWT-based authentication
- Token refresh mechanism
- Secure credential storage

### Dashboard
- Overview statistics
- Total pricing records
- Store count
- Recent uploads

### Pricing Records
- Search and filter
- Server-side pagination
- Inline editing
- Sort by multiple columns

### CSV Upload
- Drag and drop file selection
- File validation
- Progress tracking
- Upload results with error details

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Layout.tsx
│   └── PrivateRoute.tsx
├── contexts/        # React contexts
│   └── AuthContext.tsx
├── pages/           # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── PricingList.tsx
│   └── Upload.tsx
├── services/        # API services
│   └── api.ts
├── App.tsx
└── index.tsx
```

## Building for Production

```bash
npm run build
```

The build folder will contain optimized production files.

## Deployment

### Static Hosting (Netlify, Vercel, S3)
1. Build the application
2. Upload `build/` folder
3. Configure environment variables
4. Setup redirects for SPA routing

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g serve
CMD ["serve", "-s", "build", "-l", "3000"]
```

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
