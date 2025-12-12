#!/bin/bash

# Hourly - Installation Script for Ubuntu 22.04
# This script installs all dependencies and sets up the Hourly time tracking application

set -e  # Exit on error

echo "=========================================="
echo "Hourly - Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_info "Installing Hourly in: $SCRIPT_DIR"
echo ""

# Step 1: Update system packages
print_info "Updating system packages..."
sudo apt-get update -qq
print_success "System packages updated"
echo ""

# Step 2: Install Node.js 18+ (using NodeSource repository)
print_info "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js $(node -v) is already installed"
    else
        print_info "Node.js version is too old. Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_success "Node.js $(node -v) installed"
    fi
else
    print_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js $(node -v) installed"
fi
echo ""

# Step 3: Verify npm is installed
print_info "Checking npm installation..."
if command -v npm &> /dev/null; then
    print_success "npm $(npm -v) is installed"
else
    print_error "npm is not installed. Please install Node.js."
    exit 1
fi
echo ""

# Step 4: Install build tools (needed for some npm packages)
print_info "Installing build tools..."
sudo apt-get install -y build-essential python3
print_success "Build tools installed"
echo ""

# Step 5: Install backend dependencies
print_info "Installing backend dependencies..."
cd backend
if [ ! -f "package.json" ]; then
    print_error "package.json not found in backend directory"
    exit 1
fi

npm install
print_success "Backend dependencies installed"
echo ""

# Step 6: Set up backend environment variables
print_info "Setting up backend environment variables..."
if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    
    # Generate JWT secret
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -hex 32)
    else
        # Fallback to a simple random string
        JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    fi
    
    cat > .env << EOF
DATABASE_URL="file:$(pwd)/prisma/dev.db"
JWT_SECRET="$JWT_SECRET"
PORT=5000
EOF
    print_success ".env file created"
else
    print_info ".env file already exists, skipping..."
fi
echo ""

# Step 7: Generate Prisma client and run migrations
print_info "Generating Prisma client..."
npm run prisma:generate
print_success "Prisma client generated"

print_info "Running database migrations..."
npm run prisma:migrate
print_success "Database migrations completed"
echo ""

# Step 8: Install frontend dependencies
print_info "Installing frontend dependencies..."
cd ../frontend
if [ ! -f "package.json" ]; then
    print_error "package.json not found in frontend directory"
    exit 1
fi

npm install
print_success "Frontend dependencies installed"
echo ""

# Step 9: Build frontend (optional, for production)
read -p "Do you want to build the frontend for production? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Building frontend..."
    npm run build
    print_success "Frontend built successfully"
else
    print_info "Skipping frontend build (you can build later with 'npm run build')"
fi
echo ""

# Step 10: Create systemd service files (optional)
read -p "Do you want to create systemd service files for running as a service? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Creating systemd service files..."
    
    # Backend service
    sudo tee /etc/systemd/system/hourly-backend.service > /dev/null << EOF
[Unit]
Description=Hourly Backend API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service (if using a production server like nginx, this would be different)
    print_info "Note: Frontend is typically served via nginx or similar. Service file not created."
    
    sudo systemctl daemon-reload
    print_success "Systemd service files created"
    print_info "To start the backend service: sudo systemctl start hourly-backend"
    print_info "To enable on boot: sudo systemctl enable hourly-backend"
else
    print_info "Skipping systemd service creation"
fi
echo ""

# Summary
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
print_success "All dependencies installed successfully"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the development servers:"
echo "   Terminal 1 (Backend):"
echo "     cd $SCRIPT_DIR/backend"
echo "     npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "     cd $SCRIPT_DIR/frontend"
echo "     npm run dev"
echo ""
echo "2. Access the application:"
echo "   Frontend: http://localhost:5173 (or the port Vite assigns)"
echo "   Backend API: http://localhost:5000"
echo ""
echo "3. Create your first user account through the registration page"
echo ""
print_info "For production deployment, build the frontend and configure a reverse proxy (nginx)"
echo ""

