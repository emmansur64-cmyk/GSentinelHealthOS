import { prisma } from "../src/lib/prisma";

async function main() {
  // Produccion: sin datos demo, seed intencionalmente vacio.
  console.log("Seed sin datos mock/demo: no se insertaron registros.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
