const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const failedAll = await prisma.failedMessage.findMany({
      orderBy: { error_message: 'desc' },
      take: 10
    });
    console.log('--- ULTIMOS FAILED MESSAGES ---');
    console.table(failedAll.map(f => ({ 
      id: f.id, 
      from: f.from_phone, 
      error: f.error_message.substring(0, 50), 
      job_id: f.job_id 
    })));

    const states = await prisma.conversationState.findMany({
      take: 10
    });
    console.log('--- CONVERSATION STATES EXISTENTES ---');
    console.table(states);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma['$disconnect']();
  }
}

main();
