import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      appointmentMinutes: 30,
      bufferMinutes: 10,
      workStartTime: "08:00",
      workEndTime: "18:00",
      workDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
  });

  const doctorA = await prisma.doctor.upsert({
    where: { licenseCode: "MED-0001" },
    update: {},
    create: {
      fullName: "Dra. Ana Ruiz",
      specialty: "Cardiologia",
      licenseCode: "MED-0001",
    },
  });

  const doctorB = await prisma.doctor.upsert({
    where: { licenseCode: "MED-0002" },
    update: {},
    create: {
      fullName: "Dr. Mateo Silva",
      specialty: "Clinica Medica",
      licenseCode: "MED-0002",
    },
  });

  const patientA = await prisma.patient.create({
    data: {
      fullName: "Juan Perez",
      email: "juan.perez@example.com",
      phone: "+5491100000001",
    },
  }).catch(async () => {
    return prisma.patient.findFirst({ where: { email: "juan.perez@example.com" } });
  });

  const patientB = await prisma.patient.create({
    data: {
      fullName: "Maria Gomez",
      email: "maria.gomez@example.com",
      phone: "+5491100000002",
    },
  }).catch(async () => {
    return prisma.patient.findFirst({ where: { email: "maria.gomez@example.com" } });
  });

  const today = new Date();
  today.setSeconds(0, 0);

  const startA = new Date(today);
  startA.setHours(9, 0, 0, 0);
  const endA = new Date(startA.getTime() + 30 * 60000);

  const startB = new Date(today);
  startB.setHours(10, 0, 0, 0);
  const endB = new Date(startB.getTime() + 30 * 60000);

  const existing = await prisma.appointment.count({
    where: {
      startsAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
  });

  if (existing === 0 && patientA && patientB) {
    await prisma.appointment.createMany({
      data: [
        {
          startsAt: startA,
          endsAt: endA,
          status: "confirmed",
          reason: "Control cardiologico",
          patientId: patientA.id,
          doctorId: doctorA.id,
        },
        {
          startsAt: startB,
          endsAt: endB,
          status: "pending",
          reason: "Consulta clinica",
          patientId: patientB.id,
          doctorId: doctorB.id,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
