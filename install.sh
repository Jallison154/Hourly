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
    print_info "Running as root - files will be owned by root"
    print_info "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
    sleep 3
    SUDO_CMD=""  # No need for sudo when running as root
else
    SUDO_CMD="sudo"  # Use sudo when running as regular user
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check for nested Hourly directories (common mistake when running git clone multiple times)
CURRENT_PATH="$SCRIPT_DIR"
HOURLY_COUNT=$(echo "$CURRENT_PATH" | tr '/' '\n' | grep -c "Hourly" || echo "0")
if [ "$HOURLY_COUNT" -gt 2 ]; then
    print_error "Warning: Detected nested Hourly directories in path!"
    print_info "Current path: $CURRENT_PATH"
    print_info "This usually happens when running 'git clone' multiple times."
    print_info ""
    print_info "To fix this:"
    print_info "1. Navigate to the root Hourly directory: cd ~/Hourly"
    print_info "2. Remove nested directories if needed"
    print_info "3. Run: ./install.sh"
    print_info ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    echo ""
fi

print_info "Installing Hourly in: $SCRIPT_DIR"
echo ""

# Check if this is a git repository and update if needed
if [ -d ".git" ]; then
    print_info "Detected git repository, checking for updates..."
    
    # Temporarily disable exit on error for git operations
    set +e
    
    # Get current branch name (default to main if can't determine)
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    
    # Check if there are uncommitted changes
    git diff --quiet 2>/dev/null
    DIFF_EXIT=$?
    git diff --staged --quiet 2>/dev/null
    STAGED_EXIT=$?
    
    if [ $DIFF_EXIT -ne 0 ] || [ $STAGED_EXIT -ne 0 ]; then
        print_info "You have uncommitted changes."
        print_info "Stashing local changes temporarily..."
        git stash push -m "Auto-stash before install.sh update $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
        if [ $? -eq 0 ]; then
            STASHED=true
        else
            STASHED=false
            print_info "Could not stash changes (continuing anyway)"
        fi
    else
        STASHED=false
    fi
    
    # Fetch latest changes from origin
    print_info "Fetching latest changes from origin..."
    if git fetch origin --prune 2>/dev/null; then
        print_success "Fetched latest changes"
        
        # Check if we're behind origin
        LOCAL=$(git rev-parse HEAD 2>/dev/null)
        REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null)
        
        if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
            print_info "Local repository is behind origin. Updating..."
            
            # Reset hard to origin to ensure we get the latest code
            # This will discard any local commits that aren't on origin
            if git reset --hard "origin/$CURRENT_BRANCH" 2>/dev/null; then
                print_success "Repository updated to latest version"
                
                # Clean untracked files and directories (optional, but helps ensure clean state)
                print_info "Cleaning untracked files..."
                git clean -fd 2>/dev/null || true
            else
                print_error "Failed to update repository. You may need to update manually."
                print_info "Try: git pull origin $CURRENT_BRANCH"
            fi
        else
            if [ -z "$REMOTE" ]; then
                print_info "Could not find remote branch origin/$CURRENT_BRANCH"
            else
                print_success "Repository is already up to date"
            fi
        fi
    else
        print_error "Could not fetch changes from origin"
        print_info "Check your internet connection and git remote configuration"
        print_info "Continuing with existing code..."
    fi
    
    # Restore stashed changes if any
    if [ "$STASHED" = true ]; then
        print_info "Restoring previously stashed changes..."
        git stash pop 2>/dev/null
        if [ $? -ne 0 ]; then
            print_info "Could not restore stashed changes (they are still in git stash)"
            print_info "View stashed changes with: git stash list"
        fi
    fi
    
    # Re-enable exit on error
    set -e
    
    echo ""
elif [ -d "../.git" ] && [ "$(basename "$(cd .. && pwd)")" = "Hourly" ]; then
    # If we're in a nested directory, warn the user
    print_error "Warning: Detected nested Hourly directory structure!"
    print_info "You may be in a nested directory. Current path: $(pwd)"
    print_info "Consider running the script from the root Hourly directory"
    echo ""
fi

# Step 1: Update system packages and install curl
print_info "Updating system packages..."
$SUDO_CMD apt-get update -qq
print_success "System packages updated"

# Install curl if not present (needed for Node.js installation)
if ! command -v curl &> /dev/null; then
    print_info "Installing curl..."
    $SUDO_CMD apt-get install -y curl
    print_success "curl installed"
fi
echo ""

