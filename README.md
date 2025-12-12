# Hourly

A Progressive Web App for time tracking with clock in/out functionality, timesheet generation, paycheck estimation, and Montana tax calculations.

## Features

- Clock in/out with manual time selection
- Add/edit time entries manually
- Break tracking (lunch, rest breaks)
- Pay period tracking (11th to 10th)
- Weekly breakdowns
- Timesheet generation
- Paycheck calculator with tax estimation
- Metrics dashboard
- Multi-user support
- PWA support for mobile installation

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database

### Installation

1. Install frontend dependencies:
```bash
cd frontend
npm install
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Set up environment variables:
```bash
# Backend .env file
DATABASE_URL="postgresql://user:password@localhost:5432/hours_calculator"
JWT_SECRET="your-secret-key"
PORT=5000
```

4. Run database migrations:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

5. Start development servers:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

6. (Optional) Create PWA icons:
   - Create `frontend/public/pwa-192x192.png` (192x192 pixels)
   - Create `frontend/public/pwa-512x512.png` (512x512 pixels)
   - These icons will be used when users install the app on their devices

## Features Details

### Clock In/Out
- Real-time clock display
- Manual time selection for accurate time entry
- Current entry status display
- Break management (add lunch, rest breaks, or other breaks)

### Manual Time Entries
- Add time entries manually if you forgot to clock in/out
- Edit existing time entries
- Delete time entries
- Add notes to entries

### Break Tracking
- Add breaks to time entries (lunch, rest, other)
- Track break start/end times
- Automatic break duration calculation
- View all breaks for an entry

### Timesheet
- View all entries for current pay period (11th to 10th)
- Weekly breakdowns with totals
- Daily hours tracking
- Pay calculations per week and pay period

### Paycheck Calculator
- Calculate estimated paycheck based on hours
- Automatic overtime calculation (1.5x after 40 hours/week)
- Montana tax estimation (5.9% flat rate)
- Federal tax brackets (2024)
- FICA calculations (Social Security + Medicare)
- Weekly and monthly breakdowns

### Dashboard
- Total hours for current pay period
- Gross and net pay estimates
- Daily hours chart
- Pay breakdown visualization
- Average hours per day
- Recent activity metrics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Time Entries
- `GET /api/time-entries/status` - Get current clock status
- `POST /api/time-entries/clock-in` - Clock in (with optional custom time)
- `POST /api/time-entries/clock-out` - Clock out (with optional custom time)
- `GET /api/time-entries` - Get time entries for pay period
- `POST /api/time-entries` - Create manual time entry
- `PUT /api/time-entries/:id` - Update time entry
- `DELETE /api/time-entries/:id` - Delete time entry
- `POST /api/time-entries/:id/breaks` - Add break to entry
- `PUT /api/time-entries/breaks/:breakId` - Update break
- `DELETE /api/time-entries/breaks/:breakId` - Delete break

### Timesheet
- `GET /api/timesheet` - Get current pay period timesheet
- `GET /api/timesheet/:startDate/:endDate` - Get timesheet for date range

### Paycheck
- `GET /api/paycheck/estimate` - Get paycheck estimate

### Metrics
- `GET /api/metrics` - Get dashboard metrics

## Project Structure

```
hourly/
├── frontend/          # React PWA
├── backend/           # Express API
└── README.md
```

