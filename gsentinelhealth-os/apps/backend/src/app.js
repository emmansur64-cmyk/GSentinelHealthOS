import cors from "cors";
import express from "express";
import morgan from "morgan";
import pinoHttp from "pino-http";

import { createApiRouter } from "./routes/index.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { logger } from "./lib/logger.js";

export function createApp({ corsOrigin, notifier }) {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      autoLogging: true,
    }),
  );
  app.use(morgan("dev"));

  app.use((req, _, next) => {
    req.notifier = notifier;
    next();
  });

  const apiRouter = createApiRouter();

  app.use("/", apiRouter);
  app.use("/api", apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
