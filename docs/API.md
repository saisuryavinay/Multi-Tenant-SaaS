# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Authentication Endpoints

### 1. Register Tenant
Create a new tenant organization with an admin user.

**Endpoint:** `POST /api/auth/register-tenant`

**Authentication:** None required

**Request Body:**
```json
{
  "tenantName": "Acme Corporation",
  "subdomain": "acme",
  "adminEmail": "admin@acme.com",
  "adminPassword": "SecurePass123!",
  "adminFullName": "John Doe"
}
```

**Validation Rules:**
- `tenantName`: Required, 2-100 characters
- `subdomain`: Required, 2-50 characters, alphanumeric + hyphens only, unique
- `adminEmail`: Required, valid email format, unique
- `adminPassword`: Required, minimum 8 characters
- `adminFullName`: Required, 2-100 characters

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 2,
      "email": "admin@acme.com",
      "fullName": "John Doe",
      "role": "tenant_admin",
      "tenant": {
        "id": 1,
        "name": "Acme Corporation",
        "subdomain": "acme",
        "subscriptionPlan": "free"
      }
    }
  },
  "message": "Tenant registered successfully"
}
```

**Error Responses:**
- `400`: Validation errors (missing fields, invalid format)
- `409`: Email or subdomain already exists
- `500`: Server error (database failure)

---

### 2. Login
Authenticate a user and receive a JWT token.

**Endpoint:** `POST /api/auth/login`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "admin@demo.com",
  "password": "Demo@123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@demo.com",
      "fullName": "Demo Admin",
      "role": "tenant_admin",
      "tenant": {
        "id": 1,
        "name": "Demo Tenant",
        "subdomain": "demo",
        "subscriptionPlan": "professional"
      }
    }
  },
  "message": "Login successful"
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `403`: User account is inactive or tenant is suspended
- `500`: Server error

---

### 3. Get Current User
Retrieve the authenticated user's details.

**Endpoint:** `GET /api/auth/me`

**Authentication:** Required (JWT)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@demo.com",
    "fullName": "Demo Admin",
    "role": "tenant_admin",
    "isActive": true,
    "tenant": {
      "id": 1,
      "name": "Demo Tenant",
      "subdomain": "demo",
      "status": "active",
      "subscriptionPlan": "professional"
    }
  }
}
```

**Error Responses:**
- `401`: Invalid or expired token
- `404`: User not found
- `500`: Server error

---

### 4. Logout
Log out the current user (logs audit event).

**Endpoint:** `POST /api/auth/logout`

**Authentication:** Required (JWT)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note:** Client should also remove token from storage.

---

## Tenant Management Endpoints

### 5. Get Tenant Details
Retrieve details of a specific tenant with statistics.

**Endpoint:** `GET /api/tenants/:id`

**Authentication:** Required (JWT)

**Authorization:**
- `super_admin`: Can access any tenant
- `tenant_admin` or `user`: Can only access their own tenant

**URL Parameters:**
- `id` (integer): Tenant ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Demo Tenant",
    "subdomain": "demo",
    "status": "active",
    "subscriptionPlan": "professional",
    "maxUsers": 50,
    "maxProjects": 100,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "stats": {
      "totalUsers": 3,
      "totalProjects": 2,
      "totalTasks": 5
    }
  }
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Access denied (cross-tenant access attempt)
- `404`: Tenant not found
- `500`: Server error

---

### 6. Update Tenant
Update tenant details.

**Endpoint:** `PUT /api/tenants/:id`

**Authentication:** Required (JWT)

**Authorization:**
- `super_admin`: Can update any field
- `tenant_admin`: Can only update `name`

**Request Body (super_admin):**
```json
{
  "name": "Updated Corporation Name",
  "status": "active",
  "subscriptionPlan": "enterprise",
  "maxUsers": 100,
  "maxProjects": 500
}
```

