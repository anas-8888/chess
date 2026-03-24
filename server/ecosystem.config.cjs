module.exports = {
  apps: [
    {
      name: "chess_node",
      script: "server.js",
      interpreter: "node",
      cwd: "/home/chess.nexa-group.net",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
