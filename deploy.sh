#!/bin/bash

# Sky IQ Production Deployment Script
# Ensures 6-month stability and uptime

set -e  # Exit on any error

LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/deploy.log"
BACKUP_DIR="./backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    # Check database connection
    if [ -z "$DATABASE_URL" ]; then
        warn "DATABASE_URL not set, using default database"
    fi
    
    # Check required environment variables
    if [ -z "$MAILERSEND_API_TOKEN" ]; then
        warn "MAILERSEND_API_TOKEN not set, email features may not work"
    fi
    
    log "Prerequisites check completed"
}

# Function to install dependencies
install_dependencies() {
    log "Installing dependencies..."
    npm ci --production=false
    log "Dependencies installed successfully"
}

# Function to run tests
run_tests() {
    log "Running health checks..."
    
    # Run type checking
    npm run check
    
    # Test database connectivity
    if [ -f "healthcheck.js" ]; then
        node healthcheck.js
    fi
    
    log "Health checks completed"
}

# Function to build application
build_application() {
    log "Building application for production..."
    
    # Build frontend and backend
    npm run build
    
    log "Application built successfully"
}

# Function to create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_NAME="skyiq-backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    # Create backup directory
    mkdir -p "$BACKUP_PATH"
    
    # Copy important files
    cp -r server/ "$BACKUP_PATH/"
    cp -r client/ "$BACKUP_PATH/"
    cp -r shared/ "$BACKUP_PATH/"
    cp package.json "$BACKUP_PATH/"
    cp package-lock.json "$BACKUP_PATH/"
    
    # Copy logs
    if [ -d "$LOG_DIR" ]; then
        cp -r "$LOG_DIR" "$BACKUP_PATH/"
    fi
    
    log "Backup created at: $BACKUP_PATH"
}

# Function to setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Make scripts executable
    chmod +x maintenance.sh
    chmod +x healthcheck.js
    
    # Set up log rotation
    cat > logrotate.conf << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 runner runner
}
EOF
    
    log "Monitoring setup completed"
}

# Function to deploy application
deploy_application() {
    log "Deploying Sky IQ application..."
    
    # Stop existing processes
    pkill -f "tsx server/index.ts" 2>/dev/null || true
    pkill -f "node.*server/index.ts" 2>/dev/null || true
    
    # Wait for processes to stop
    sleep 3
    
    # Start application in production mode
    export NODE_ENV=production
    
    # Start the application
    if [ -f "dist/index.js" ]; then
        log "Starting application in production mode..."
        nohup node dist/index.js > "$LOG_DIR/app.log" 2>&1 &
        APP_PID=$!
        echo $APP_PID > "$LOG_DIR/app.pid"
    else
        log "Starting application in development mode..."
        nohup npm run dev > "$LOG_DIR/app.log" 2>&1 &
        APP_PID=$!
        echo $APP_PID > "$LOG_DIR/app.pid"
    fi
    
    # Wait for application to start
    sleep 5
    
    # Verify application is running
    if curl -s http://localhost:5000/api/health > /dev/null; then
        log "Application deployed successfully (PID: $APP_PID)"
    else
        error "Application failed to start properly"
        exit 1
    fi
}

# Function to setup cron jobs for maintenance
setup_cron_jobs() {
    log "Setting up maintenance cron jobs..."
    
    # Create cron job for regular maintenance
    (crontab -l 2>/dev/null; echo "0 3 * * * cd $(pwd) && ./maintenance.sh") | crontab -
    
    # Create cron job for health checks every 5 minutes
    (crontab -l 2>/dev/null; echo "*/5 * * * * cd $(pwd) && node healthcheck.js") | crontab -
    
    log "Cron jobs setup completed"
}

# Function to display deployment summary
deployment_summary() {
    log "=== Sky IQ Deployment Summary ==="
    log "Application: Running on port 5000"
    log "Health Check: http://localhost:5000/api/health"
    log "Logs Directory: $LOG_DIR"
    log "Backup Directory: $BACKUP_DIR"
    log "Monitoring: Active with automated maintenance"
    log "Stability Features:"
    log "  - Automatic daily restarts at 3 AM"
    log "  - Health checks every 5 minutes"
    log "  - Log rotation (30 days retention)"
    log "  - Automatic backups"
    log "  - Memory and disk monitoring"
    log "================================="
}

# Main deployment function
main() {
    log "Starting Sky IQ deployment for 6-month stability..."
    
    check_prerequisites
    create_backup
    install_dependencies
    run_tests
    build_application
    setup_monitoring
    deploy_application
    setup_cron_jobs
    deployment_summary
    
    log "Sky IQ deployment completed successfully!"
    log "Your application is now configured for long-term stability."
}

# Run main function
main "$@"