# Groupool Backend

REST API for Groupool — a group pooling and financial collaboration platform. Built with **Fastify**, **Drizzle ORM**, **PostgreSQL**, and **TypeScript**.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify v5
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (with SSL)
- **Validation**: Zod v4
- **Auth**: JWT (HS256) + OTP via WhatsApp (Meta Business API)

## Project Structure

```
src/
├── app.ts                # Fastify app setup (CORS, rate limiting, routes)
├── server.ts             # Entry point with graceful shutdown
├── config/
│   └── env.ts            # Environment variable validation (Zod)
├── db/
│   ├── schema.ts         # Drizzle schema definitions
│   └── index.ts          # Database connection pool
├── middleware/
│   ├── auth.ts           # JWT authentication
│   └── requireGroupMember.ts  # Group membership guard
├── routes/
│   ├── auth.ts           # OTP send/verify
│   ├── groups.ts         # Group CRUD
│   ├── members.ts        # Member management
│   ├── pools.ts          # Pool creation & lifecycle
│   ├── contributions.ts  # Pool contributions
│   ├── profile.ts        # User profile
│   ├── invites.ts        # Invite links & join flow
│   ├── dashboard.ts      # Aggregated dashboard
│   ├── health.ts         # Health check
│   └── home.ts           # API info
├── services/
│   ├── jwt.ts            # JWT signing
│   └── whatsapp.ts       # WhatsApp OTP delivery
└── scripts/
    └── verify-dashboard.ts
```

## Database Diagram

