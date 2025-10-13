#!/bin/bash

# Setup script for Auto Data Sync
echo "🚀 Setting up Auto Data Sync for MyDay Tracker..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install required dependencies
echo "📦 Installing required dependencies..."

# Install node-cron for scheduling
npm install node-cron
npm install --save-dev @types/node-cron

# Install tsx for running TypeScript files
npm install --save-dev tsx

echo "✅ Dependencies installed successfully"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# TeamOffice API Configuration
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=your_corp_id
TEAMOFFICE_USERNAME=your_username
TEAMOFFICE_PASSWORD=your_password
TEAMOFFICE_EMPCODE=ALL

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
EOF
    echo "⚠️  Please update the .env file with your actual API credentials"
else
    echo "✅ .env file already exists"
fi

# Make the start script executable
chmod +x start_auto_sync.ts

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with the correct API credentials"
echo "2. Run the auto sync service:"
echo "   npx tsx start_auto_sync.ts"
echo ""
echo "📚 Available commands:"
echo "   npx tsx start_auto_sync.ts          # Start the auto sync service"
echo "   npx tsx run_bulk_mapping.ts         # Run bulk employee mapping"
echo "   npx tsx run_bulk_mapping.ts custom  # Run custom mapping configuration"
echo ""
echo "🔧 Configuration:"
echo "   - Edit start_auto_sync.ts to modify sync intervals"
echo "   - Use the AutoSyncManager component in your admin panel"
echo "   - Check logs for sync status and errors"
echo ""
echo "🆘 Troubleshooting:"
echo "   - Check TeamOffice API credentials in .env"
echo "   - Verify Supabase connection"
echo "   - Check console logs for detailed error messages"




