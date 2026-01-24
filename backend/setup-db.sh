#!/bin/bash

echo "Setting up Hourly Database..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database - use relative path to ensure it works regardless of project location
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret
JWT_SECRET="$(openssl rand -hex 32)"

# Server port
PORT=5000
EOF
    echo "✓ .env file created with SQLite database"
    echo ""
else
    echo "✓ .env file already exists"
    
    # Check if DATABASE_URL uses absolute path (common issue)
    if grep -q "file:/Users" .env || grep -q "file:/home" .env; then
        echo ""
        echo "⚠️  WARNING: Your DATABASE_URL uses an absolute path"
        echo "   This can cause database reset issues when the project moves"
        echo "   Consider updating to: DATABASE_URL=\"file:./prisma/dev.db\""
        echo ""
    fi
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Generating Prisma Client..."
npx prisma generate

echo ""
echo "Syncing database schema..."
npx prisma db push

echo ""
echo "✓ Database setup complete!"
echo ""
echo "You can now start the server with: npm run dev"
