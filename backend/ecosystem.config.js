module.exports = {
  apps: [{
    name: 'myday-tracker-server',
    script: 'node_modules/tsx/dist/cli.mjs',
    args: 'backend/server.ts',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/myday-tracker-error.log',
    out_file: '/var/log/myday-tracker-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'dist', '*.log']
  }]
};

