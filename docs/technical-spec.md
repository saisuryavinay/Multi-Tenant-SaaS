# Technical Specification

## Project Structure

```
saas/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # PostgreSQL connection pool
│   │   ├── controllers/
│   │   │   ├── authController.js    # Authentication endpoints
│   │   │   ├── tenantController.js  # Tenant management
│   │   │   ├── userController.js    # User CRUD operations
│   │   │   ├── projectController.js # Project management
│   │   │   └── taskController.js    # Task management
│   │   ├── middleware/
│   │   │   ├── authenticate.js      # JWT verification
│   │   │   └── authorize.js         # Role-based access control
│   │   ├── routes/
│   │   │   ├── auth.js              # Auth routes
│   │   │   ├── tenants.js           # Tenant routes
│   │   │   ├── users.js             # User routes
│   │   │   ├── projects.js          # Project routes
│   │   │   └── tasks.js             # Task routes
│   │   ├── utils/
│   │   │   └── auditLogger.js       # Audit logging utility
│   │   └── server.js                # Express app entry point
│   ├── migrations/
│   │   ├── 001_create_tenants.sql
│   │   ├── 002_create_users.sql
│   │   ├── 003_create_projects.sql
│   │   ├── 004_create_tasks.sql
│   │   ├── 005_create_audit_logs.sql
│   │   └── run-migrations.js        # Migration executor
│   ├── seeds/
│   │   └── run-seeds.js             # Seed data script
│   ├── Dockerfile                    # Backend container
│   ├── package.json
│   └── .env                          # Environment variables
├── frontend/
│   ├── public/
│   │   └── index.html               # HTML template
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.js            # Navigation component
│   │   ├── contexts/
│   │   │   └── AuthContext.js       # Authentication state
│   │   ├── pages/
│   │   │   ├── Login.js             # Login page
│   │   │   ├── Register.js          # Registration page
│   │   │   ├── Dashboard.js         # Dashboard with stats
│   │   │   ├── Projects.js          # Projects list
│   │   │   ├── ProjectDetails.js    # Project details with tasks
│   │   │   └── Users.js             # User management
│   │   ├── services/
│   │   │   └── api.js               # Axios API client
│   │   ├── App.js                   # Main app with routing
│   │   ├── App.css                  # Application styles
│   │   └── index.js                 # React entry point
│   ├── Dockerfile                    # Frontend container
│   └── package.json
├── docs/
│   ├── research.md                   # Technology research
│   ├── PRD.md                        # Product requirements
│   ├── architecture.md               # System architecture
│   ├── technical-spec.md             # This file
│   └── API.md                        # API documentation
├── docker-compose.yml                # Service orchestration
├── submission.json                   # Test credentials
└── README.md                         # Project documentation
```

## Development Setup

### Prerequisites
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: For version control
- **Text Editor**: VS Code recommended

### Local Development (Docker)

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd saas
   ```

2. **Start All Services**
   ```bash
   docker-compose up -d
   ```

3. **View Logs**
   ```bash
   # All services
   docker-compose logs -f

   # Specific service
   docker-compose logs -f backend
   ```

4. **Access Applications**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Database: localhost:5432

5. **Stop Services**
   ```bash
   docker-compose down

   # With volume cleanup
   docker-compose down -v
   ```

### Local Development (Without Docker)

#### Backend Setup
```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Run seeds
npm run seed

# Start development server
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install

# Configure environment
echo "REACT_APP_API_URL=http://localhost:5000" > .env

# Start development server
npm start
```

#### Database Setup (PostgreSQL)
```bash
# Install PostgreSQL 15
# Create database
createdb saas_db

# Configure connection in backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/saas_db
```

## Environment Configuration

### Backend Environment Variables

| Variable       | Description                | Example Value                          |
|----------------|----------------------------|----------------------------------------|
| DATABASE_URL   | PostgreSQL connection      | postgresql://postgres:password@database:5432/saas |
| JWT_SECRET     | JWT signing key            | your-super-secret-jwt-key-change-this  |
| PORT           | Server port                | 5000                                   |
| FRONTEND_URL   | CORS origin                | http://localhost:3000                  |
| NODE_ENV       | Environment                | production                             |

### Frontend Environment Variables

| Variable            | Description          | Example Value              |
|---------------------|----------------------|----------------------------|
| REACT_APP_API_URL   | Backend API base URL | http://localhost:5000      |

### Database Environment Variables

| Variable          | Description        | Example Value |
|-------------------|--------------------|---------------|
| POSTGRES_USER     | Database user      | postgres      |
| POSTGRES_PASSWORD | Database password  | password      |
| POSTGRES_DB       | Database name      | saas          |

## Database Management

### Running Migrations

**Automatic (Docker)**
- Migrations run automatically on backend startup
- No manual intervention required

**Manual**
```bash
# Inside backend container
docker-compose exec backend npm run migrate

# Local development
cd backend
npm run migrate
```

### Running Seeds

**Automatic (Docker)**
- Seeds run automatically after migrations
- Creates super admin and demo tenant

**Manual**
```bash
# Inside backend container
docker-compose exec backend npm run seed