```
┌──────────────────────────┐
│          users           │
├──────────────────────────┤
│ id          UUID    [PK] │
│ phone       TEXT  UNIQUE │
│ displayName TEXT         │
│ avatarUrl   TEXT?        │
│ tokenGeneration INTEGER  │
│ profileSetupComplete BOOL│
│ createdAt   TIMESTAMP    │
│ updatedAt   TIMESTAMP    │
└──────────────────────────┘


┌──────────────────────────────────┐         ┌──────────────────────────────────┐
│             groups               │         │          groupMembers            │
├──────────────────────────────────┤         ├──────────────────────────────────┤
│ id               UUID       [PK] │────┐    │ id              UUID       [PK] │
│ name             TEXT            │    │    │ groupId         UUID       [FK] │──┐
│ currency         TEXT  ('BRL')   │    │    │ externalUserId  TEXT            │  │
│ initialPoolCents INTEGER         │    ├───>│ displayName     TEXT            │  │
│ maxMembers       INTEGER (3-50)  │    │    │ avatarUrl       TEXT?           │  │
│ withdrawalFastTrackCents INT?    │    │    │ reputation      INTEGER         │  │
│ voteWindowHours  INTEGER (6-72)  │    │    │ reliabilityPercent INT (0-100)  │  │
│ challengeCooldownHours   INTEGER │    │    │ role   TEXT [owner|member]      │  │
│ withdrawalVoteTimeoutHours INT   │    │    │ status TEXT [active|invited|    │  │
│ rules            TEXT[]          │    │    │              removed]           │  │
│ createdAt        TIMESTAMP       │    │    │ joinedAt       TIMESTAMP        │  │
└──────────────────────────────────┘    │    └──────────────────────────────────┘  │
                                        │        │                                │
        ┌───────────────────────────────┘        │                                │
        │                                        │                                │
        │    ┌───────────────────────────────────┘                                │
        │    │                                                                    │
        v    v                                                                    │
┌──────────────────────────────────┐                                              │
│         memberBalances           │                                              │
├──────────────────────────────────┤                                              │
│ id             UUID         [PK] │                                              │
│ groupId        UUID         [FK] │──────────────────────────────────────────────┘
│ memberId       UUID         [FK] │
│ availableCents INTEGER  >= 0     │
│ frozenCents    INTEGER  >= 0     │
│ debtCents      INTEGER  >= 0     │
│ status  TEXT [ok|restricted|     │
│               observer]          │
│ updatedAt      TIMESTAMP         │
└──────────────────────────────────┘

┌──────────────────────────────────┐         ┌──────────────────────────────────┐
│            pools                 │         │        contributions             │
├──────────────────────────────────┤         ├──────────────────────────────────┤
│ id             UUID         [PK] │────┐    │ id              UUID       [PK] │
│ groupId        UUID         [FK] │    │    │ poolId          UUID       [FK] │
│ title          TEXT              │    ├───>│ memberId        UUID       [FK] │
│ targetCents    INTEGER  > 0      │    │    │ amountCents     INTEGER  > 0    │
│ collectedCents INTEGER  >= 0     │    │    │ status TEXT [pending|confirmed| │
│ status TEXT [open|closed|        │    │    │              failed]            │
│             cancelled]           │    │    │ pixTransactionId TEXT?          │
│ deadline       TIMESTAMP?        │    │    │ createdAt       TIMESTAMP       │
│ createdAt      TIMESTAMP         │    │    │ confirmedAt     TIMESTAMP?      │
└──────────────────────────────────┘    │    └──────────────────────────────────┘
                                        │
                                        │
┌──────────────────────────────────┐    │    ┌──────────────────────────────────┐
│          challenges              │    │    │           invites                │
├──────────────────────────────────┤    │    ├──────────────────────────────────┤
│ id                UUID      [PK] │    │    │ id              UUID       [PK] │
│ groupId           UUID      [FK] │    │    │ code            TEXT    UNIQUE  │
│ creatorMemberId   UUID      [FK] │    │    │ groupId         UUID       [FK] │
│ challengedMemberId UUID     [FK] │    │    │ inviterMemberId UUID       [FK] │
│ title             TEXT (1-160)   │    │    │ expiresAt       TIMESTAMP       │
│ details           TEXT?          │    │    │ maxUses         INTEGER?        │
│ stakeCents        INTEGER >= 0   │    │    │ useCount        INTEGER         │
│ status TEXT [pending|active|     │    │    │ status TEXT [active|revoked|    │
│   voting|resolved|voided|        │    │    │              expired]           │
│   cancelled]                     │    │    │ createdAt       TIMESTAMP       │
│ eventDeadline     TIMESTAMP      │    │    └──────────────────────────────────┘
│ voteDeadline      TIMESTAMP?     │    │
│ createdAt         TIMESTAMP      │    │
└──────────────────────────────────┘    │
                                        │
                                        │
┌──────────────────────────────────┐    │    ┌──────────────────────────────┐
│         idempotencyKeys          │    │    │         otpCodes             │
├──────────────────────────────────┤    │    ├──────────────────────────────┤
│ id           UUID           [PK] │    │    │ id        UUID         [PK] │
│ key          TEXT        UNIQUE  │    │    │ phone     TEXT              │
│ resourceType TEXT                │    │    │ code      TEXT              │
│ resourceId   UUID                │    │    │ expiresAt TIMESTAMP         │
│ createdAt    TIMESTAMP           │    │    │ used      BOOLEAN           │
└──────────────────────────────────┘    │    │ createdAt TIMESTAMP         │
                                        │    └──────────────────────────────┘
                                        │
                                        │    ┌──────────────────────────────┐
                                        │    │       otpRequests            │
                                        │    ├──────────────────────────────┤
                                        │    │ id        UUID         [PK] │
                                        │    │ phone     TEXT              │
                                        │    │ ip        TEXT              │
                                        │    │ createdAt TIMESTAMP         │
                                        │    └──────────────────────────────┘
                                        │
                                        │    ┌──────────────────────────────┐
                                        │    │        otpLocks              │
                                        │    ├──────────────────────────────┤
                                        │    │ phone      TEXT        [PK] │
                                        │    │ lockedUntil TIMESTAMP       │
                                        │    │ failCount  INTEGER          │
                                        │    └──────────────────────────────┘
```

### Relationships

- `groups` 1 ──> N `groupMembers` (cascade delete)
- `groups` 1 ──> N `pools` (cascade delete)
- `groups` 1 ──> N `challenges` (cascade delete)
- `groups` 1 ──> N `invites` (cascade delete)
- `groups` 1 ──> N `memberBalances` (cascade delete)
- `groupMembers` 1 ──> N `contributions` (cascade delete)
- `groupMembers` 1 ──> N `memberBalances` (cascade delete)
- `groupMembers` 1 ──> N `invites` (as inviter, cascade delete)
- `groupMembers` 1 ──> N `challenges` (as creator or challenged, cascade delete)
- `pools` 1 ──> N `contributions` (cascade delete)

