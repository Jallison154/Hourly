#!/bin/bash

echo "Setting up Hourly Database..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
DATABASE_URL="postgresql://user:password@localhost:5432/hours_calculator"
JWT_SECRET="$(openssl rand -hex 32)"
PORT=5000
EOF
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please update DATABASE_URL in .env with your PostgreSQL credentials"
    echo ""
else
    echo "✓ .env file already exists"
fi

# Check if DATABASE_URL is set
if grep -q "postgresql://user:password" .env; then
    echo ""
    echo "⚠️  WARNING: You need to update DATABASE_URL in .env file"
    echo "   Format: postgresql://username:password@localhost:5432/database_name"
    echo ""
    read -p "Have you updated the DATABASE_URL? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please update .env file and run this script again"
        exit 1
    fi
fi

echo ""
echo "Generating Prisma Client..."
npm run prisma:generate

echo ""
echo "Running database migrations..."
npm run prisma:migrate

echo ""
echo "✓ Database setup complete!"
echo ""
echo "You can now start the server with: npm run dev"