# Local development
cd backend
npm run seed
```

### Database Access

**Via Docker**
```bash
docker-compose exec database psql -U postgres -d saas
```

**Direct Connection**
```bash
psql postgresql://postgres:password@localhost:5432/saas
```

### Common SQL Queries

**View all tenants**
```sql
SELECT id, name, subdomain, status, subscription_plan FROM tenants;
```

**View users by tenant**
```sql
SELECT u.id, u.email, u.full_name, u.role, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.tenant_id = 1;
```

**View projects with task counts**
```sql
SELECT 
  p.id, p.name, p.status,
  COUNT(t.id) as total_tasks,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
WHERE p.tenant_id = 1
GROUP BY p.id;
```

**View audit logs**
```sql
SELECT 
  al.action, al.entity_type, al.entity_id,
  u.email as user_email,
  al.timestamp
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.tenant_id = 1
ORDER BY al.timestamp DESC
LIMIT 20;
```

## API Development

### Controller Pattern

```javascript
// Example controller structure
const exampleController = async (req, res) => {
  try {
    // 1. Extract data from request
    const { param } = req.params;
    const { body } = req.body;
    const { userId, tenantId, role } = req.user; // From JWT

    // 2. Validate input
    if (!param) {
      return res.status(400).json({ message: 'Parameter required' });
    }

    // 3. Database query with tenant isolation
    const query = `
      SELECT * FROM table
      WHERE tenant_id = $1 AND id = $2
    `;
    const result = await pool.query(query, [tenantId, param]);

    // 4. Check authorization
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    // 5. Return response
    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
```

### Middleware Chain

```javascript
// Route with multiple middleware
router.post('/projects',
  authenticate,           // Verify JWT
  authorize(['user']),    // Check role
  projectController.create // Business logic
);
```

### Error Handling

```javascript
// Global error handler in server.js
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});
```

## Frontend Development

### Component Pattern

```javascript
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

function ExampleComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.getData();
      setData(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### API Service Pattern

```javascript
// services/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL
});

// Request interceptor - add token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
// Response interceptor - handle 401
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const projectAPI = {
  listProjects: () => apiClient.get('/api/projects'),
  createProject: (data) => apiClient.post('/api/projects', data),
  // ... more methods
};
```

### Authentication Context

```javascript
// contexts/AuthContext.js
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.data.data);
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```
## Testing

### Manual API Testing

**Register Tenant**
```bash
curl -X POST http://localhost:5000/api/auth/register-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Test Corp",
    "subdomain": "test",
    "adminEmail": "admin@test.com",
    "adminPassword": "Test@123",
    "adminFullName": "Test Admin"
  }'
```

**Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo@123"
  }'
```

**Get Projects (with JWT)**
```bash
TOKEN="<your-jwt-token>"
curl -X GET http://localhost:5000/api/projects \
  -H "Authorization: Bearer $TOKEN"
```

### Test Credentials

From `submission.json`:

**Super Admin**
- Email: superadmin@system.com
- Password: Admin@123

**Demo Tenant Admin**
- Email: admin@demo.com
- Password: Demo@123

**Demo Regular Users**
- Email: user1@demo.com / user2@demo.com
- Password: User@123

## Docker Management

### Build Images
```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend
```

### View Service Status
```bash
docker-compose ps
```

### Execute Commands in Containers
```bash
# Backend shell
docker-compose exec backend sh

# Database shell
docker-compose exec database psql -U postgres -d saas

# Frontend shell
docker-compose exec frontend sh
```

### View Resource Usage
```bash
docker stats
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes database)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Troubleshooting

### Backend Won't Start

**Check database connection**
```bash
docker-compose logs database
docker-compose exec database pg_isready
```

**Check migrations**
```bash
docker-compose logs backend | grep migration
```

### Frontend Can't Connect to Backend

**Check environment variable**
```bash
docker-compose exec frontend cat /app/.env
```

**Check CORS configuration**
- Ensure `FRONTEND_URL` in backend/.env matches frontend origin

### Database Connection Issues

**Verify credentials**
```bash
docker-compose exec database psql -U postgres -d saas -c "SELECT 1"
```

**Check connection pool**
- Default max connections: 20
- Increase in `backend/src/config/database.js` if needed

### Port Conflicts

**Check if ports are in use**
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5000
netstat -ano | findstr :5432

# Kill process
taskkill /PID <pid> /F
```

## Performance Optimization

### Database Indexing
All `tenant_id` columns have indexes for fast filtering:
```sql
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
```

### Connection Pooling
PostgreSQL pool configuration:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Frontend Build Optimization
```bash
# Production build with optimizations
cd frontend
npm run build

# Serve with compression
docker-compose up -d  # Uses multi-stage build
```

## Security Best Practices

1. **JWT Secret**: Change `JWT_SECRET` in production
2. **Database Passwords**: Use strong passwords in production
3. **HTTPS**: Use reverse proxy (nginx) with SSL certificates
4. **Rate Limiting**: Add rate limiting middleware
5. **Input Validation**: Validate all user inputs
6. **SQL Injection**: Use parameterized queries (already implemented)
7. **XSS Protection**: React escapes content by default
8. **CORS**: Restrict `FRONTEND_URL` to specific domains

## Deployment Checklist

- [ ] Change all default passwords
- [ ] Update JWT_SECRET
- [ ] Configure production DATABASE_URL
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure domain names
- [ ] Set up database backups
- [ ] Configure logging
- [ ] Set up monitoring
- [ ] Test all API endpoints
- [ ] Test all frontend pages
- [ ] Verify multi-tenancy isolation
- [ ] Load test with multiple tenants
