import http from "http";
import { WebSocketServer } from "ws";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { createNotifier } from "./lib/notifier.js";

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/ws/notifications" });
const notifier = createNotifier(wss);
const app = createApp({
  corsOrigin: config.corsOrigin,
  notifier,
});

server.on("request", app);

wss.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      type: "connection_established",
      message: "Canal de notificaciones conectado",
      timestamp: new Date().toISOString(),
    }),
  );
});

server.listen(config.port, () => {
  logger.info({ port: config.port }, "backend_started");
});

process.on("SIGINT", () => {
  logger.info("shutting_down");
  server.close(() => process.exit(0));
});
