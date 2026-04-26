/**
 * Standalone WhatsApp worker runner.
 *
 * Usage:
 *   npx tsx scripts/start-whatsapp-worker.ts
 *
 * Requires: Redis running, DATABASE_URL configured
 */
import "dotenv/config";

// Fix path aliases for standalone execution
import { register } from "node:module";
import { pathToFileURL } from "node:url";

async function main() {
  console.info("Starting WhatsApp message worker...");

  // Dynamic import to load after env is ready
  const { startWhatsAppWorker, stopWhatsAppWorker } = await import("../src/lib/whatsapp/worker");

  const worker = startWhatsAppWorker();

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, shutting down worker...`);
    await stopWhatsAppWorker();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  console.info("WhatsApp worker is running. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error("Fatal worker error:", error);
  process.exit(1);
});