**Request Body (tenant_admin):**
```json
{
  "name": "Updated Corporation Name"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Corporation Name",
    "subdomain": "demo",
    "status": "active",
    "subscriptionPlan": "enterprise",
    "maxUsers": 100,
    "maxProjects": 500
  },
  "message": "Tenant updated successfully"
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Insufficient permissions or cross-tenant access
- `404`: Tenant not found
- `500`: Server error

---

### 7. List All Tenants
Retrieve a paginated list of all tenants (super_admin only).

**Endpoint:** `GET /api/tenants`

**Authentication:** Required (JWT)

**Authorization:** `super_admin` only

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 100): Items per page
- `status` (string, optional): Filter by status ('active', 'suspended', 'cancelled')
- `subscriptionPlan` (string, optional): Filter by plan ('free', 'basic', 'professional', 'enterprise')

**Example:** `GET /api/tenants?page=1&limit=20&status=active`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": 1,
        "name": "Demo Tenant",
        "subdomain": "demo",
        "status": "active",
        "subscriptionPlan": "professional",
        "maxUsers": 50,
        "maxProjects": 100,
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "name": "Acme Corporation",
        "subdomain": "acme",
        "status": "active",
        "subscriptionPlan": "free",
        "maxUsers": 5,
        "maxProjects": 3,
        "createdAt": "2024-01-16T14:20:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "pages": 1
    }
  }
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Insufficient permissions (not super_admin)
- `500`: Server error

---

## User Management Endpoints

### 8. Add User to Tenant
Create a new user within a tenant.

**Endpoint:** `POST /api/tenants/:tenantId/users`

**Authentication:** Required (JWT)

**Authorization:** `tenant_admin` only

**URL Parameters:**
- `tenantId` (integer): Tenant ID

**Request Body:**
```json
{
  "email": "newuser@demo.com",
  "password": "SecurePass123!",
  "fullName": "Jane Smith",
  "role": "user"
}
```

**Validation Rules:**
- `email`: Required, valid email, unique within tenant
- `password`: Required, minimum 8 characters
- `fullName`: Required, 2-100 characters
- `role`: Required, either 'user' or 'tenant_admin'

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "email": "newuser@demo.com",
    "fullName": "Jane Smith",
    "role": "user",
    "isActive": true,
    "tenantId": 1,
    "createdAt": "2024-01-20T09:15:00.000Z"
  },
  "message": "User created successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Insufficient permissions or user limit exceeded
- `409`: Email already exists in tenant
- `500`: Server error

---

### 9. List Tenant Users
Retrieve a paginated list of users in a tenant.

**Endpoint:** `GET /api/tenants/:tenantId/users`

**Authentication:** Required (JWT)

**Authorization:**
- `super_admin`: Can list any tenant's users
- `tenant_admin` or `user`: Can only list their own tenant's users

**URL Parameters:**
- `tenantId` (integer): Tenant ID

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 100): Items per page
- `search` (string, optional): Search by full name or email
- `role` (string, optional): Filter by role ('user', 'tenant_admin')

**Example:** `GET /api/tenants/1/users?page=1&limit=20&role=user&search=john`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 2,
        "email": "user1@demo.com",
        "full_name": "John User",
        "role": "user",
        "is_active": true,
        "created_at": "2024-01-15T11:00:00.000Z"
      },
      {
        "id": 3,
        "email": "user2@demo.com",
        "full_name": "Jane User",
        "role": "user",
        "is_active": true,
        "created_at": "2024-01-15T11:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "pages": 1
    }
  }
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Access denied (cross-tenant access)
- `404`: Tenant not found
- `500`: Server error

---

### 10. Update User
Update user details.

**Endpoint:** `PUT /api/users/:id`

**Authentication:** Required (JWT)

**Authorization:**
- Users can update their own `fullName` and `password`
- `tenant_admin` can update any user in their tenant
- `super_admin` can update any user

**URL Parameters:**
- `id` (integer): User ID

**Request Body (self-update):**
```json
{
  "fullName": "Updated Name",
  "password": "NewSecurePass123!"
}
```

**Request Body (admin update):**
```json
{
  "fullName": "Updated Name",
  "email": "newemail@demo.com",
  "role": "tenant_admin",
  "isActive": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "newemail@demo.com",
    "fullName": "Updated Name",
    "role": "tenant_admin",
    "isActive": true
  },
  "message": "User updated successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Insufficient permissions
- `404`: User not found
- `409`: Email already exists
- `500`: Server error

---

### 11. Delete User
Delete a user from the system.

**Endpoint:** `DELETE /api/users/:id`

**Authentication:** Required (JWT)

**Authorization:** `tenant_admin` only (cannot delete self)

