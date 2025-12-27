# System Architecture

## Overview
This multi-tenant SaaS platform is built on a three-tier architecture with complete data isolation, JWT-based authentication, and Docker containerization for seamless deployment.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Layer                       │
│  React 18 SPA (Port 3000)                                   │
│  - Authentication UI                                         │
│  - Dashboard & Analytics                                    │
│  - Project & Task Management                                │
│  - User Management (Admin)                                  │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS/REST API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                       Application Layer                      │
│  Node.js + Express.js API (Port 5000)                      │
│  ┌─────────────────┬──────────────────┬─────────────────┐ │
│  │ Auth Controller │ Tenant Controller│ User Controller │ │
│  └─────────────────┴──────────────────┴─────────────────┘ │
│  ┌─────────────────┬──────────────────┐                   │
│  │Project Ctrl     │ Task Controller   │                   │
│  └─────────────────┴──────────────────┘                   │
│  - JWT Middleware                                          │
│  - Role-Based Authorization                                │
│  - Multi-Tenant Data Isolation                             │
│  - Audit Logging                                           │
└────────────────┬────────────────────────────────────────────┘
                 │ SQL Queries
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                        Database Layer                        │
│  PostgreSQL 15 (Port 5432)                                  │
│  ┌─────────┬────────┬──────────┬────────┬──────────────┐  │
│  │ tenants │ users  │ projects │ tasks  │ audit_logs   │  │
│  └─────────┴────────┴──────────┴────────┴──────────────┘  │
│  - Multi-Tenant Schema with tenant_id                       │
│  - Foreign Key Constraints (CASCADE)                        │
│  - Indexes on tenant_id columns                             │
└─────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy Architecture

### Data Isolation Strategy
We implement a **Shared Database, Shared Schema** approach with tenant-based filtering:

1. **Tenant Identification**: Every table (except `tenants`) has a `tenant_id` column
2. **Query Filtering**: All queries automatically filter by the authenticated user's `tenant_id`
3. **Super Admin Access**: Users with `tenant_id = NULL` can access all tenant data
4. **Database Constraints**: Foreign keys enforce referential integrity within tenants

### Tenant Hierarchy
```
Super Admin (tenant_id = NULL)
    └── Manages all tenants globally
        
Tenant 1 (id = 1)
    ├── Tenant Admin (role = tenant_admin)
    └── Regular Users (role = user)
        ├── Projects (tenant_id = 1)
        └── Tasks (tenant_id = 1 via projects)

Tenant 2 (id = 2)
    ├── Tenant Admin (role = tenant_admin)
    └── Regular Users (role = user)
        ├── Projects (tenant_id = 2)
        └── Tasks (tenant_id = 2 via projects)
```

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐
│   tenants    │
│──────────────│
│ id (PK)      │◄──────────┐
│ name         │            │
│ subdomain    │            │ FK tenant_id
│ status       │            │
│ subscription │            │
│ max_users    │            │
│ max_projects │            │
└──────────────┘            │
                            │
┌──────────────┐            │
│    users     │            │
│──────────────│            │
│ id (PK)      │            │
│ tenant_id    │────────────┘
│ email        │
│ password_hash│            ┌──────────────┐
│ full_name    │            │  projects    │
│ role         │            │──────────────│
│ is_active    │            │ id (PK)      │
└──────┬───────┘            │ tenant_id    │───────┐
       │                    │ name         │       │
       │ FK created_by      │ description  │       │
       │                    │ status       │       │
       └────────────────────┤ created_by   │       │
                            └──────┬───────┘       │
                                   │               │
                                   │ FK project_id │
                            ┌──────▼───────┐       │
                            │    tasks     │       │
                            │──────────────│       │
                            │ id (PK)      │       │
                            │ project_id   │───────┘
                            │ title        │
                            │ description  │
                            │ status       │
                            │ priority     │
                            │ assigned_to  │───┐
                            │ due_date     │   │
                            └──────────────┘   │
                                               │
                                               └── FK to users.id

