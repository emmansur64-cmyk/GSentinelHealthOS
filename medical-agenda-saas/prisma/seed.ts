import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seed de produccion vacio: no se insertaron registros.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