**URL Parameters:**
- `id` (integer): User ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400`: Cannot delete yourself
- `401`: Not authenticated
- `403`: Insufficient permissions or cross-tenant deletion attempt
- `404`: User not found
- `500`: Server error

---

## Project Management Endpoints

### 12. Create Project
Create a new project in the tenant.

**Endpoint:** `POST /api/projects`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user

**Request Body:**
```json
{
  "name": "Website Redesign",
  "description": "Complete redesign of company website"
}
```

**Validation Rules:**
- `name`: Required, 2-200 characters
- `description`: Optional, max 1000 characters

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Website Redesign",
    "description": "Complete redesign of company website",
    "status": "active",
    "tenantId": 1,
    "createdBy": 1,
    "createdAt": "2024-01-20T10:00:00.000Z"
  },
  "message": "Project created successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Project limit exceeded for tenant's subscription plan
- `500`: Server error

---

### 13. List Projects
Retrieve a paginated list of projects in the tenant.

**Endpoint:** `GET /api/projects`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user (tenant-isolated)

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 100): Items per page
- `status` (string, optional): Filter by status ('active', 'completed', 'archived')
- `search` (string, optional): Search by project name

**Example:** `GET /api/projects?page=1&limit=20&status=active&search=website`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "name": "Mobile App Development",
        "description": "iOS and Android app",
        "status": "active",
        "created_by": 1,
        "creator_name": "Demo Admin",
        "created_at": "2024-01-15T12:00:00.000Z",
        "taskCount": 3,
        "completedTaskCount": 1
      },
      {
        "id": 2,
        "name": "API Integration",
        "description": "Third-party API integration",
        "status": "active",
        "created_by": 1,
        "creator_name": "Demo Admin",
        "created_at": "2024-01-16T09:30:00.000Z",
        "taskCount": 2,
        "completedTaskCount": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "pages": 1
    }
  }
}
```

**Error Responses:**
- `401`: Not authenticated
- `500`: Server error

---

### 14. Update Project
Update project details.

**Endpoint:** `PUT /api/projects/:id`

**Authentication:** Required (JWT)

**Authorization:**
- Project creator can update their own projects
- `tenant_admin` can update any project in their tenant

**URL Parameters:**
- `id` (integer): Project ID

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "status": "completed"
}
```

**Validation Rules:**
- `name`: Optional, 2-200 characters
- `description`: Optional, max 1000 characters
- `status`: Optional, one of 'active', 'completed', 'archived'

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Project Name",
    "description": "Updated description",
    "status": "completed",
    "tenantId": 1,
    "createdBy": 1,
    "updatedAt": "2024-01-20T11:00:00.000Z"
  },
  "message": "Project updated successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Insufficient permissions
- `404`: Project not found
- `500`: Server error

---

### 15. Delete Project
Delete a project and all its tasks (CASCADE).

**Endpoint:** `DELETE /api/projects/:id`

**Authentication:** Required (JWT)

**Authorization:**
- Project creator can delete their own projects
- `tenant_admin` can delete any project in their tenant

**URL Parameters:**
- `id` (integer): Project ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Insufficient permissions
- `404`: Project not found
- `500`: Server error

---

## Task Management Endpoints

### 16. Create Task
Create a new task within a project.

**Endpoint:** `POST /api/projects/:projectId/tasks`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user in the tenant

**URL Parameters:**
- `projectId` (integer): Project ID

**Request Body:**
```json
{
  "title": "Design homepage mockup",
  "description": "Create wireframes and high-fidelity mockups",
  "priority": "high",
  "assignedTo": 2,
  "dueDate": "2024-02-01"
}
```

**Validation Rules:**
- `title`: Required, 2-200 characters
- `description`: Optional, max 1000 characters
- `priority`: Required, one of 'low', 'medium', 'high'
- `assignedTo`: Optional, must be a valid user ID in the same tenant
- `dueDate`: Optional, valid date format (YYYY-MM-DD)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "projectId": 1,
    "title": "Design homepage mockup",
    "description": "Create wireframes and high-fidelity mockups",
    "status": "todo",
    "priority": "high",
    "assignedTo": 2,
    "dueDate": "2024-02-01",
    "createdAt": "2024-01-20T12:00:00.000Z"
  },
  "message": "Task created successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Project not in user's tenant or assigned user not in tenant
- `404`: Project not found
- `500`: Server error

---

### 17. List Tasks
Retrieve all tasks for a specific project.

**Endpoint:** `GET /api/projects/:projectId/tasks`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user in the tenant

**URL Parameters:**
- `projectId` (integer): Project ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 1,
        "project_id": 1,
        "title": "Setup development environment",
        "description": "Install tools and dependencies",
        "status": "completed",
        "priority": "high",
        "assigned_to": 2,
        "assignedTo": {
          "id": 2,
          "fullName": "John User"
        },
        "due_date": "2024-01-18",
        "created_at": "2024-01-15T13:00:00.000Z"
      },
      {
        "id": 2,
        "project_id": 1,
        "title": "Design database schema",
        "description": null,
        "status": "in_progress",
        "priority": "high",
        "assigned_to": null,
        "assignedTo": null,
        "due_date": null,
        "created_at": "2024-01-15T13:15:00.000Z"
      }
    ]
  }
}
```

