# Quick Install - Ubuntu 22.04

## One-Liner Install

If you already have the project cloned/downloaded:

```bash
cd Hourly && chmod +x install.sh && ./install.sh
```

## Full One-Liner (if you have git)

**Important:** Run as a regular user (not root). The script will prompt for sudo when needed.

```bash
git clone https://github.com/Jallison154/Hourly.git && cd Hourly && chmod +x install.sh && ./install.sh
```

Or as a true one-liner:

```bash
git clone https://github.com/Jallison154/Hourly.git Hourly && cd Hourly && chmod +x install.sh && ./install.sh
```

**If you're already root**, switch to a regular user first:
```bash
su - yourusername
# Then run the install command
```

Or if you must stay as root, run as a different user:
```bash
git clone https://github.com/Jallison154/Hourly.git Hourly && cd Hourly && chmod +x install.sh && sudo -u $SUDO_USER ./install.sh
```

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

