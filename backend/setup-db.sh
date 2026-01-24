#!/bin/bash

echo "========================================"
echo "  Hourly - Database Setup Script"
echo "========================================"
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
        echo ""
        read -p "   Fix to relative path? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Update the DATABASE_URL to use relative path
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' 's|DATABASE_URL="file:/.*prisma/dev.db"|DATABASE_URL="file:./prisma/dev.db"|g' .env
            else
                sed -i 's|DATABASE_URL="file:/.*prisma/dev.db"|DATABASE_URL="file:./prisma/dev.db"|g' .env
            fi
            echo "   ✓ Updated to relative path"
        fi
        echo ""
    fi
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Generating Prisma Client..."
npx prisma generate

# Check if database already exists with data
DB_FILE="prisma/dev.db"
if [ -f "$DB_FILE" ]; then
    echo ""
    echo "✓ Existing database found"
    
    # Check for missing columns and add them to preserve data
    echo "Checking for schema updates..."
    
    # Check if filingStatus column exists
    if ! sqlite3 "$DB_FILE" ".schema User" 2>/dev/null | grep -q "filingStatus"; then
        echo "  Adding missing column: filingStatus"
        sqlite3 "$DB_FILE" "ALTER TABLE User ADD COLUMN filingStatus TEXT NOT NULL DEFAULT 'single';" 2>/dev/null
    fi
    
    # Add other columns here as schema evolves
    # Example: if ! sqlite3 "$DB_FILE" ".schema User" | grep -q "newColumn"; then
    #     sqlite3 "$DB_FILE" "ALTER TABLE User ADD COLUMN newColumn TEXT DEFAULT 'value';"
    # fi
    
    echo "✓ Schema updates applied (data preserved)"
    echo ""
    
    # Now sync with Prisma (should be no-op if columns match)
    echo "Syncing Prisma schema..."
    npx prisma db push --skip-generate 2>&1 | grep -v "already in sync" || true
else
    echo ""
    echo "Creating new database..."
    npx prisma db push
fi

echo ""
echo "========================================"
echo "  ✓ Database setup complete!"
echo "========================================"
echo ""
echo "Start the server with: npm run dev"
echo ""