**Note:** Tasks are ordered by priority (high → low) then by due date.

**Error Responses:**
- `401`: Not authenticated
- `403`: Project not in user's tenant
- `404`: Project not found
- `500`: Server error

---

### 18. Update Task Status
Update only the status of a task.

**Endpoint:** `PATCH /api/tasks/:id/status`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user in the tenant

**URL Parameters:**
- `id` (integer): Task ID

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Validation Rules:**
- `status`: Required, one of 'todo', 'in_progress', 'completed'

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "projectId": 1,
    "title": "Design database schema",
    "status": "in_progress",
    "priority": "high",
    "updatedAt": "2024-01-20T14:00:00.000Z"
  },
  "message": "Task status updated successfully"
}
```

**Error Responses:**
- `400`: Invalid status value
- `401`: Not authenticated
- `403`: Task not in user's tenant
- `404`: Task not found
- `500`: Server error

---

### 19. Update Task
Update all task details.

**Endpoint:** `PUT /api/tasks/:id`

**Authentication:** Required (JWT)

**Authorization:** Any authenticated user in the tenant

**URL Parameters:**
- `id` (integer): Task ID

**Request Body:**
```json
{
  "title": "Updated task title",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "medium",
  "assignedTo": 3,
  "dueDate": "2024-02-15"
}
```

**Validation Rules:**
- All fields are optional
- Same validation rules as task creation for provided fields

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "projectId": 1,
    "title": "Updated task title",
    "description": "Updated description",
    "status": "in_progress",
    "priority": "medium",
    "assignedTo": 3,
    "dueDate": "2024-02-15",
    "updatedAt": "2024-01-20T15:00:00.000Z"
  },
  "message": "Task updated successfully"
}
```

**Error Responses:**
- `400`: Validation errors
- `401`: Not authenticated
- `403`: Task not in user's tenant or assigned user not in tenant
- `404`: Task not found
- `500`: Server error

---

## Error Codes Reference

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 400 | Bad Request | Missing required fields, validation errors |
| 401 | Unauthorized | Missing token, expired token, invalid token |
| 403 | Forbidden | Insufficient role permissions, tenant isolation violation |
| 404 | Not Found | Resource doesn't exist or not in user's tenant |
| 409 | Conflict | Unique constraint violation (email, subdomain) |
| 500 | Internal Server Error | Database error, unexpected server issue |

## Rate Limiting

Currently not implemented. Recommended for production:
- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user

## Pagination

All list endpoints support pagination with these query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

## Multi-Tenancy Isolation

All endpoints automatically filter data by the authenticated user's `tenant_id`:
- Users can only see data from their own tenant
- `super_admin` users (tenant_id = NULL) can access all tenant data
- Cross-tenant access attempts return 403 or 404 errors

## JWT Token Structure

```json
{
  "userId": 1,
  "tenantId": 1,
  "role": "tenant_admin",
  "iat": 1705751234,
  "exp": 1705837634
}
```

- **iat**: Issued at (Unix timestamp)
- **exp**: Expiry (24 hours after issue)

## Postman Collection

Import this base configuration for testing:

```json
{
  "info": {
    "name": "Multi-Tenant SaaS API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000/api"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

Set the `token` variable after login and use `{{baseUrl}}` and `{{token}}` in requests.