All foreign keys use `ON DELETE CASCADE`.

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check (includes DB connectivity) |
| POST | `/v1/auth/send-otp` | Request OTP code via WhatsApp |
| POST | `/v1/auth/verify-otp` | Verify OTP and receive JWT |

### Protected (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/groups` | List user's groups (paginated) |
| POST | `/v1/groups` | Create a group (supports idempotency key) |
| GET | `/v1/groups/:groupId` | Get group details with members |
| PATCH | `/v1/groups/:groupId` | Update group name (owner only) |
| DELETE | `/v1/groups/:groupId` | Delete group (owner only) |
| GET | `/v1/groups/:groupId/balance` | Get user's balance in group |
| POST | `/v1/groups/:groupId/members` | Invite a member |
| POST | `/v1/groups/:id/members/accept` | Accept membership |
| DELETE | `/v1/groups/:id/members/:memberId` | Remove member (owner or self) |
| POST | `/v1/groups/:groupId/pools` | Create pool (owner only) |
| GET | `/v1/groups/:groupId/pools` | List pools (paginated) |
| GET | `/v1/groups/:groupId/pools/:poolId` | Get pool details |
| PATCH | `/v1/groups/:groupId/pools/:poolId` | Close/cancel pool (owner only) |
| POST | `/v1/groups/:groupId/pools/:poolId/contributions` | Contribute to pool |
| GET | `/v1/profile` | Get user profile |
| PATCH | `/v1/profile` | Update profile (name, avatar) |
| GET | `/v1/profile/pix-keys` | Get user's PIX keys |
| POST | `/v1/groups/:groupId/invites` | Generate invite link |
| GET | `/v1/invites/:inviteCode` | Get invite info + PIX code |
| POST | `/v1/invites/:inviteCode/join` | Join group via invite |
| GET | `/v1/dashboard` | Aggregated dashboard |

## Authentication Flow

1. User requests OTP via `POST /v1/auth/send-otp` with phone number (E.164 format)
2. OTP is delivered via WhatsApp Business API (template: `otp_auth`, locale: `pt_BR`)
3. User verifies via `POST /v1/auth/verify-otp` — receives a JWT (30-day expiry)
4. JWT contains `gen` (token generation) — incremented on each login, invalidating previous tokens
5. Dev mode accepts magic code `000000`

**Rate limits**: 3 OTP requests per 15 minutes per phone. 5 failed attempts trigger a 30-minute lock.

## Key Features

- **Cursor-based pagination** on groups and pools (base64url encoded cursors)
- **Idempotency** via `Idempotency-Key` header on group creation
- **Three-state balance**: `availableCents` / `frozenCents` / `debtCents` per member per group
- **Reputation system**: reputation score + reliability percentage tracked per group membership
- **PIX integration**: generates EMV-formatted PIX codes for group join payments
- **Challenge system**: member-to-member challenges with voting and stake mechanics
- **Invite system**: 6-char alphanumeric codes, 7-day expiry, optional max uses
- **Profile sync**: profile updates propagate to all group memberships

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env  # Edit with your values

# Generate migrations from schema
npm run db:generate

# Apply migrations
npm run db:push

# Start development server
npm run dev

# Build and run production
npm run build
npm run start
```

### Makefile Shortcuts

```bash
make dev           # Development with hot reload
make build         # Compile TypeScript
make start         # Build + start
make db-generate   # Generate migrations
make db-migrate    # Apply migrations
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | Server port |
| `APP_ENV` | Application environment |
| `APP_VERSION` | Semver version string |
| `DATABASE_URL` | PostgreSQL connection string (SSL) |
| `DB_POOL_MAX` | Connection pool size (default: 10) |
| `JWT_SECRET` | HMAC secret for JWT (min 32 chars) |
| `WHATSAPP_TOKEN` | Meta Business API token |
| `WHATSAPP_PHONE_ID` | WhatsApp Business phone ID |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender number |
| `CORS_ORIGIN` | Allowed CORS origin (default: `*`) |
