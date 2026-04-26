const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone1 = '5492634723151';
  const phone2 = '2634723151';

  try {
    const incoming = await prisma.incomingMessage.findMany({
      where: {
        OR: [
          { from_phone: { contains: phone1 } },
          { from_phone: { contains: phone2 } }
        ]
      },
      orderBy: { received_at: 'desc' },
      take: 20
    });
    console.log('--- INCOMING MESSAGES ---');
    console.table(incoming.map(m => ({ id: m.id, from: m.from_phone, status: m.status, received: m.received_at })));

    const outgoing = await prisma.outgoingMessage.findMany({
      where: {
        OR: [
          { phone: { contains: phone1 } },
          { phone: { contains: phone2 } }
        ]
      },
      orderBy: { sent_at: 'desc' },
      take: 20
    });
    console.log('--- OUTGOING MESSAGES ---');
    console.table(outgoing.map(m => ({ id: m.id, to: m.phone, status: m.status, sent: m.sent_at })));

    const failed = await prisma.failedMessage.findMany({
      where: {
        OR: [
          { from_phone: { contains: phone1 } },
          { from_phone: { contains: phone2 } }
        ]
      },
      orderBy: { error_message: 'desc' },
      take: 20
    });
    console.log('--- FAILED MESSAGES ---');
    console.table(failed.map(f => ({ id: f.id, phone: f.from_phone, error: f.error_message })));

    const state = await prisma.conversationState.findMany({
      where: {
        OR: [
          { phone: { contains: phone1 } },
          { phone: { contains: phone2 } }
        ]
      }
    });
    console.log('--- CONVERSATION STATE ---');
    console.table(state);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const counts = await prisma.incomingMessage.groupBy({
      by: ['status'],
      where: { received_at: { gte: last24h } },
      _count: { id: true }
    });
    console.log('--- COUNTS (Last 24h) ---');
    console.table(counts);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma['$disconnect']();
  }
}

main();
