#!/bin/bash

# Sky IQ Application Maintenance Script
# This script ensures long-term stability and uptime

LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/maintenance.log"
HEALTH_CHECK_SCRIPT="./healthcheck.js"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to check if application is running
check_app_status() {
    if pgrep -f "tsx server/index.ts" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to restart application if needed
restart_if_needed() {
    if ! check_app_status; then
        log_message "Application not running, attempting restart..."
        
        # Kill any hanging processes
        pkill -f "tsx server/index.ts" 2>/dev/null || true
        sleep 2
        
        # Start the application
        npm run dev > /dev/null 2>&1 &
        
        sleep 5
        
        if check_app_status; then
            log_message "Application restarted successfully"
        else
            log_message "Failed to restart application"
        fi
    else
        log_message "Application is running normally"
    fi
}

# Function to clean up old logs
cleanup_logs() {
    # Keep only last 30 days of logs
    find "$LOG_DIR" -name "*.log" -type f -mtime +30 -delete
    log_message "Old logs cleaned up"
}

# Function to run health check
run_health_check() {
    if [ -f "$HEALTH_CHECK_SCRIPT" ]; then
        node "$HEALTH_CHECK_SCRIPT"
        if [ $? -eq 0 ]; then
            log_message "Health check passed"
        else
            log_message "Health check failed, restarting application..."
            restart_if_needed
        fi
    fi
}

# Function to check disk space
check_disk_space() {
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        log_message "Warning: Disk usage is ${DISK_USAGE}%"
        cleanup_logs
    fi
}

# Function to monitor memory usage
check_memory() {
    if command -v free >/dev/null 2>&1; then
        MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        log_message "Memory usage: ${MEMORY_USAGE}%"
    fi
}

# Main maintenance routine
main() {
    log_message "Starting Sky IQ maintenance check..."
    
    # Check application status
    restart_if_needed
    
    # Run health check
    run_health_check
    
    # System checks
    check_disk_space
    check_memory
    
    log_message "Maintenance check completed"
}

# Run main function
main