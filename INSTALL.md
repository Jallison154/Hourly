# Quick Install - Ubuntu 22.04

## One-Liner Install

If you already have the project cloned/downloaded:

```bash
cd Hourly && chmod +x install.sh && ./install.sh
```

## Full One-Liner (if you have git)

The script can be run as root or as a regular user. If run as root, it will show a 3-second warning.

**As regular user:**
```bash
git clone https://github.com/Jallison154/Hourly.git && cd Hourly && chmod +x install.sh && ./install.sh
```

**As root:**
```bash
git clone https://github.com/Jallison154/Hourly.git && cd Hourly && chmod +x install.sh && ./install.sh
```

**Note:** If running as root, all files will be owned by root. The script will show a 3-second warning before proceeding.

## Manual Steps (if you prefer)

1. Make script executable: `chmod +x install.sh`
2. Run installation: `./install.sh`

The script will:
- Install Node.js 20.x
- Install all dependencies
- Set up the database
- Configure environment variables
- Optionally build for production
- Optionally create systemd services

## After Installation

Start the development servers:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

Access the app at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

