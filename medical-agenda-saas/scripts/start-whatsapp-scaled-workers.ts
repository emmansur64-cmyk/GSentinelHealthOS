/**
 * Standalone scalable WhatsApp workers runner.
 *
 * Usage:
 *   npm run whatsapp:scaled-worker
 */
import "dotenv/config";

async function main() {
  console.info("Starting scalable WhatsApp workers...");

  const { startScaledWorkers, stopScaledWorkers } = await import("../src/lib/whatsapp/scaled-workers");

  await startScaledWorkers();

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, shutting down scalable workers...`);
    await stopScaledWorkers();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.info("Scalable WhatsApp workers are running. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error("Fatal scalable workers error:", error);
  process.exit(1);
});
