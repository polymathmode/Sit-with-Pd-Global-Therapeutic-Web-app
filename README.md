# Well-Being Platform — Backend API

Built with Node.js · TypeScript · Express · PostgreSQL · Prisma

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Set up the database
```bash
# Make sure PostgreSQL is running, then:
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed with admin account + sample data
npm run db:seed
```

### 4. Run the server
```bash
npm run dev
```

Server runs at: `http://localhost:5000`
Health check: `http://localhost:5000/health`

---

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | Public | Create account |
| POST | `/login` | Public | Login |
| GET | `/me` | User | Get current user |
| POST | `/forgot-password` | Public | Request password reset |
| POST | `/reset-password` | Public | Reset with token |

### Programs — `/api/programs`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all programs |
| GET | `/:id` | Public | Program detail |
| POST | `/` | Admin | Create program |
| PATCH | `/:id` | Admin | Update program |
| DELETE | `/:id` | Admin | Delete program |
| POST | `/:id/lessons` | Admin | Add lesson |
| PATCH | `/:id/lessons/:lessonId` | Admin | Update lesson |
| DELETE | `/:id/lessons/:lessonId` | Admin | Delete lesson |

### Camps — `/api/camps`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List upcoming camps |
| GET | `/:id` | Public | Camp detail |
| POST | `/:id/register` | User | Register for camp |
| POST | `/` | Admin | Create camp |
| PATCH | `/:id` | Admin | Update camp |
| DELETE | `/:id` | Admin | Delete camp |
| GET | `/:id/participants` | Admin | View registrants |

### Consultations — `/api/consultations`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/services` | Public | List services |
| GET | `/services/:id` | Public | Service detail |
| POST | `/book` | User | Book consultation |
| GET | `/my` | User | My bookings |
| GET | `/` | Admin | All bookings |
| PATCH | `/:id` | Admin | Update booking |
| POST | `/services` | Admin | Create service |
| PATCH | `/services/:id` | Admin | Update service |

### Payments — `/api/payments`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/initialize` | User | Start Paystack payment |
| GET | `/verify/:reference` | Public | Check payment status |
| POST | `/webhook` | Paystack | Webhook handler |
| GET | `/` | Admin | All payment records |

### Dashboard — `/api/dashboard`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | User | Full dashboard data |
| GET | `/programs/:programId` | User | Access program content |

### Admin — `/api/admin`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats` | Admin | Platform stats |
| GET | `/users` | Admin | All users |
| GET | `/users/:id` | Admin | User detail |

---

## Payment Flow

```
1. User clicks "Buy" / "Register" / "Book"
2. POST /api/payments/initialize  → returns Paystack authorization_url
3. Frontend redirects user to Paystack checkout page
4. User pays on Paystack
5. Paystack calls POST /api/payments/webhook (server-to-server)
6. Webhook verifies signature, fulfills purchase, sends confirmation email
7. Frontend calls GET /api/payments/verify/:reference to show result
```

---

## Seeded Admin Credentials
```
Email:    admin@wellbeing.com
Password: Admin@1234
```
Change these immediately in production.

---

## Folder Structure
```
src/
├── config/          # Prisma, Cloudinary, Nodemailer setup
├── controllers/     # Route handler logic
├── middleware/      # Auth, error handling, file uploads
├── routes/          # Express route definitions
├── utils/           # Email service
├── types/           # TypeScript types
├── app.ts           # Express app
└── server.ts        # Entry point

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed data
```
