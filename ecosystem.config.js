module.exports = {
  apps: [{
    name: 'sky-iq-app',
    script: 'server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx/esm',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 2000,
    max_restarts: 10,
    min_uptime: '5s',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    listen_timeout: 5000,
    shutdown_with_message: true,
    wait_ready: true,
    // Health check configuration
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    // Graceful restart settings
    kill_retry_time: 100,
    pmx: true,
    // Long-term stability features
    cron_restart: '0 3 * * *', // Restart daily at 3 AM
    ignore_watch: ['node_modules', 'logs', 'dist'],
    // Memory and CPU monitoring
    monitoring: {
      http: true,
      https: true,
      port: 9615
    }
  }]
};