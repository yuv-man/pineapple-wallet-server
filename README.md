# Pineapple Wallet Backend

A comprehensive NestJS backend API for managing personal financial portfolios and assets. Pineapple Wallet allows users to track various types of assets, organize them into portfolios, and share portfolios with others.

## 🍍 Features

### Authentication & Authorization
- **Multiple Auth Methods**: Support for local email/password, Google OAuth, and GitHub OAuth
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Session Management**: Logout functionality with refresh token invalidation

### Portfolio Management
- Create, read, update, and delete portfolios
- Organize assets into multiple portfolios
- Track portfolio metadata (name, description)

### Asset Tracking
- **Multiple Asset Types**: Support for various asset categories:
  - Bank Accounts
  - Real Estate
  - Cryptocurrency
  - Stocks
  - General Investments
- **Value Tracking**: Store asset values with currency support
- **Value History**: Track historical asset values over time
- **Flexible Details**: Store type-specific asset details as JSON

### Portfolio Sharing
- Share portfolios with other users
- **Permission Levels**: VIEW or EDIT permissions
- **Invitation System**: Send invitations that can be accepted or declined
- **Share Management**: Update permissions or revoke shares

### Currency Support
- Multi-currency asset tracking
- Default currency: USD

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Passport.js with JWT, Google OAuth, GitHub OAuth
- **Validation**: class-validator & class-transformer
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL database
- npm or yarn package manager

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Environment Mode: 'dev' for development, 'prod' for production
ENV_MODE=dev

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pineapple_wallet?schema=public"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_REFRESH_SECRET="your-refresh-secret-key-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# OAuth - Google
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OAuth - GitHub
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Application
PORT=5001

# Frontend URLs (used based on ENV_MODE)
DEV_URL="http://localhost:3000"
PROD_URL="https://your-production-frontend-domain.com"
```

**Important Notes:**
- Set `ENV_MODE=dev` for local development
- Set `ENV_MODE=prod` for production deployment
- The application will use `DEV_URL` when `ENV_MODE=dev` and `PROD_URL` when `ENV_MODE=prod`
- Never commit your `.env` file to version control

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Or push schema directly (development)
npm run db:push
```

### 4. Start the Server

#### Development Mode

1. Set `ENV_MODE=dev` in your `.env` file
2. Start the development server:
```bash
npm run start:dev
```

This will:
- Use `DEV_URL` for CORS configuration
- Enable hot-reload with watch mode
- Show detailed error messages
- Allow CORS from `DEV_URL` or all origins

The API will be available at `http://localhost:5001/api`

#### Production Mode

1. Set `ENV_MODE=prod` in your `.env` file
2. Build the application:
```bash
npm run build
```

3. Run migrations (if needed):
```bash
npm run prisma:migrate:prod
```

4. Start the production server:
```bash
npm run start:prod
```

This will:
- Use `PROD_URL` for CORS configuration
- Hide detailed error messages
- Use strict CORS (only `PROD_URL` allowed)
- Run optimized production build

