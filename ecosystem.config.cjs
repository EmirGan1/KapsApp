module.exports = {
  apps: [
    {
      name: "kapsapp-production",
      script: "./dist/server.cjs",
      instances: 1, // Single instance for WebSocket state consistency & memory efficiency (1.5GB total VDS allocation)
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1250M", // PM2 auto-restart safety net
      node_args: "--max-old-space-size=1200", // 1200MB V8 Heap ceiling
      env: {
        NODE_ENV: "production",
        PORT: 5000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      },
      exp_backoff_restart_delay: 100,
      listen_timeout: 8000,
      kill_timeout: 4000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true
    }
  ]
};
