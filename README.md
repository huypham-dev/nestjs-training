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
├── config/              # App configuration
├── constants/           # Enums, status codes, error codes
├── database/            # DB config, migrations
├── exceptions/          # Custom exception classes
├── middlewares/         # Auth, error handler, entity manager
├── modules/             # Feature modules
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.routes.ts
│   └── user/
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.entity.ts
│       ├── user.repo.ts
│       └── user.routes.ts
├── shared/              # Shared DTOs, helpers, errors
├── types/               # TypeScript declarations
├── utils/               # Utility functions
├── validators/          # Input validation schemas
├── routes.ts            # API route aggregator
└── server.ts            # App entry point
```

## Environment Variables

| Variable                | Description       | Example                 |
| ----------------------- | ----------------- | ----------------------- |
| `NODE_ENV`              | Environment       | `development`           |
| `PORT`                  | Server port       | `3000`                  |
| `HOST`                  | Server host       | `localhost`             |
| `DB_HOST`               | PostgreSQL host   | `localhost`             |
| `DB_PORT`               | PostgreSQL port   | `5432`                  |
| `DB_NAME`               | Database name     | `blog_api`              |
| `DB_USER`               | Database user     | `postgres`              |
| `DB_PASSWORD`           | Database password | `password`              |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key  | `pk_test_...`           |
| `CLERK_SECRET_KEY`      | Clerk secret key  | `sk_test_...`           |
| `CORS_ORIGIN`           | Allowed origins   | `http://localhost:3000` |
| `API_BASE_PATH`         | API base path     | `/api`                  |
| `API_VERSION`           | API version       | `v1`                    |

## Getting Started

**Prerequisites**: Node.js 18+, PostgreSQL, pnpm

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Run migrations
pnpm migration:up

# Start development server
pnpm start:dev
```

Server runs at `http://localhost:3000`

## Database & Migrations

**ORM**: MikroORM with PostgreSQL driver

**Migrations**:

```bash
# Create migration
pnpm migration:create

# Run migrations
pnpm migration:up

# Rollback migration
pnpm migration:down

# List migrations
pnpm migration:list
```

**Note**: Migrations use `NODE_OPTIONS='--import tsx'` for TypeScript support in ES modules.

## API Documentation

Access Swagger UI at: `http://localhost:3000/api/v1/docs/swagger`

**Common Headers**:

```
Content-Type: application/json
Authorization: Bearer <clerk_jwt_token>
```

## Example API Request

**Get Current User**

```bash
curl -X GET http://localhost:3000/api/v1/users/me \
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

## Scripts

```bash
# Development
pnpm dev                 # Start with hot-reload

# Build
pnpm build              # Compile TypeScript

# Production
pnpm start              # Run compiled code

# Database
pnpm migration:create   # Create new migration
pnpm migration:up       # Run migrations
pnpm migration:down     # Rollback migration
pnpm schema:update      # Update schema (dev only)

# Code Quality
pnpm lint               # Check linting
pnpm lint:fix           # Fix linting issues
pnpm format             # Format code
pnpm format:check       # Check formatting

# Testing
pnpm test               # Run Jest tests
```

## 👨‍💻 Author

Huy Pham

**Happy Coding! 🚀**
