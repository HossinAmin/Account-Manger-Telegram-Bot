#!/bin/bash

# Prevent script from running continuously 
set -eo pipefail

echo "🚀 Starting deployment..."

# Navigate to the project directory and exit if the directory doesn't exist
cd ~/telegram-bot/Account-Manger-Telegram-Bot || { echo "❌ Project directory not found!"; exit 1; }

# Pulling the latest changes from the main branch
git pull origin main

echo "📦 Installing dependencies..."
# Install dependencies using bun's frozen lockfile for consistency
bun install --frozen-lockfile

echo "🔒 Setting up environment variables..."
# Create or overwrite the .env file with secrets passed from GitHub Actions
cat > .env << EOF
BOT_TOKEN=${BOT_TOKEN}
DB_PATH=${DB_PATH}
EOF

echo "🔄 Restarting Server..."
# Restart the application using the ecosystem config file
source .env
pm2 restart ecosystem.config.js

# Save the current PM2 process list
pm2 save

echo "✅ Deployment completed successfully!"
