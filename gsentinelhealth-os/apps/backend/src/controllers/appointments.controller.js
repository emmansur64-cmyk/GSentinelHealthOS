import {
  createAppointment,
  deleteAppointment,
  getAppointmentsByDate,
  updateAppointment,
} from "../services/appointment.service.js";

function resolveEventType(payload) {
  if (payload.status === "cancelled") return "appointment_cancelled";
  return "appointment_updated";
}

export async function getAppointmentsController(req, res) {
  const date = req.validated.query?.date;
  const data = await getAppointmentsByDate(date);
  res.json(data);
}

export async function createAppointmentController(req, res) {
  const created = await createAppointment(req.validated.body);

  req.notifier?.emit({
    type: "appointment_created",
    appointment_id: created.id,
    appointment: created,
    message: `Turno creado para ${created.patient.name}`,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json(created);
}

export async function patchAppointmentController(req, res) {
  const id = req.validated.params.id;
  const payload = req.validated.body;
  const updated = await updateAppointment(id, payload);

  req.notifier?.emit({
    type: resolveEventType(payload),
    appointment_id: updated.id,
    appointment: updated,
    message: `Turno actualizado para ${updated.patient.name}`,
    timestamp: new Date().toISOString(),
  });

  res.json(updated);
}

export async function deleteAppointmentController(req, res) {
  const id = req.validated.params.id;
  const removed = await deleteAppointment(id);

  req.notifier?.emit({
    type: "appointment_cancelled",
    appointment_id: removed.id,
    message: "Turno cancelado",
    timestamp: new Date().toISOString(),
  });

  res.json(removed);
}
