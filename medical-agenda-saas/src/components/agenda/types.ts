export type AppointmentStatus = "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";

export type Doctor = {
  user_id: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  appointment_duration?: number;
  buffer_minutes?: number;
  user: {
    name: string;
    email: string;
  };
};

export type Patient = {
  id: string;
  name: string;
  document: string;
  contact: string;
  notes?: string | null;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  datetime: string;
  duration: number;
  status: AppointmentStatus;
  source: "manual" | "web" | "whatsapp" | "phone";
  notes?: string | null;
  patient: Patient;
  doctor: {
    user: {
      name: string;
    };
  };
};

export type ScheduleRule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    appointmentId: string;
    doctorId: string;
    patientId: string;
    doctorName: string;
    patientName: string;
    status: AppointmentStatus;
    duration: number;
  };
};

export type AppointmentMutationPayload = {
  patient_id: string;
  doctor_id: string;
  datetime: string;
  duration: number;
  status: AppointmentStatus;
  source: "manual" | "web" | "whatsapp" | "phone";
  notes?: string;
};
