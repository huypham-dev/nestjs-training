# Blog API

RESTful API built with NestJS. Features modular architecture, JWT authentication via Clerk, and PostgreSQL database with MikroORM.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Nest.js
- **Database**: PostgreSQL
- **ORM**: MikroORM
- **Authentication**: Clerk (JWT)
- **Testing**: Jest, Postman
- **Documentation**: Swagger
- **Package Manager**: pnpm

## Folder Structure

```
src/
├── common/                      # Common utilities & infrastructure
│   ├── decorators/              # Custom decorators
│   ├── entities/                # Base entities
│   ├── exceptions/              # Custom exception classes
│   ├── filters/                 # Exception filters
│   ├── guards/                  # Auth guards
│   ├── interceptors/            # HTTP interceptors
│   ├── interfaces/              # Common interfaces
│   ├── middlewares/             # Request middlewares
│   ├── pipes/                   # Validation pipes
│   └── services/                # Common services (cache, etc.)
├── config/                      # App configuration
│   └── database.config.ts       # Database connection config
├── constants/                   # Enums, status codes, error codes
├── database/                    # Database files
│   ├── migrations/              # MikroORM migrations
│   └── seeders/                 # Database seeders
├── modules/                     # Feature modules
│   ├── category/                # Category module
│   ├── post/                    # Post module
│   ├── user/                    # User module
│   └── webhook/                 # Webhook handlers
├── shared/                      # Shared services & utilities
│   ├── services/                # Shared services
│   │   ├── clerk.service.ts     # Clerk authentication
│   │   ├── storage.service.ts   # S3 storage & image processing
│   │   └── index.ts
│   └── shared.module.ts         # Global shared module
├── types/                       # TypeScript declarations
│   └── express.d.ts             # Express type extensions
├── app.module.ts                # Root application module
└── main.ts                      # Application entry point
```

## Environment Variables

| Variable                | Description           | Example                  |
| ----------------------- | --------------------- | ------------------------ |
| `NODE_ENV`              | Environment           | `development`            |
| `PORT`                  | Server port           | `3000`                   |
| `DATABASE_HOST`         | PostgreSQL host       | `localhost`              |
| `DATABASE_PORT`         | PostgreSQL port       | `5432`                   |
| `DATABASE_NAME`         | Database name         | `blog_db`                |
| `DATABASE_USER`         | Database user         | `postgres`               |
| `DATABASE_PASSWORD`     | Database password     | `postgres`               |
| `API_BASE_PATH`         | API base path         | `api`                    |
| `API_VERSION`           | API version           | `1`                      |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key      | `pk_test_...`            |
| `CLERK_SECRET_KEY`      | Clerk secret key      | `sk_test_...`            |
| `CLERK_WEBHOOK_SECRET`  | Clerk webhook secret  | `whsec_...`              |
| `AWS_REGION`            | AWS S3 region         | `us-east-1`              |
| `AWS_ACCESS_KEY_ID`     | AWS access key        | `your_aws_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `your_aws_secret_key`    |
| `AWS_S3_BUCKET`         | S3 bucket name        | `your-bucket-name`       |
| `THROTTLE_TTL`          | Rate limit TTL (ms)   | `900000`                 |
| `THROTTLE_LIMIT`        | Max requests per TTL  | `100`                    |
| `REDIS_HOST`            | Redis host            | `localhost`              |
| `REDIS_PORT`            | Redis port            | `6379`                   |

## Getting Started

**Prerequisites**: Node.js 18+, PostgreSQL, Redis, pnpm

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start Redis (required for scheduled posts feature)
redis-server

# Run migrations
pnpm migration:up

# Start development server
pnpm start:dev
```

Server runs at `http://localhost:8000`

## Database & Migrations

**ORM**: MikroORM with PostgreSQL driver

**Common Database Commands**:

```bash
# Migrations
pnpm migration:create   # Create new migration
pnpm migration:up       # Run pending migrations
pnpm migration:down     # Rollback last migration
pnpm migration:fresh    # Drop schema & run all migrations

# Schema Management
pnpm schema:update      # Update schema (dev only)
pnpm schema:fresh       # Fresh schema (dev only)

# Seeders
pnpm seeder:run         # Run all seeders
pnpm seeder:create      # Create new seeder
pnpm db:fresh           # Fresh schema + seeders

# Cache
pnpm cache:clear        # Clear MikroORM cache
```

**Available Seeders**:

- `DatabaseSeeder` - Main seeder that runs all seeders
- `CategorySeeder` - Seeds categories
- `PostSeeder` - Seeds posts with relationships

## API Documentation

Access Swagger UI at: `http://localhost:8000/api/v1/docs`

**Available API Modules**:

- **Users** (`/api/v1/users`) - User management
- **Posts** (`/api/v1/posts`) - Blog posts with image upload
- **Categories** (`/api/v1/categories`) - Post categories
- **Webhooks** (`/api/v1/webhooks`) - Clerk webhook handlers

**Common Headers**:

```
Content-Type: application/json
Authorization: Bearer <clerk_jwt_token>
```

**Features**:

- JWT authentication via Clerk
- Rate limiting with throttling
- File upload support (multipart/form-data)
- Image processing & S3 storage
- Pagination & search filters
- Role-based access control (RBAC)

## Example API Request

**Get Current User**

```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <your_clerk_jwt>"
```

**Response**:

```json
{
  "data": {
    "id": "uuid",
    "authId": "clerk_user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "status": "active",
    "createdAt": "2026-01-15T00:00:00.000Z",
    "updatedAt": "2026-01-15T00:00:00.000Z"
  }
}
```

## Features

### Core Features

- ✅ RESTful API with NestJS
- ✅ PostgreSQL database with MikroORM
- ✅ JWT authentication via Clerk
- ✅ Role-based access control (RBAC)
- ✅ Swagger/OpenAPI documentation
- ✅ Request validation with Zod
- ✅ Global exception handling
- ✅ Response transformation interceptors

### Advanced Features

- ✅ Image upload & processing with Sharp
- ✅ AWS S3 storage integration
- ✅ Rate limiting & throttling
- ✅ Database migrations & seeders
- ✅ Unit & E2E testing
- ✅ Code formatting with Prettier
- ✅ Linting with ESLint
- ✅ Git hooks with Husky
- ✅ Commit linting with CommitLint

## Scripts

```bash
# Development
pnpm start:dev          # Start with hot-reload
pnpm start:debug        # Start with debugger

# Build
pnpm build              # Compile TypeScript

# Production
pnpm start:prod         # Run compiled code

# Database Migrations
pnpm migration:create   # Create new migration
pnpm migration:up       # Run migrations
pnpm migration:down     # Rollback migration
pnpm migration:fresh    # Drop schema & run all migrations
pnpm schema:update      # Update schema (dev only)
pnpm schema:fresh       # Fresh schema (dev only)

# Database Seeders
pnpm seeder:run         # Run all seeders
pnpm seeder:create      # Create new seeder
pnpm db:fresh           # Fresh schema + run seeders

# Code Quality
pnpm lint               # Check & fix linting
pnpm format             # Format code with Prettier

# Testing
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage
pnpm test:e2e           # Run E2E tests
pnpm test:debug         # Run tests with debugger

# Cache
pnpm cache:clear        # Clear MikroORM cache
```

## 👨‍💻 Author

Huy Pham

**Happy Coding! 🚀**
