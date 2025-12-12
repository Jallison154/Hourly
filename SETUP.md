# Database Setup Guide

## Quick Setup

The internal server error you're seeing is because the database isn't configured yet. Follow these steps:

### Option 1: Using PostgreSQL (Recommended)

1. **Create the `.env` file** in the `backend` directory:
   ```bash
   cd backend
   ```

2. **Create `.env` file** with your database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/hours_calculator"
   JWT_SECRET="your-random-secret-key-here"
   PORT=5000
   ```

3. **Update the DATABASE_URL** with your actual PostgreSQL credentials:
   - Replace `username` with your PostgreSQL username
   - Replace `password` with your PostgreSQL password
   - Replace `hours_calculator` with your database name (or create it first)

4. **Create the database** (if it doesn't exist):
   ```bash
   createdb hours_calculator
   # or using psql:
   psql -U postgres
   CREATE DATABASE hours_calculator;
   ```

5. **Run the setup script**:
   ```bash
   ./setup-db.sh
   ```

   Or manually:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

### Option 2: Using SQLite (Easier for Development)

If you don't have PostgreSQL set up, you can use SQLite for development:

1. **Update `backend/prisma/schema.prisma`**:
   Change the datasource from:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   To:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. **Update `.env`** (or create it):
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-random-secret-key-here"
   PORT=5000
   ```

3. **Run migrations**:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

## After Setup

Once the database is configured, restart the backend server:

```bash
cd backend
npm run dev
```

The frontend should now be able to connect and you can register/login!

## Troubleshooting

- **"Database connection failed"**: Check your DATABASE_URL in `.env` and ensure PostgreSQL is running
- **"Table does not exist"**: Run `npm run prisma:migrate` to create the tables
- **Port already in use**: Change PORT in `.env` or stop the process using port 5000


