import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type NoShowDatasetRow = {
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  specialty: string;
  status: string;
  day_of_week: number;
  hour_of_day: number;
  lead_time_days: number;
  created_at: Date;
  datetime: Date;
};

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes("\"") || text.includes("\r")) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

export function encodeNoShowDatasetToCsv(rows: NoShowDatasetRow[]): string {
  const header = [
    "appointment_id",
    "doctor_id",
    "patient_id",
    "specialty",
    "status",
    "day_of_week",
    "hour_of_day",
    "lead_time_days",
    "created_at",
    "datetime",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.appointment_id,
        row.doctor_id,
        row.patient_id,
        row.specialty,
        row.status,
        row.day_of_week,
        row.hour_of_day,
        Number(row.lead_time_days.toFixed(6)),
        row.created_at.toISOString(),
        row.datetime.toISOString(),
      ]
        .map((value) => escapeCsvCell(value))
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function encodeNoShowDatasetToParquet(rows: NoShowDatasetRow[]): Promise<Buffer> {
  const parquet = await import("parquetjs-lite");
  const schema = new parquet.ParquetSchema({
    appointment_id: { type: "UTF8" },
    doctor_id: { type: "UTF8" },
    patient_id: { type: "UTF8" },
    specialty: { type: "UTF8" },
    status: { type: "UTF8" },
    day_of_week: { type: "INT32" },
    hour_of_day: { type: "INT32" },
    lead_time_days: { type: "DOUBLE" },
    created_at: { type: "TIMESTAMP_MILLIS" },
    datetime: { type: "TIMESTAMP_MILLIS" },
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gsentinel-parquet-"));
  const filePath = path.join(tempDir, "dataset.parquet");

  try {
    const writer = await parquet.ParquetWriter.openFile(schema, filePath);
    try {
      for (const row of rows) {
        await writer.appendRow({
          appointment_id: row.appointment_id,
          doctor_id: row.doctor_id,
          patient_id: row.patient_id,
          specialty: row.specialty,
          status: row.status,
          day_of_week: row.day_of_week,
          hour_of_day: row.hour_of_day,
          lead_time_days: Number(row.lead_time_days.toFixed(6)),
          created_at: row.created_at,
          datetime: row.datetime,
        });
      }
    } finally {
      await writer.close();
    }

    const fileBuffer = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
    return Buffer.from(fileBuffer);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
