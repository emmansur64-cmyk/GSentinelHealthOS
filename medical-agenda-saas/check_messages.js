const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("--- ULTIMOS 20 OUTGOING_MESSAGES (status=failed) ---");
  try {
    const outgoing = await prisma.outgoingMessage.findMany({
      where: { status: "failed" },
      orderBy: { created_at: "desc" },
      take: 20
    });
    
    outgoing.forEach(m => {
      console.log(`Phone: ${m.phone} | CreatedAt: ${m.created_at.toISOString()} | Error: ${m.error}`);
      console.log(`Msg: ${(m.message || "").substring(0, 120)}...`);
      console.log("---");
    });
  } catch (e) {
    console.error("Error al obtener outgoing:", e.message);
  }

  console.log("\n--- ULTIMOS 20 INCOMING_MESSAGES (status=pending/failed) ---");
  try {
    const incoming = await prisma.incomingMessage.findMany({
      where: { status: { in: ["pending", "failed"] } },
      orderBy: { received_at: "desc" },
      take: 20
    });

    incoming.forEach(m => {
      console.log(`From: ${m.from_phone} | Status: ${m.status} | CreatedAt: ${m.received_at.toISOString()} | Error: ${m.error}`);
      console.log("---");
    });
  } catch (e) {
    console.error("Error al obtener incoming:", e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