## 📚 API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate refresh token
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/me` - Get current user info (protected)

### Users (`/api/users`)
- `GET /api/users/:id` - Get user by ID (protected)
- `PATCH /api/users/:id` - Update user (protected)
- `DELETE /api/users/:id` - Delete user (protected)

### Portfolios (`/api/portfolios`)
- `POST /api/portfolios` - Create a new portfolio (protected)
- `GET /api/portfolios` - Get all user's portfolios (protected)
- `GET /api/portfolios/:id` - Get portfolio by ID (protected)
- `PATCH /api/portfolios/:id` - Update portfolio (protected)
- `DELETE /api/portfolios/:id` - Delete portfolio (protected)

### Assets (`/api/assets`)
- `POST /api/assets` - Create a new asset (protected)
- `GET /api/assets` - Get all assets (protected)
- `GET /api/assets/:id` - Get asset by ID (protected)
- `PATCH /api/assets/:id` - Update asset (protected)
- `DELETE /api/assets/:id` - Delete asset (protected)

### Sharing (`/api`)
- `POST /api/portfolios/:portfolioId/share` - Share portfolio with user (protected)
- `GET /api/portfolios/:portfolioId/shares` - Get shares for portfolio (protected)
- `GET /api/invitations` - Get pending invitations (protected)
- `PATCH /api/invitations/:id` - Respond to invitation (protected)
- `PATCH /api/shares/:id` - Update share permissions (protected)
- `DELETE /api/shares/:id` - Revoke share (protected)
- `GET /api/shared-with-me` - Get portfolios shared with current user (protected)

### Currency (`/api/currency`)
- `GET /api/currency` - Get currency information

## 🗄️ Database Schema

### Models

**User**
- Basic user information
- Support for multiple auth providers (local, Google, GitHub)
- Refresh token management

**Portfolio**
- User-owned portfolio containers
- Contains multiple assets
- Can be shared with other users

**Asset**
- Belongs to a portfolio
- Supports multiple types (BANK_ACCOUNT, REAL_ESTATE, CRYPTO, STOCK, INVESTMENT)
- Stores value, currency, and type-specific details
- Tracks value history over time

**PortfolioShare**
- Manages sharing relationships between users and portfolios
- Permission levels: VIEW, EDIT
- Share status: PENDING, ACCEPTED, DECLINED

**AssetValueHistory**
- Historical tracking of asset values
- Timestamped value records

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Refresh token rotation
- CORS configuration
- Input validation and sanitization
- Protected routes with guards

## 📝 Development Scripts

```bash
# Development
npm run start:dev          # Start development server with watch mode
npm run start:debug        # Start with debug mode

# Production
npm run build              # Build for production
npm run start:prod         # Start production server

# Database
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations (development)
npm run prisma:migrate:prod # Run migrations (production)
npm run prisma:studio      # Open Prisma Studio
npm run db:push            # Push schema to database

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format code with Prettier
```

## 🌍 Environment Modes

The application uses the `ENV_MODE` variable in your `.env` file to determine the environment.

### Development Mode (`ENV_MODE=dev`)
- Uses `DEV_URL` for CORS configuration
- Detailed error messages and stack traces
- Hot-reload enabled
- More permissive CORS settings
- Debug logging enabled

### Production Mode (`ENV_MODE=prod`)
- Uses `PROD_URL` for CORS configuration
- Minimal error messages (security)
- Strict CORS (only `PROD_URL` allowed)
- Optimized performance
- Error details hidden from clients

## 🏗️ Project Structure

```
src/
├── app.module.ts          # Root application module
├── main.ts                # Application entry point
├── auth/                  # Authentication module
│   ├── guards/            # Auth guards (JWT, OAuth, Local)
│   ├── strategies/        # Passport strategies
│   └── dto/               # Auth DTOs
├── users/                 # User management module
├── portfolios/            # Portfolio management module
├── assets/                # Asset management module
├── sharing/               # Portfolio sharing module
├── currency/              # Currency information module
└── prisma/                # Prisma service and module
```

## 🔄 Authentication Flow

1. **Local Auth**: User registers/logs in with email and password
2. **OAuth Flow**: User clicks Google/GitHub login → redirected to provider → callback → tokens issued
3. **Token Refresh**: Use refresh token to get new access token
4. **Protected Routes**: Include `Authorization: Bearer <accessToken>` header

## 📦 Dependencies

### Core
- `@nestjs/common`, `@nestjs/core` - NestJS framework
- `@prisma/client` - Prisma ORM client
- `passport`, `passport-jwt`, `passport-local` - Authentication
- `passport-google-oauth20`, `passport-github2` - OAuth providers
- `bcrypt` - Password hashing
- `class-validator`, `class-transformer` - Validation

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

MIT

