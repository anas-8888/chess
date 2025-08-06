import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import app from './src/index.js';
import config from './config/index.js';
import logger from './src/utils/logger.js';
import { testConnection } from './src/config/db.js';

const PORT = config.port || 3000;

// Start HTTP server
import { createServer } from 'http';
const server = createServer(app);

// Attach Socket.IO
import { Server } from 'socket.io';
const io = new Server(server, {
  cors: {
    origin: ['http://192.168.204.221:8080', 'http://192.168.204.221:3000', 'http://192.168.204.221:3001', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000'],
    credentials: true,
  },
});

// Set global io
import { setGlobalIO } from './src/index.js';
setGlobalIO(io);

// Import and initialize friend socket namespace
import { initFriendSocket } from './src/socket/friendSocket.js';
initFriendSocket(io);

// اختبار الاتصال بقاعدة البيانات قبل تشغيل السيرفر
async function startServer() {
  try {
    // اختبار الاتصال بقاعدة البيانات
    const isConnected = await testConnection();
    if (!isConnected) {
      logger.error('Failed to connect to database. Server startup aborted.');
      process.exit(1);
    }

    // تشغيل السيرفر
    server.listen(PORT, () => {
      logger.info(`Server started successfully on port ${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Database: ${config.db.host}:${config.db.port}/${config.db.database}`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();

export { io };
