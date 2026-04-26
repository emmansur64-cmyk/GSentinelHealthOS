const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- ULTIMOS INCOMING (Cualquier número) ---');
    const incomingAll = await prisma.incomingMessage.findMany({
      orderBy: { received_at: 'desc' },
      take: 5
    });
    console.table(incomingAll.map(m => ({ id: m.id, from: m.from_phone, status: m.status, received: m.received_at })));

    console.log('--- ULTIMOS OUTGOING (Cualquier número) ---');
    const outgoingAll = await prisma.outgoingMessage.findMany({
      orderBy: { sent_at: 'desc' },
      take: 5
    });
    console.table(outgoingAll.map(m => ({ id: m.id, to: m.phone, status: m.status, sent: m.sent_at })));

    console.log('--- CONTEO TOTAL POR STATUS (INCOMING) ---');
    const counts = await prisma.incomingMessage.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.table(counts);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma['$disconnect']();
  }
}

main();