┌──────────────┐
│  audit_logs  │
│──────────────│
│ id (PK)      │
│ tenant_id    │
│ user_id      │
│ action       │
│ entity_type  │
│ entity_id    │
│ details      │
│ ip_address   │
│ timestamp    │
└──────────────┘
```

### Table Details

#### tenants
- **Purpose**: Store tenant organization information and subscription limits
- **Key Columns**:
  - `subscription_plan`: enum('free', 'basic', 'professional', 'enterprise')
  - `status`: enum('active', 'suspended', 'cancelled')
  - `subdomain`: Unique identifier for tenant (e.g., 'demo', 'acme')
  - `max_users`, `max_projects`: Subscription-based limits

#### users
- **Purpose**: User accounts with multi-tenant support
- **Key Columns**:
  - `tenant_id`: NULL for super_admin, otherwise references tenants(id)
  - `role`: enum('super_admin', 'tenant_admin', 'user')
  - `password_hash`: Bcrypt-hashed password (salt rounds: 10)
  - `is_active`: Soft delete flag

#### projects
- **Purpose**: Project containers for tasks
- **Key Columns**:
  - `tenant_id`: References tenants(id) ON DELETE CASCADE
  - `created_by`: References users(id) ON DELETE SET NULL
  - `status`: enum('active', 'completed', 'archived')

#### tasks
- **Purpose**: Work items within projects
- **Key Columns**:
  - `project_id`: References projects(id) ON DELETE CASCADE
  - `status`: enum('todo', 'in_progress', 'completed')
  - `priority`: enum('low', 'medium', 'high')
  - `assigned_to`: References users(id) ON DELETE SET NULL (nullable)

#### audit_logs
- **Purpose**: Security and compliance audit trail
- **Key Columns**:
  - `action`: enum('create', 'update', 'delete', 'login', 'logout')
  - `entity_type`: enum('tenant', 'user', 'project', 'task')
  - `details`: JSONB field with change details
  - `ip_address`: Client IP for security tracking

## API Architecture

### Authentication Flow
```
1. User Registration → POST /api/auth/register-tenant
   - Creates tenant + admin user atomically (transaction)
   - Returns JWT token with {userId, tenantId, role}

2. User Login → POST /api/auth/login
   - Verifies credentials
   - Checks tenant status (must be 'active')
   - Returns JWT token (24h expiry)

3. Protected Request → GET /api/projects
   - Client sends: Authorization: Bearer <token>
   - Middleware verifies JWT signature
   - Extracts {userId, tenantId, role}
   - Controller filters data by tenantId
   - Returns tenant-isolated results
```

### Authorization Levels

| Role         | Permissions |
|--------------|-------------|
| super_admin  | Full access to all tenants, create/update/delete any resource |
| tenant_admin | Manage users, projects, tasks within own tenant, update tenant details |
| user         | View/create projects and tasks, update assigned tasks |

### Middleware Stack
```
Request → CORS → Body Parser → JWT Verify → Role Check → Controller → Response
```

## API Endpoints

### Authentication (4 endpoints)
- `POST /api/auth/register-tenant` - Register new tenant with admin user
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user details with tenant info
- `POST /api/auth/logout` - Logout and log audit event

### Tenant Management (3 endpoints)
- `GET /api/tenants/:id` - Get tenant details with stats (users, projects, tasks)
- `PUT /api/tenants/:id` - Update tenant details (role-based field restrictions)
- `GET /api/tenants` - List all tenants (super_admin only, with pagination)

### User Management (4 endpoints)
- `POST /api/tenants/:tenantId/users` - Add user to tenant (checks subscription limits)
- `GET /api/tenants/:tenantId/users` - List tenant users (pagination, search, role filter)
- `PUT /api/users/:id` - Update user details (self-edit or tenant_admin)
- `DELETE /api/users/:id` - Delete user (prevents self-deletion)

### Project Management (4 endpoints)
- `POST /api/projects` - Create project (checks max_projects limit)
- `GET /api/projects` - List projects with task counts (tenant-isolated)
- `PUT /api/projects/:id` - Update project (creator or tenant_admin)
- `DELETE /api/projects/:id` - Delete project (CASCADE deletes tasks)

### Task Management (4 endpoints)
- `POST /api/projects/:projectId/tasks` - Create task (validates assignee)
- `GET /api/projects/:projectId/tasks` - List tasks (ordered by priority, due_date)
- `PATCH /api/tasks/:id/status` - Update task status
- `PUT /api/tasks/:id` - Update task details (validates project ownership)

## Security Architecture

### Authentication
- **JWT Tokens**: HS256 algorithm, 24-hour expiry
- **Password Hashing**: Bcrypt with 10 salt rounds
- **Token Storage**: Frontend stores in localStorage
- **Token Refresh**: Manual re-login required after expiry

### Authorization
- **Tenant Isolation**: All queries filter by `req.user.tenantId`
- **Role-Based Access**: Middleware checks `req.user.role` before controller execution
- **Resource Ownership**: Controllers verify creator/assignee relationships
- **Cross-Tenant Prevention**: Foreign key constraints + query filtering

### Audit Logging
- **Logged Actions**: create, update, delete, login, logout
- **Logged Data**: userId, tenantId, entityType, entityId, changes (JSONB), IP address
- **Use Cases**: Security forensics, compliance reporting, user activity tracking

## Deployment Architecture

### Docker Compose Services
```yaml
database:
  - PostgreSQL 15 alpine
  - Port: 5432:5432
  - Health Check: pg_isready
  - Volume: postgres_data