# Step 2: Install Node.js 18+ (using NodeSource repository)
print_info "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js $(node -v) is already installed"
    else
        print_info "Node.js version is too old. Installing Node.js 20.x..."
        if [ "$EUID" -eq 0 ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        else
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        print_success "Node.js $(node -v) installed"
    fi
else
    print_info "Installing Node.js 20.x..."
    if [ "$EUID" -eq 0 ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
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
$SUDO_CMD apt-get install -y build-essential python3
print_success "Build tools installed"
echo ""

# Step 5: Install/Update backend dependencies
print_info "Installing/updating backend dependencies..."
cd backend
if [ ! -f "package.json" ]; then
    print_error "package.json not found in backend directory"
    exit 1
fi

# Check if node_modules exists (update) or not (fresh install)
if [ -d "node_modules" ]; then
    print_info "Updating existing backend dependencies..."
    npm update
else
    print_info "Installing backend dependencies..."
    npm install
fi
print_success "Backend dependencies installed/updated"
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
    
    # Get server IP address for mobile access
    SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 | awk '{print $7; exit}' 2>/dev/null || echo "localhost")
    
    cat > .env << EOF
DATABASE_URL="file:$(pwd)/prisma/dev.db"
JWT_SECRET="$JWT_SECRET"
PORT=5000
HOST=0.0.0.0
EOF
    print_info "Backend will listen on all interfaces (0.0.0.0) for mobile access"
    print_info "Server IP: $SERVER_IP"
    print_info "Access from iPhone: http://$SERVER_IP:5000"
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
# Check if database exists
if [ -f "prisma/dev.db" ]; then
    print_info "Database exists, applying migrations..."
    npm run prisma:migrate deploy || npm run prisma:migrate
else
    print_info "Creating new database..."
    npm run prisma:migrate
fi
print_success "Database migrations completed"
echo ""

# Step 7.5: Build backend for production (required for systemd service)
print_info "Building backend for production..."
npm run build
print_success "Backend built successfully"
echo ""

# Step 9: Install/Update frontend dependencies
print_info "Installing/updating frontend dependencies..."
cd ../frontend
if [ ! -f "package.json" ]; then
    print_error "package.json not found in frontend directory"
    exit 1
fi

# Check if node_modules exists (update) or not (fresh install)
if [ -d "node_modules" ]; then
    print_info "Updating existing frontend dependencies..."
    npm update
else
    print_info "Installing frontend dependencies..."
    npm install
fi
print_success "Frontend dependencies installed/updated"
echo ""

# Step 10: Build frontend for production (required for systemd service)
print_info "Building frontend for production..."
npm run build
print_success "Frontend built successfully"
echo ""

# Step 11: Create and enable systemd service files
print_info "Creating systemd service files..."

# Backend service
if [ "$EUID" -eq 0 ]; then
    SERVICE_USER="root"
else
    SERVICE_USER="$USER"
fi

$SUDO_CMD tee /etc/systemd/system/hourly-backend.service > /dev/null << EOF
[Unit]
Description=Hourly Backend API
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SCRIPT_DIR/backend
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=5000
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service - using vite preview to serve the built frontend
$SUDO_CMD tee /etc/systemd/system/hourly-frontend.service > /dev/null << EOF
[Unit]
Description=Hourly Frontend
After=network.target hourly-backend.service
Requires=hourly-backend.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SCRIPT_DIR/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx vite preview --host 0.0.0.0 --port 5173
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
$SUDO_CMD systemctl daemon-reload
print_success "Systemd service files created"

# Start and enable both services
print_info "Starting and enabling services..."

# Backend service
$SUDO_CMD systemctl enable hourly-backend
$SUDO_CMD systemctl start hourly-backend
sleep 2

if $SUDO_CMD systemctl is-active --quiet hourly-backend; then
    print_success "Backend service started and enabled on boot"
else
    print_error "Backend service failed to start. Check logs with: $SUDO_CMD systemctl status hourly-backend"
fi

# Frontend service
$SUDO_CMD systemctl enable hourly-frontend
$SUDO_CMD systemctl start hourly-frontend
sleep 2

if $SUDO_CMD systemctl is-active --quiet hourly-frontend; then
    print_success "Frontend service started and enabled on boot"
else
    print_error "Frontend service failed to start. Check logs with: $SUDO_CMD systemctl status hourly-frontend"
fi

echo ""
print_info "Services will automatically start on system reboot"
print_info "Backend API: http://localhost:5000"
print_info "Frontend: http://localhost:5173"
echo ""

# Summary
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
print_success "All dependencies installed successfully"
echo ""
echo "Services are running and will start automatically on reboot!"
echo ""
echo "Service Management:"
echo "   Check status: $SUDO_CMD systemctl status hourly-backend hourly-frontend"
echo "   Stop services: $SUDO_CMD systemctl stop hourly-backend hourly-frontend"
echo "   Start services: $SUDO_CMD systemctl start hourly-backend hourly-frontend"
echo "   Restart services: $SUDO_CMD systemctl restart hourly-backend hourly-frontend"
echo "   View logs: $SUDO_CMD journalctl -u hourly-backend -u hourly-frontend -f"
echo ""
echo "Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:5000"
echo ""
echo "Create your first user account through the registration page"
echo ""