backend:
  - Node.js 18 alpine
  - Port: 5000:5000
  - Depends on: database (healthy)
  - Health Check: wget /api/health
  - Auto-runs: migrations → seeds → server

frontend:
  - Node.js 18 alpine (build) → serve
  - Port: 3000:3000
  - Depends on: backend (healthy)
  - Serves: Static React build
```

### Environment Variables

| Service  | Variable           | Purpose |
|----------|--------------------|---------|
| database | POSTGRES_USER      | Database user |
| database | POSTGRES_PASSWORD  | Database password |
| database | POSTGRES_DB        | Database name |
| backend  | DATABASE_URL       | PostgreSQL connection string |
| backend  | JWT_SECRET         | JWT signing key |
| backend  | FRONTEND_URL       | CORS origin |
| frontend | REACT_APP_API_URL  | Backend API base URL |

### Startup Sequence
```
1. Database starts → Health check passes
2. Backend starts → Waits 10s → Runs migrations → Runs seeds → Starts server
3. Frontend starts → Waits for backend health → Serves React app
```

## Scalability Considerations

### Current Architecture
- **Vertical Scaling**: Increase database/backend resources
- **Connection Pooling**: PostgreSQL pool (max 20 connections)
- **Stateless API**: Horizontal scaling possible with load balancer
- **Docker Ready**: Easy replication across environments

### Future Enhancements
- **Database Read Replicas**: Separate read-only instances
- **Redis Caching**: Cache tenant configs, user sessions
- **CDN for Frontend**: Serve static assets globally
- **Message Queue**: Asynchronous task processing (emails, reports)
- **Multi-Database**: Separate database per tenant (schema-per-tenant or database-per-tenant)

## Technology Justification

### PostgreSQL
- **Why**: ACID compliance, excellent multi-tenancy support, JSONB for flexible data
- **Alternatives Considered**: MySQL (less JSON support), MongoDB (harder multi-tenancy)

### Node.js + Express
- **Why**: JavaScript full-stack, large ecosystem, excellent async I/O
- **Alternatives Considered**: Python/Django (slower development), Java/Spring (heavier)

### React
- **Why**: Component reusability, large community, excellent tooling
- **Alternatives Considered**: Vue (smaller ecosystem), Angular (steeper learning curve)

### JWT Authentication
- **Why**: Stateless, scales horizontally, no session storage needed
- **Alternatives Considered**: Session-based (requires Redis/sticky sessions)

### Docker
- **Why**: Consistent environments, easy deployment, service isolation
- **Alternatives Considered**: Direct installation (environment drift), Kubernetes (overkill for MVP)


























































