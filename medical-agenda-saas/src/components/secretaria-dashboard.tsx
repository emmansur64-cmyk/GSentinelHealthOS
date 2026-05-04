"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { isSameDay } from "date-fns";
import { AlertTriangle, CalendarCheck2, Clipboard, Clock3, ImagePlus, LoaderCircle, Pencil, Plus, Trash2, UserRound, UserX2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FailedMessagesPanel } from "@/components/failed-messages-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatMedicalImageAnalysisReport, type AiImageAnalysisResult } from "@/lib/ai-image-analysis-format";
import { fetchJsonWithRetry } from "@/lib/http-client";

type Doctor = {
  user_id: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  appointment_duration?: number;
  buffer_minutes?: number;
  start_time?: string;
  end_time?: string;
  working_days?: string[];
  user: { name: string; email: string };
};

type Patient = {
  id: string;
  name: string;
  document: string;
  contact: string;
  insurance?: string | null;
  notes?: string | null;
};

type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  datetime: string;
  duration: number;
  status: string;
  source: string;
  notes?: string | null;
  patient: Patient;
  doctor: { user: { name: string } };
};

type AvailabilityRule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

const weekDays = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const statusOptions = [
  { label: "pendiente", value: "scheduled" },
  { label: "confirmado", value: "confirmed" },
  { label: "cancelado", value: "cancelled" },
];

const sourceOptions = [
  { label: "manual", value: "manual" },
  { label: "whatsapp", value: "whatsapp" },
  { label: "web", value: "web" },
  { label: "phone", value: "phone" },
];

const eventColorByStatus: Record<string, string> = {
  scheduled: "#f59e0b",
  confirmed: "#10b981",
  cancelled: "#ef4444",
  completed: "#16a34a",
  no_show: "#f97316",
};

const statusLabelByValue: Record<string, string> = {
  scheduled: "pendiente",
  confirmed: "confirmado",
  cancelled: "cancelado",
  completed: "atendido",
  no_show: "ausente",
};

type AppointmentForm = {
  id?: string;
  patient_id: string;
  doctor_id: string;
  datetime: string;
  duration: number;
  status: string;
  source: string;
  notes: string;
  tipo_consulta: "primera_vez" | "control" | "urgencia";
};

type RuleForm = {
  id?: string;
  doctor_id: string;
  day_of_week: string;
  specific_date: string;
  start_time: string;
  end_time: string;
  slot_duration: string;
};

type PatientForm = {
  id?: string;
  name: string;
  document: string;
  contact: string;
  insurance: string;
  notes: string;
};

type DoctorForm = {
  id?: string;
  name: string;
  email: string;
  password: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  appointment_duration: string;
  buffer_minutes: string;
  start_time: string;
  end_time: string;
  working_days: string;
};

const emptyAppointmentForm: AppointmentForm = {
  patient_id: "",
  doctor_id: "",
  datetime: "",
  duration: 20,
  status: "scheduled",
  source: "manual",
  notes: "",
  tipo_consulta: "control",
};

const emptyRuleForm: RuleForm = {
  doctor_id: "",
  day_of_week: "1",
  specific_date: "",
  start_time: "09:00",
  end_time: "17:00",
  slot_duration: "30",
};

const emptyPatientForm: PatientForm = {
  name: "",
  document: "",
  contact: "",
  insurance: "",
  notes: "",
};

const emptyDoctorForm: DoctorForm = {
  name: "",
  email: "",
  password: "",
  specialty: "",
  matricula: "",
  ai_tag: "",
  appointment_duration: "30",
  buffer_minutes: "10",
  start_time: "08:00",
  end_time: "18:00",
  working_days: "monday,tuesday,wednesday,thursday,friday",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJsonWithRetry<T>(url, init, {
    retries: 2,
    retryDelayMs: 350,
    timeoutMs: 12_000,
  });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeTime(raw: string): string | null {
  const cleaned = raw.replace(".", ":").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

type Confidence = "alta" | "media" | "baja";

type ParsedAvailability = {
  dia: "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Sabado" | "Domingo";
  horaInicio: string;
  horaFin: string;
  intervalo: number | null;
};

type ParsedDoctor = {
  nombre: string;
  matricula: string | null;
  especialidad: string | null;
  confidence: Confidence;
  disponibilidad: ParsedAvailability[];
};

type ParsedMedicalSheet = {
  medicos: ParsedDoctor[];
};

const dayTokenMap: Record<string, ParsedAvailability["dia"]> = {
  lun: "Lunes",
  lunes: "Lunes",
  mar: "Martes",
  martes: "Martes",
  mie: "Miercoles",
  miercoles: "Miercoles",
  miércoles: "Miercoles",
  jue: "Jueves",
  jueves: "Jueves",
  vie: "Viernes",
  viernes: "Viernes",
  sab: "Sabado",
  sabado: "Sabado",
  sábado: "Sabado",
  dom: "Domingo",
  domingo: "Domingo",
};

const dayToWeekNumber: Record<ParsedAvailability["dia"], number> = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  Miercoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sabado: 6,
};

function normalizeTimeLoose(raw: string): string | null {
  const cleaned = raw.trim().replace(".", ":");
  if (/^\d{1,2}$/.test(cleaned)) {
    const hour = Number(cleaned);
    if (hour >= 0 && hour <= 23) return `${String(hour).padStart(2, "0")}:00`;
  }
  if (/^\d{1,2}:\d{1,2}$/.test(cleaned)) {
    const [h, m] = cleaned.split(":").map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return normalizeTime(cleaned);
}

function parseDayTokens(text: string): ParsedAvailability["dia"][] {
  const matches = text.match(/\b(lun(?:es)?|mar(?:tes)?|mie(?:rcoles)?|mi[eé]rcoles|jue(?:ves)?|vie(?:rnes)?|sab(?:ado)?|s[aá]bado|dom(?:ingo)?)\b/gi) ?? [];
  const unique = new Set<ParsedAvailability["dia"]>();
  for (const token of matches) {
    const mapped = dayTokenMap[normalizeText(token)];
    if (mapped) unique.add(mapped);
  }
  return Array.from(unique);
}

function parseTimeRanges(text: string): Array<{ horaInicio: string; horaFin: string }> {
  const ranges = Array.from(text.matchAll(/(\d{1,2}(?::|\.)?\d{0,2})\s*(?:-|a|hasta)\s*(\d{1,2}(?::|\.)?\d{0,2})/gi));
  return ranges
    .map((match) => {
      const horaInicio = normalizeTimeLoose(match[1]);
      const horaFin = normalizeTimeLoose(match[2]);
      if (!horaInicio || !horaFin) return null;
      return { horaInicio, horaFin };
    })
    .filter((value): value is { horaInicio: string; horaFin: string } => value !== null);
}

function buildStructuredInterpretation(ocrText: string): ParsedMedicalSheet {
  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const doctorMap = new Map<string, ParsedDoctor>();
  let currentDoctorKey: string | null = null;

  const upsertDoctor = (input: { nombre: string; matricula: string | null; especialidad: string | null; confidence: Confidence }) => {
    const key = normalizeText(`${input.nombre}|${input.matricula ?? ""}`);
    const existing = doctorMap.get(key);
    if (existing) {
      if (!existing.matricula && input.matricula) existing.matricula = input.matricula;
      if (!existing.especialidad && input.especialidad) existing.especialidad = input.especialidad;
      if (existing.confidence === "baja" && input.confidence !== "baja") existing.confidence = input.confidence;
      currentDoctorKey = key;
      return;
    }

    doctorMap.set(key, {
      nombre: input.nombre,
      matricula: input.matricula,
      especialidad: input.especialidad,
      confidence: input.confidence,
      disponibilidad: [],
    });
    currentDoctorKey = key;
  };

  for (const line of lines) {
    const doctorLine = line.match(/(?:dr\.?|dra\.?|doctor(?:a)?)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][\p{L}\s'.-]{3,})/iu);
    const matriculaLine = line.match(/(?:matr[ií]cula|mat\.?|mn|mp)\s*[:#-]?\s*([A-Za-z0-9-]{4,})/i);
    const especialidadLine = line.match(/(?:especialidad|esp\.?|profesi[oó]n)\s*[:\-]?\s*([\p{L}\s]{3,})/iu);

    if (doctorLine) {
      upsertDoctor({
        nombre: doctorLine[1].trim(),
        matricula: matriculaLine?.[1]?.trim() ?? null,
        especialidad: especialidadLine?.[1]?.trim() ?? null,
        confidence: matriculaLine ? "alta" : "media",
      });
    } else if (matriculaLine && currentDoctorKey) {
      const current = doctorMap.get(currentDoctorKey);
      if (current && !current.matricula) {
        current.matricula = matriculaLine[1].trim();
        if (current.confidence === "media") current.confidence = "alta";
      }
    }

    const dayTokens = parseDayTokens(line);
    const ranges = parseTimeRanges(line);
    const intervalMatch = line.match(/(\d{1,3})\s*(?:min|minuto|minutos)/i);
    const intervalo = intervalMatch ? Number(intervalMatch[1]) : null;

    if (currentDoctorKey && dayTokens.length > 0 && ranges.length > 0) {
      const current = doctorMap.get(currentDoctorKey);
      if (!current) continue;

      for (const dia of dayTokens) {
        for (const range of ranges) {
          current.disponibilidad.push({
            dia,
            horaInicio: range.horaInicio,
            horaFin: range.horaFin,
            intervalo: Number.isFinite(intervalo) ? intervalo : null,
          });
        }
      }
    }
  }

  return {
    medicos: Array.from(doctorMap.values()).filter((doctor) => doctor.disponibilidad.length > 0),
  };
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs";

  const bytes = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    parts.push(text.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return parts.join("\n");
}

async function extractTextFromImage(file: File): Promise<string> {
  const tesseract = await import("tesseract.js");
  const { data } = await tesseract.recognize(file, "spa+eng");
  return data.text ?? "";
}

export function SecretariaDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [focusDate, setFocusDate] = useState<Date>(new Date());
  const [calendarStart, setCalendarStart] = useState<Date>(new Date());
  const [calendarEnd, setCalendarEnd] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AppointmentForm>(emptyAppointmentForm);
  const [editForm, setEditForm] = useState<AppointmentForm>(emptyAppointmentForm);
  const [patientOpen, setPatientOpen] = useState(false);
  const [patientForm, setPatientForm] = useState<PatientForm>(emptyPatientForm);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorForm, setDoctorForm] = useState<DoctorForm>(emptyDoctorForm);

  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm);
  const [ruleEditOpen, setRuleEditOpen] = useState(false);
  const [ruleEditForm, setRuleEditForm] = useState<RuleForm>(emptyRuleForm);
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState("10");
  const [workDays, setWorkDays] = useState("Lunes a Viernes");
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [processingManualFile, setProcessingManualFile] = useState(false);
  const [parsedManualSheet, setParsedManualSheet] = useState<ParsedMedicalSheet | null>(null);
  const manualUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiImageAnalysisResult | null>(null);
  const [analysisPreviewUrl, setAnalysisPreviewUrl] = useState<string | null>(null);
  const analysisInputRef = useRef<HTMLInputElement | null>(null);

  const loadCoreData = useCallback(async () => {
    setLoading(true);
    try {
      const [doctorsData, patientsData, rulesData] = await Promise.all([
        fetchJson<Doctor[]>("/api/doctors"),
        fetchJson<Patient[]>("/api/patients"),
        fetchJson<AvailabilityRule[]>("/api/schedules"),
      ]);

      setDoctors(doctorsData);
      setPatients(patientsData);
      setRules(rulesData);

      if (selectedDoctorId === "all" && doctorsData.length > 0) {
        setRuleForm((prev) => ({ ...prev, doctor_id: doctorsData[0].user_id }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar datos");
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  const loadAppointments = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("start", calendarStart.toISOString());
    params.set("end", calendarEnd.toISOString());
    if (selectedDoctorId !== "all") params.set("doctor_id", selectedDoctorId);

    try {
      const appointmentsData = await fetchJson<Appointment[]>(`/api/appointments?${params.toString()}`);
      setAppointments(appointmentsData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar turnos");
    }
  }, [calendarEnd, calendarStart, selectedDoctorId]);

  useEffect(() => {
    void loadCoreData();
  }, [loadCoreData]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (!analysisFile || !analysisFile.type.startsWith("image/")) {
      setAnalysisPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(analysisFile);
    setAnalysisPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [analysisFile]);

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      appointments.map((appointment) => {
        const start = new Date(appointment.datetime);
        const end = new Date(start.getTime() + appointment.duration * 60 * 1000);
        const color = eventColorByStatus[appointment.status] ?? "#64748b";

        return {
          id: appointment.id,
          title: `${appointment.patient.name}`,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: color,
          borderColor: color,
          textColor: "#ffffff",
          extendedProps: {
            status: appointment.status,
            doctorName: appointment.doctor.user.name,
            specialty: doctors.find((doctor) => doctor.user_id === appointment.doctor_id)?.specialty ?? "",
          },
        };
      }),
    [appointments, doctors],
  );

  const setFormField = (field: keyof AppointmentForm, value: string | number, mode: "create" | "edit") => {
    if (mode === "create") {
      setCreateForm((prev) => ({ ...prev, [field]: value }));
      return;
    }
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openPatientCreate = () => {
    setPatientForm(emptyPatientForm);
    setPatientOpen(true);
  };

  const openPatientEdit = (patient: Patient) => {
    setPatientForm({
      id: patient.id,
      name: patient.name,
      document: patient.document,
      contact: patient.contact,
      insurance: patient.insurance ?? "",
      notes: patient.notes ?? "",
    });
    setPatientOpen(true);
  };

  const savePatient = async () => {
    const name = patientForm.name.trim();
    const document = patientForm.document.trim();
    const contact = patientForm.contact.trim();
    const insurance = patientForm.insurance.trim();

    if (!name || !document || !contact) {
      toast.error("Completa apellido y nombre, DNI y telefono antes de guardar");
      return;
    }

    setSaving(true);
    try {
      const saved = await fetchJson<Patient>(patientForm.id ? `/api/patients/${patientForm.id}` : "/api/patients", {
        method: patientForm.id ? "PUT" : "POST",
        body: JSON.stringify({
          name,
          document,
          contact,
          insurance: insurance || null,
          notes: patientForm.notes.trim() || undefined,
        }),
      });

      setPatients((prev) => {
        if (patientForm.id) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...prev];
      });
      if (!createForm.patient_id && !patientForm.id) {
        setCreateForm((prev) => ({ ...prev, patient_id: saved.id }));
      }
      setPatientOpen(false);
      setPatientForm(emptyPatientForm);
      toast.success(patientForm.id ? "Paciente actualizado" : "Paciente creado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar paciente");
    } finally {
      setSaving(false);
    }
  };

  const analyzeSecretaryImage = async () => {
    if (!analysisFile) {
      toast.error("Selecciona una imagen o PDF para analizar");
      return;
    }

    setAnalysisLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", analysisFile);
      formData.set("source", "secretary_panel");

      const response = await fetch("/api/ai/image-analysis", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: AiImageAnalysisResult;
        error?: { message?: string };
      };

      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error?.message ?? "No se pudo analizar la imagen. Verificá el formato o intentá nuevamente.");
      }

      setAnalysisResult(payload.data);
      toast.success("Análisis asistido generado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen. Verificá el formato o intentá nuevamente.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const copyAnalysisReport = async () => {
    if (!analysisResult) return;
    await navigator.clipboard.writeText(formatMedicalImageAnalysisReport(analysisResult));
    toast.success("Informe copiado");
  };

  const attachAnalysisToOpenAppointment = () => {
    if (!analysisResult || !editForm.id) return;
    const report = formatMedicalImageAnalysisReport(analysisResult);
    setEditForm((prev) => ({
      ...prev,
      notes: [prev.notes.trim(), report].filter(Boolean).join("\n\n"),
    }));
    setEditOpen(true);
    toast.success("Informe agregado al turno abierto. Revisá y guardá los cambios.");
  };

  const attachAnalysisToOpenPatient = () => {
    if (!analysisResult || !patientForm.id) return;
    const report = formatMedicalImageAnalysisReport(analysisResult);
    setPatientForm((prev) => ({
      ...prev,
      notes: [prev.notes.trim(), report].filter(Boolean).join("\n\n"),
    }));
    setPatientOpen(true);
    toast.success("Informe agregado al paciente abierto. Revisá y guardá los cambios.");
  };

  const openDoctorCreate = () => {
    setDoctorForm(emptyDoctorForm);
    setDoctorOpen(true);
  };

  const openDoctorEdit = (doctor: Doctor) => {
    setDoctorForm({
      id: doctor.user_id,
      name: doctor.user.name,
      email: doctor.user.email,
      password: "",
      specialty: doctor.specialty,
      matricula: doctor.matricula,
      ai_tag: doctor.ai_tag,
      appointment_duration: String(doctor.appointment_duration ?? 30),
      buffer_minutes: String(doctor.buffer_minutes ?? 10),
      start_time: doctor.start_time ?? "08:00",
      end_time: doctor.end_time ?? "18:00",
      working_days: (doctor.working_days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"]).join(","),
    });
    setDoctorOpen(true);
  };

  const saveDoctor = async () => {
    const name = doctorForm.name.trim();
    const email = doctorForm.email.trim().toLowerCase();
    const specialty = doctorForm.specialty.trim();
    const matricula = doctorForm.matricula.trim();
    const aiTag = doctorForm.ai_tag.trim();
    const workingDays = doctorForm.working_days
      .split(",")
      .map((day) => day.trim())
      .filter(Boolean);

    if (!name || !specialty || !matricula || !aiTag) {
      toast.error("Completa nombre, especialidad, matricula y etiqueta IA del medico");
      return;
    }
    if (!doctorForm.id && (!email || doctorForm.password.length < 12)) {
      toast.error("Para crear medico completa email y clave inicial de al menos 12 caracteres");
      return;
    }

    setSaving(true);
    try {
      await fetchJson(doctorForm.id ? `/api/doctors/${doctorForm.id}` : "/api/doctors", {
        method: doctorForm.id ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          ...(doctorForm.id ? {} : { email, password: doctorForm.password }),
          specialty,
          matricula,
          ai_tag: aiTag,
          appointment_duration: Number(doctorForm.appointment_duration),
          buffer_minutes: Number(doctorForm.buffer_minutes),
          start_time: doctorForm.start_time,
          end_time: doctorForm.end_time,
          working_days: workingDays,
        }),
      });

      await loadCoreData();
      setDoctorOpen(false);
      setDoctorForm(emptyDoctorForm);
      toast.success(doctorForm.id ? "Medico actualizado" : "Medico creado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar medico");
    } finally {
      setSaving(false);
    }
  };

  const onCalendarSelect = (selection: DateSelectArg) => {
    const duration = Math.max(10, Math.round((selection.end.getTime() - selection.start.getTime()) / 60000));
    const defaultDoctor = selectedDoctorId !== "all" ? selectedDoctorId : doctors[0]?.user_id ?? "";

    setFocusDate(selection.start);
    setCreateForm({
      ...emptyAppointmentForm,
      doctor_id: defaultDoctor,
      patient_id: patients[0]?.id ?? "",
      datetime: selection.start.toISOString(),
      duration,
    });
    setCreateOpen(true);
  };

  const onCalendarDatesSet = (dateSet: DatesSetArg) => {
    setCalendarStart(dateSet.start);
    setCalendarEnd(dateSet.end);
  };

  const openAppointmentForEdit = (appointment: Appointment) => {
    setFocusDate(new Date(appointment.datetime));
    setEditForm({
      id: appointment.id,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      datetime: appointment.datetime,
      duration: appointment.duration,
      status: appointment.status,
      source: appointment.source,
      notes: appointment.notes ?? "",
      tipo_consulta: "control",
    });
    setEditOpen(true);
  };

  const onEventClick = (eventClick: EventClickArg) => {
    const appointment = appointments.find((item) => item.id === eventClick.event.id);
    if (!appointment) return;

    openAppointmentForEdit(appointment);
  };

  const replaceAppointmentInState = (id: string, patch: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const onEventDrop = async (eventDrop: EventDropArg) => {
    const appointment = appointments.find((item) => item.id === eventDrop.event.id);
    if (!appointment) return;

    const nextStart = eventDrop.event.start;
    const nextEnd = eventDrop.event.end;
    if (!nextStart || !nextEnd) return;

    const nextDuration = Math.max(10, Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000));
    const previous = { datetime: appointment.datetime, duration: appointment.duration };

    replaceAppointmentInState(appointment.id, {
      datetime: nextStart.toISOString(),
      duration: nextDuration,
    });

    try {
      await fetchJson(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ datetime: nextStart.toISOString(), duration: nextDuration }),
      });
      toast.success("Horario actualizado");
    } catch (error) {
      replaceAppointmentInState(appointment.id, previous);
      eventDrop.revert();
      toast.error(error instanceof Error ? error.message : "No se pudo mover turno");
    }
  };

  const onEventResize = async (eventResize: EventResizeDoneArg) => {
    const appointment = appointments.find((item) => item.id === eventResize.event.id);
    if (!appointment) return;

    const nextStart = eventResize.event.start;
    const nextEnd = eventResize.event.end;
    if (!nextStart || !nextEnd) return;

    const nextDuration = Math.max(10, Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000));
    const previous = { duration: appointment.duration };

    replaceAppointmentInState(appointment.id, { duration: nextDuration });

    try {
      await fetchJson(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ duration: nextDuration }),
      });
      toast.success("Duracion actualizada");
    } catch (error) {
      replaceAppointmentInState(appointment.id, previous);
      eventResize.revert();
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar duracion");
    }
  };

  const createAppointment = async () => {
    if (!createForm.patient_id || !createForm.doctor_id || !createForm.datetime) {
      toast.error("Paciente, medico y fecha son obligatorios");
      return;
    }

    setSaving(true);
    const tempId = `temp-${Date.now()}`;
    const patient = patients.find((item) => item.id === createForm.patient_id);
    const doctor = doctors.find((item) => item.user_id === createForm.doctor_id);

    const optimistic: Appointment = {
      id: tempId,
      patient_id: createForm.patient_id,
      doctor_id: createForm.doctor_id,
      datetime: createForm.datetime,
      duration: createForm.duration,
      status: createForm.status,
      source: createForm.source,
      notes: createForm.notes,
      patient: {
        id: createForm.patient_id,
        name: patient?.name ?? "",
        document: patient?.document ?? "",
        contact: patient?.contact ?? "",
        notes: patient?.notes,
      },
      doctor: { user: { name: doctor?.user.name ?? "Doctor" } },
    };

    setAppointments((prev) => [optimistic, ...prev]);

    try {
      const created = await fetchJson<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: createForm.patient_id,
          doctor_id: createForm.doctor_id,
          datetime: createForm.datetime,
          duration: createForm.duration,
          status: createForm.status,
          source: createForm.source,
          notes: [createForm.notes, `tipo_consulta:${createForm.tipo_consulta}`].filter(Boolean).join(" | ") || undefined,
        }),
      });

      setAppointments((prev) => prev.map((item) => (item.id === tempId ? created : item)));
      setCreateOpen(false);
      setCreateForm(emptyAppointmentForm);
      toast.success("Turno creado");
      await loadCoreData();
    } catch (error) {
      setAppointments((prev) => prev.filter((item) => item.id !== tempId));
      toast.error(error instanceof Error ? error.message : "No se pudo crear turno");
    } finally {
      setSaving(false);
    }
  };

  const updateAppointment = async () => {
    if (!editForm.id) return;

    const previous = appointments.find((item) => item.id === editForm.id);
    if (!previous) return;

    const optimisticPatch: Partial<Appointment> = {
      patient_id: editForm.patient_id,
      doctor_id: editForm.doctor_id,
      datetime: editForm.datetime,
      duration: editForm.duration,
      status: editForm.status,
      source: editForm.source,
      notes: editForm.notes,
      patient: {
        id: editForm.patient_id,
        name: patients.find((item) => item.id === editForm.patient_id)?.name ?? previous.patient.name,
        document: patients.find((item) => item.id === editForm.patient_id)?.document ?? previous.patient.document,
        contact: patients.find((item) => item.id === editForm.patient_id)?.contact ?? previous.patient.contact,
        notes: previous.patient.notes,
      },
      doctor: {
        user: {
          name: doctors.find((item) => item.user_id === editForm.doctor_id)?.user.name ?? previous.doctor.user.name,
        },
      },
    };

    replaceAppointmentInState(editForm.id, optimisticPatch);
    setSaving(true);

    try {
      await fetchJson(`/api/appointments/${editForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          patient_id: editForm.patient_id,
          doctor_id: editForm.doctor_id,
          datetime: editForm.datetime,
          duration: editForm.duration,
          status: editForm.status,
          source: editForm.source,
          notes: editForm.notes || undefined,
        }),
      });
      toast.success("Turno actualizado");
      setEditOpen(false);
      await loadCoreData();
    } catch (error) {
      replaceAppointmentInState(editForm.id, previous);
      toast.error(error instanceof Error ? error.message : "No se pudo editar turno");
    } finally {
      setSaving(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    const previous = appointments;
    setAppointments((prev) => prev.filter((item) => item.id !== id));

    try {
      await fetchJson(`/api/appointments/${id}`, { method: "DELETE" });
      toast.success("Turno eliminado");
      setEditOpen(false);
      await loadCoreData();
    } catch (error) {
      setAppointments(previous);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar turno");
    }
  };

  const createRule = async () => {
    if (!ruleForm.doctor_id) {
      toast.error("Selecciona un medico");
      return;
    }

    try {
      await fetchJson("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: ruleForm.doctor_id,
          day_of_week: Number(ruleForm.day_of_week),
          specific_date: ruleForm.specific_date || undefined,
          start_time: ruleForm.start_time,
          end_time: ruleForm.end_time,
          slot_duration: Number(ruleForm.slot_duration),
        }),
      });
      toast.success("Regla creada");
      await loadCoreData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear regla");
    }
  };

  const openRuleEdit = (rule: AvailabilityRule) => {
    const specificDate = rule.specific_date ? new Date(rule.specific_date).toISOString().slice(0, 10) : "";
    setRuleEditForm({
      id: rule.id,
      doctor_id: rule.doctor_id,
      day_of_week: String(rule.day_of_week),
      specific_date: specificDate,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration: String(rule.slot_duration),
    });
    setRuleEditOpen(true);
  };

  const updateRule = async () => {
    if (!ruleEditForm.id) return;

    try {
      await fetchJson(`/api/schedules/${ruleEditForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          day_of_week: Number(ruleEditForm.day_of_week),
          specific_date: ruleEditForm.specific_date || null,
          start_time: ruleEditForm.start_time,
          end_time: ruleEditForm.end_time,
          slot_duration: Number(ruleEditForm.slot_duration),
        }),
      });
      toast.success("Regla actualizada");
      setRuleEditOpen(false);
      await loadCoreData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar regla");
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await fetchJson(`/api/schedules/${id}`, { method: "DELETE" });
      toast.success("Regla eliminada");
      await loadCoreData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar regla");
    }
  };

  const processManualUpload = async () => {
    if (!manualFile) {
      toast.error("Selecciona un archivo primero");
      return;
    }

    if (!/^image\/(png|jpeg)$|^application\/pdf$/i.test(manualFile.type)) {
      toast.error("Formato no soportado. Usa JPG, PNG o PDF");
      return;
    }

    setProcessingManualFile(true);
    try {
      const extractedText = manualFile.type === "application/pdf"
        ? await extractTextFromPdf(manualFile)
        : await extractTextFromImage(manualFile);

      const normalized = normalizeText(extractedText);
      if (!normalized || normalized.length < 8) {
        throw new Error("No se pudo leer contenido util del archivo");
      }

      const parsed = buildStructuredInterpretation(extractedText);
      setParsedManualSheet(parsed);

      if (parsed.medicos.length === 0) {
        throw new Error("No se pudo detectar disponibilidad valida en el documento");
      }

      const candidate = parsed.medicos[0];
      const availability = candidate.disponibilidad[0];
      if (!availability) {
        throw new Error("No hay bloques de disponibilidad interpretables para precargar");
      }

      const foundDoctor = doctors.find((doctor) => {
        if (candidate.matricula && normalizeText(doctor.matricula) === normalizeText(candidate.matricula)) return true;
        if (candidate.nombre && normalizeText(doctor.user.name) === normalizeText(candidate.nombre)) return true;
        return false;
      });

      if (!foundDoctor) {
        throw new Error("No se encontro medico existente por nombre o matricula. No se creo ningun medico automaticamente.");
      }

      const willOverwrite =
        !!ruleForm.doctor_id ||
        !!ruleForm.start_time ||
        !!ruleForm.end_time ||
        !!ruleForm.slot_duration;

      if (willOverwrite) {
        const confirmed = window.confirm("Se reemplazaran los valores actuales del formulario de agenda. Continuar?");
        if (!confirmed) return;
      }

      setRuleForm((prev) => ({
        ...prev,
        doctor_id: foundDoctor.user_id,
        day_of_week: String(dayToWeekNumber[availability.dia] ?? Number(prev.day_of_week) ?? 1),
        start_time: availability.horaInicio,
        end_time: availability.horaFin,
        slot_duration: availability.intervalo !== null ? String(availability.intervalo) : prev.slot_duration,
      }));

      if (availability.intervalo === null) {
        toast.success("Datos detectados cargados. Intervalo no detectado (queda sin inferir en esta etapa).");
      } else {
        toast.success("Datos detectados cargados. Revisa y confirma con 'Agregar'.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar el archivo con IA");
    } finally {
      setProcessingManualFile(false);
    }
  };

  const appointmentsOfDay = useMemo(() => {
    return appointments
      .filter((item) => isSameDay(new Date(item.datetime), focusDate))
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [appointments, focusDate]);

  const dashboardMetrics = useMemo(() => {
    const turnsToday = appointmentsOfDay.length;
    const waiting = appointmentsOfDay.filter((item) => item.status === "scheduled").length;
    const cancelled = appointmentsOfDay.filter((item) => item.status === "cancelled").length;
    const effective = appointmentsOfDay.filter((item) => item.status !== "cancelled").length;
    const occupancy = turnsToday === 0 ? 0 : Math.round((effective / turnsToday) * 100);

    return { turnsToday, waiting, cancelled, occupancy };
  }, [appointmentsOfDay]);

  const alerts = useMemo(() => {
    if (selectedDoctorId === "all") {
      return ["Selecciona un profesional para ver alertas de carga."];
    }

    const day = focusDate.getDay();
    const focusDayIso = focusDate.toISOString().slice(0, 10);
    const doctorRules = rules.filter((rule) => {
      if (rule.doctor_id !== selectedDoctorId) return false;
      const specificDateIso = rule.specific_date ? new Date(rule.specific_date).toISOString().slice(0, 10) : null;
      if (specificDateIso) return specificDateIso === focusDayIso;
      return rule.day_of_week === day;
    });
    if (doctorRules.length === 0) {
      return ["No hay reglas de disponibilidad para este dia."];
    }

    const minutesInRules = doctorRules.reduce((acc, rule) => {
      const [startHour, startMinute] = rule.start_time.split(":").map(Number);
      const [endHour, endMinute] = rule.end_time.split(":").map(Number);
      return acc + (endHour * 60 + endMinute - (startHour * 60 + startMinute));
    }, 0);

    const occupied = appointmentsOfDay
      .filter((item) => item.doctor_id === selectedDoctorId && item.status !== "cancelled")
      .reduce((acc, item) => acc + item.duration, 0);

    const interval = Math.max(10, doctorRules[0]?.slot_duration ?? 30);
    const theoreticalSlots = Math.max(0, Math.floor(minutesInRules / interval));
    const assigned = appointmentsOfDay.filter((item) => item.doctor_id === selectedDoctorId && item.status !== "cancelled").length;
    const freeSlots = Math.max(0, theoreticalSlots - assigned);

    const result = [`Huecos libres estimados: ${freeSlots}`];
    if (occupied > minutesInRules || assigned > theoreticalSlots) {
      result.push("Sobrecarga detectada en el dia seleccionado.");
    }
    return result;
  }, [appointmentsOfDay, focusDate, rules, selectedDoctorId]);

  const selectedDoctorName = useMemo(() => {
    if (selectedDoctorId === "all") return "Todos los profesionales";
    return doctors.find((item) => item.user_id === selectedDoctorId)?.user.name ?? "Profesional";
  }, [doctors, selectedDoctorId]);

  const liveRulePreview = useMemo(() => {
    const [startHour = 0, startMinute = 0] = ruleForm.start_time.split(":").map(Number);
    const [endHour = 0, endMinute = 0] = ruleForm.end_time.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const duration = Number(ruleForm.slot_duration);
    const validWindow = end > start;
    const validDuration = Number.isFinite(duration) && duration >= 10;
    const totalMinutes = validWindow ? end - start : 0;
    const estimatedSlots = validDuration ? Math.floor(totalMinutes / duration) : 0;
    const doctorName = doctors.find((doctor) => doctor.user_id === ruleForm.doctor_id)?.user.name ?? "Profesional";
    const specificDateLabel = ruleForm.specific_date
      ? new Date(`${ruleForm.specific_date}T00:00:00`).toLocaleDateString()
      : null;

    return {
      doctorName,
      dayLabel: specificDateLabel ?? (weekDays[Number(ruleForm.day_of_week)] ?? "Dia"),
      validWindow,
      validDuration,
      totalMinutes,
      estimatedSlots,
    };
  }, [doctors, ruleForm.day_of_week, ruleForm.doctor_id, ruleForm.end_time, ruleForm.slot_duration, ruleForm.specific_date, ruleForm.start_time]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Cargando datos de agenda...
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Image
          src="/logos/GSentinelHealthOS.png"
          alt=""
          width={420}
          height={420}
          className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 object-contain opacity-[0.04] grayscale"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Image
              src="/logos/GSentinelHealthOS.png"
              alt="GSentinelHealthOS"
              width={260}
              height={88}
              className="h-auto w-56 object-contain"
              style={{ height: "auto" }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Panel Secretaria</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Gestion operativa de agenda</h1>
              <p className="mt-1 text-sm text-slate-600">Turnos, profesionales, pacientes y disponibilidad diaria.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:w-auto">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Hoy</p>
              <p className="font-semibold text-slate-950">{dashboardMetrics.turnsToday}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Espera</p>
              <p className="font-semibold text-slate-950">{dashboardMetrics.waiting}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Ocupacion</p>
              <p className="font-semibold text-slate-950">{dashboardMetrics.occupancy}%</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Cancelados</p>
              <p className="font-semibold text-slate-950">{dashboardMetrics.cancelled}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="flex items-end justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Turnos hoy</p>
              <p className="text-3xl font-semibold text-blue-700">{dashboardMetrics.turnsToday}</p>
            </div>
            <CalendarCheck2 className="h-6 w-6 text-blue-500" />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-amber-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="flex items-end justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Pacientes en espera</p>
              <p className="text-3xl font-semibold text-amber-700">{dashboardMetrics.waiting}</p>
            </div>
            <Clock3 className="h-6 w-6 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-emerald-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="flex items-end justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Ocupacion %</p>
              <p className="text-3xl font-semibold text-emerald-700">{dashboardMetrics.occupancy}%</p>
            </div>
            <UsersRound className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-rose-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="flex items-end justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Cancelaciones</p>
              <p className="text-3xl font-semibold text-rose-700">{dashboardMetrics.cancelled}</p>
            </div>
            <UserX2 className="h-6 w-6 text-rose-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Profesionales</CardTitle>
            <Button variant="outline" size="sm" onClick={openDoctorCreate} title="Cargar medico manualmente">
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={selectedDoctorId === "all" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setSelectedDoctorId("all")}
            >
              Todos
            </Button>

            {doctors.map((doctor) => (
              <div key={doctor.user_id} className="flex gap-2">
                <Button
                  variant={selectedDoctorId === doctor.user_id ? "default" : "outline"}
                  className="min-w-0 flex-1 justify-start"
                  onClick={() => setSelectedDoctorId(doctor.user_id)}
                >
                  <UserRound className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{doctor.user.name}</span>
                </Button>
                <Button variant="outline" size="icon" title="Editar medico" onClick={() => openDoctorEdit(doctor)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
              Filtro activo: <span className="font-semibold">{selectedDoctorName}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Agenda semanal</CardTitle>
            <Badge variant="outline">Click en hueco para crear turno</Badge>
          </CardHeader>
          <CardContent>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              firstDay={1}
              selectable
              editable
              eventResizableFromStart
              selectMirror
              events={calendarEvents}
              eventContent={(info) => {
                const status = String(info.event.extendedProps.status ?? "scheduled");
                const time = info.timeText;
                const title = info.event.title;
                return (
                  <div className="w-full rounded-md px-1 py-0.5 text-[11px] leading-tight">
                    <p className="font-semibold">[{time}] {title}</p>
                    <p className="opacity-90">{statusLabelByValue[status] ?? status}</p>
                  </div>
                );
              }}
              select={onCalendarSelect}
              eventClick={onEventClick}
              eventDrop={onEventDrop}
              eventResize={onEventResize}
              datesSet={onCalendarDatesSet}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              height={760}
              locale="es"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Panel diario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-semibold">Fecha enfocada</p>
              <p>{focusDate.toLocaleDateString()}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Turnos del dia</p>
              {appointmentsOfDay.length === 0 ? (
                <p className="text-sm text-slate-500">Sin turnos para esta fecha.</p>
              ) : (
                appointmentsOfDay.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    title="Abrir detalle del turno"
                    className="w-full rounded-md border p-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => openAppointmentForEdit(appointment)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">[{new Date(appointment.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] {appointment.patient.name}</span>
                      <Badge style={{ backgroundColor: eventColorByStatus[appointment.status] ?? "#64748b", color: "#fff" }}>
                        {statusLabelByValue[appointment.status] ?? appointment.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">{doctors.find((doctor) => doctor.user_id === appointment.doctor_id)?.specialty ?? "Especialidad"}</p>
                    <p className="text-xs text-slate-500">Dr. {appointment.doctor.user.name}</p>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Alertas</p>
              {alerts.map((alert, index) => (
                <div key={`${alert}-${index}`} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                  <span>{alert}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Pacientes</p>
                <Button variant="outline" size="sm" onClick={openPatientCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo
                </Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {patients.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin pacientes cargados.</p>
                ) : (
                  patients.slice(0, 20).map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      className="w-full rounded-md border p-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
                      onClick={() => openPatientEdit(patient)}
                    >
                      <span className="font-medium">{patient.name}</span>
                      <p className="text-xs text-slate-600">DNI {patient.document || "-"} - Tel {patient.contact || "-"}</p>
                      <p className="text-xs text-slate-500">{patient.insurance ? `Obra social: ${patient.insurance}` : "Sin obra social registrada"}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4 text-sky-600" />
            Análisis asistido de imagen
          </CardTitle>
          <Badge variant="outline">Revisión médica obligatoria</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Informe preliminar generado por IA. Requiere validación de un profesional médico.
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3 rounded-md border p-3">
              <Input
                ref={analysisInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(event) => {
                  setAnalysisFile(event.target.files?.[0] ?? null);
                  setAnalysisResult(null);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => analysisInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Subir imagen
                </Button>
                <Button type="button" disabled={!analysisFile || analysisLoading} onClick={() => void analyzeSecretaryImage()}>
                  {analysisLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Analizar
                </Button>
              </div>
              {analysisFile ? (
                <div className="grid gap-2 text-sm text-slate-700">
                  <p className="truncate">Archivo: {analysisFile.name}</p>
                  {analysisPreviewUrl ? (
                    <Image
                      src={analysisPreviewUrl}
                      alt="Vista previa de imagen adjunta"
                      width={260}
                      height={170}
                      unoptimized
                      className="max-h-44 rounded-md border object-contain"
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Formatos admitidos: jpg, jpeg, png, webp y pdf.</p>
              )}
            </div>

            <div className="rounded-md border bg-slate-50 p-3">
              {analysisLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Analizando...
                </div>
              ) : !analysisResult ? (
                <p className="text-sm text-slate-500">El resultado estructurado aparecerá acá.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 text-sm md:grid-cols-3">
                    <div className="rounded-md border bg-white p-2">
                      <p className="text-xs text-slate-500">Tipo probable</p>
                      <p className="font-semibold text-slate-900">{analysisResult.imageType}</p>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <p className="text-xs text-slate-500">Calidad</p>
                      <p className="font-semibold text-slate-900">{analysisResult.quality.status}</p>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <p className="text-xs text-slate-500">Confianza</p>
                      <p className="font-semibold text-slate-900">{analysisResult.confidence}</p>
                    </div>
                  </div>

                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-white p-3 text-xs text-slate-800">
                    {formatMedicalImageAnalysisReport(analysisResult)}
                  </pre>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void copyAnalysisReport()}>
                      <Clipboard className="h-4 w-4" />
                      Copiar informe
                    </Button>
                    <Button type="button" variant="outline" disabled={!editForm.id} onClick={attachAnalysisToOpenAppointment}>
                      Adjuntar al turno abierto
                    </Button>
                    <Button type="button" variant="outline" disabled={!patientForm.id} onClick={attachAnalysisToOpenPatient}>
                      Adjuntar al paciente abierto
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Configuracion de Agenda</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSchedulePanelOpen((prev) => !prev)}
          >
            {schedulePanelOpen ? "Ocultar" : "Expandir"}
          </Button>
        </CardHeader>
        <CardContent
          className={`space-y-4 ${schedulePanelOpen ? "" : "hidden"}`}
          aria-hidden={!schedulePanelOpen}
        >
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
              Carga manual habilitada: la secretaria define medicos, profesion, fecha/dia de atencion, horario e intervalo. La IA usa estas reglas para proponer turnos.
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Carga manual</p>
              <div className="grid gap-2">
                <Input
                  id="manual-upload-input"
                  ref={manualUploadInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(event) => setManualFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => manualUploadInputRef.current?.click()}>
                  Subir planilla
                </Button>
                <Button type="button" disabled={processingManualFile} onClick={() => void processManualUpload()}>
                  {processingManualFile ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Procesar con IA
                </Button>
              </div>
              {manualFile ? <p className="text-xs text-slate-600">Archivo seleccionado: {manualFile.name}</p> : null}
              {parsedManualSheet ? (
                <div className="rounded-md border bg-slate-50 p-2">
                  <p className="mb-1 text-xs font-semibold text-slate-700">Salida estructurada OCR</p>
                  <pre className="max-h-44 overflow-auto text-[11px] text-slate-700">
                    {JSON.stringify(parsedManualSheet, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
              {!liveRulePreview.validWindow ? (
                <p>Rango horario invalido: horaInicio debe ser anterior a horaFin.</p>
              ) : !liveRulePreview.validDuration ? (
                <p>Intervalo invalido: usa al menos 10 minutos.</p>
              ) : (
                <p>
                  Vista en tiempo real: {liveRulePreview.doctorName} - {liveRulePreview.dayLabel} - {liveRulePreview.totalMinutes} min de jornada - {liveRulePreview.estimatedSlots} slots estimados.
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Configuracion de Agenda por Profesional</p>
              <div className="grid gap-2 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2">
                  <Label>Medico</Label>
                  <Select value={ruleForm.doctor_id} onValueChange={(value) => setRuleForm((prev) => ({ ...prev, doctor_id: value ?? "" }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Medico" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.user_id} value={doctor.user_id}>
                          {doctor.user.name} - {doctor.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Dia semanal</Label>
                  <Select value={ruleForm.day_of_week} onValueChange={(value) => setRuleForm((prev) => ({ ...prev, day_of_week: value ?? "1" }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((day, index) => (
                        <SelectItem key={day} value={String(index)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Fecha especifica (opcional)</Label>
                  <Input
                    type="date"
                    value={ruleForm.specific_date}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, specific_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Hora inicio</Label>
                  <Input
                    type="time"
                    value={ruleForm.start_time}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Hora fin</Label>
                  <Input
                    type="time"
                    value={ruleForm.end_time}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Duracion turno (min)</Label>
                  <Input
                    type="number"
                    value={ruleForm.slot_duration}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, slot_duration: event.target.value }))}
                    placeholder="Intervalo"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Buffer entre pacientes (min)</Label>
                  <Input type="number" value={bufferMinutes} onChange={(event) => setBufferMinutes(event.target.value)} />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label>Dias laborales</Label>
                  <Input value={workDays} onChange={(event) => setWorkDays(event.target.value)} placeholder="Ej: Lunes a Viernes" />
                </div>

                <div className="flex items-end">
                  <Button className="w-full" onClick={createRule}>
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medico</TableHead>
                <TableHead>Profesion</TableHead>
                <TableHead>Fecha especifica</TableHead>
                <TableHead>Dia laboral</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Intervalo entre pacientes</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{doctors.find((doctor) => doctor.user_id === rule.doctor_id)?.user.name ?? "-"}</TableCell>
                  <TableCell>{doctors.find((doctor) => doctor.user_id === rule.doctor_id)?.specialty ?? "-"}</TableCell>
                  <TableCell>{rule.specific_date ? new Date(rule.specific_date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{weekDays[rule.day_of_week]}</TableCell>
                  <TableCell>
                    {rule.start_time} - {rule.end_time}
                  </TableCell>
                  <TableCell>{rule.slot_duration} min</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openRuleEdit(rule)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteRule(rule.id)}>
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Panel de mensajes fallidos (Dead Letter Queue) */}
      <FailedMessagesPanel />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Crear turno</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Tipo de consulta</Label>
              <Select
                value={createForm.tipo_consulta}
                onValueChange={(value) => {
                  const tipoConsulta = value as AppointmentForm["tipo_consulta"];
                  const durationMap: Record<string, number> = { primera_vez: 45, control: 20, urgencia: 15 };
                  setCreateForm((prev) => ({
                    ...prev,
                    tipo_consulta: tipoConsulta,
                    duration: durationMap[tipoConsulta] ?? prev.duration,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primera_vez">Primera vez (45 min)</SelectItem>
                  <SelectItem value="control">Control (20 min)</SelectItem>
                  <SelectItem value="urgencia">Urgencia (15 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Paciente</Label>
                <Button variant="ghost" size="sm" onClick={openPatientCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo
                </Button>
              </div>
              <Select value={createForm.patient_id} onValueChange={(value) => setFormField("patient_id", value ?? "", "create")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name} - DNI {patient.document || "-"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Medico</Label>
              <Select value={createForm.doctor_id} onValueChange={(value) => setFormField("doctor_id", value ?? "", "create")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar medico" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.user_id} value={doctor.user_id}>
                      {doctor.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={createForm.datetime ? new Date(createForm.datetime).toISOString().slice(0, 16) : ""}
                onChange={(event) => setFormField("datetime", event.target.value ? new Date(event.target.value).toISOString() : "", "create")}
              />
            </div>

            <div className="space-y-1">
              <Label>Duracion (min)</Label>
              <Input
                type="number"
                min={10}
                value={createForm.duration}
                onChange={(event) => setFormField("duration", Number(event.target.value), "create")}
              />
            </div>

            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={createForm.status} onValueChange={(value) => setFormField("status", value ?? "scheduled", "create")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Origen</Label>
              <Select value={createForm.source} onValueChange={(value) => setFormField("source", value ?? "manual", "create")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Notas</Label>
              <Textarea value={createForm.notes} onChange={(event) => setFormField("notes", event.target.value, "create")} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={createAppointment}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle del turno</DialogTitle>
          </DialogHeader>

          {editForm.id ? (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p><span className="font-semibold">Paciente:</span> {patients.find((p) => p.id === editForm.patient_id)?.name ?? ""}</p>
              <p><span className="font-semibold">Documento:</span> {patients.find((p) => p.id === editForm.patient_id)?.document ?? ""}</p>
              <p><span className="font-semibold">Contacto:</span> {patients.find((p) => p.id === editForm.patient_id)?.contact ?? ""}</p>
              <p><span className="font-semibold">Obra social:</span> {patients.find((p) => p.id === editForm.patient_id)?.insurance ?? ""}</p>
              <p><span className="font-semibold">Motivo:</span> {editForm.notes || ""}</p>
              <p><span className="font-semibold">Doctor:</span> {doctors.find((d) => d.user_id === editForm.doctor_id)?.user.name ?? ""}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Paciente</Label>
              <Select value={editForm.patient_id} onValueChange={(value) => setFormField("patient_id", value ?? "", "edit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Medico</Label>
              <Select value={editForm.doctor_id} onValueChange={(value) => setFormField("doctor_id", value ?? "", "edit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.user_id} value={doctor.user_id}>
                      {doctor.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={editForm.datetime ? new Date(editForm.datetime).toISOString().slice(0, 16) : ""}
                onChange={(event) => setFormField("datetime", event.target.value ? new Date(event.target.value).toISOString() : "", "edit")}
              />
            </div>

            <div className="space-y-1">
              <Label>Duracion (min)</Label>
              <Input
                type="number"
                min={10}
                value={editForm.duration}
                onChange={(event) => setFormField("duration", Number(event.target.value), "edit")}
              />
            </div>

            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={editForm.status} onValueChange={(value) => setFormField("status", value ?? "scheduled", "edit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Origen</Label>
              <Select value={editForm.source} onValueChange={(value) => setFormField("source", value ?? "manual", "edit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Notas</Label>
              <Textarea value={editForm.notes} onChange={(event) => setFormField("notes", event.target.value, "edit")} />
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (!editForm.id) return;
                if (!window.confirm("Confirma eliminar este turno?")) return;
                void deleteAppointment(editForm.id);
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Eliminar
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setFormField("status", "confirmed", "edit");
                  setTimeout(() => {
                    void updateAppointment();
                  }, 0);
                }}
              >
                Confirmar
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setFormField("status", "cancelled", "edit");
                  setTimeout(() => {
                    void updateAppointment();
                  }, 0);
                }}
              >
                Cancelar
              </Button>
              <Button variant="outline" disabled={saving} title="Edita fecha y hora y luego pulsa reprogramar" onClick={() => void updateAppointment()}>
                Reprogramar
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={saving} onClick={updateAppointment}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={patientOpen} onOpenChange={setPatientOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{patientForm.id ? "Modificar paciente" : "Ingresar paciente"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Apellido y nombre</Label>
              <Input value={patientForm.name} onChange={(event) => setPatientForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>DNI</Label>
                <Input value={patientForm.document} onChange={(event) => setPatientForm((prev) => ({ ...prev, document: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input value={patientForm.contact} onChange={(event) => setPatientForm((prev) => ({ ...prev, contact: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Obra social</Label>
              <Input
                value={patientForm.insurance}
                onChange={(event) => setPatientForm((prev) => ({ ...prev, insurance: event.target.value }))}
                placeholder="Dejar vacio si no tiene"
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={patientForm.notes} onChange={(event) => setPatientForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPatientOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={savePatient}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={doctorOpen} onOpenChange={setDoctorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{doctorForm.id ? "Modificar medico" : "Cargar medico"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={doctorForm.name} onChange={(event) => setDoctorForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={doctorForm.email}
                disabled={Boolean(doctorForm.id)}
                onChange={(event) => setDoctorForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            {!doctorForm.id ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Clave inicial</Label>
                <Input
                  type="password"
                  value={doctorForm.password}
                  onChange={(event) => setDoctorForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>Especialidad</Label>
              <Input value={doctorForm.specialty} onChange={(event) => setDoctorForm((prev) => ({ ...prev, specialty: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Matricula</Label>
              <Input value={doctorForm.matricula} onChange={(event) => setDoctorForm((prev) => ({ ...prev, matricula: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Etiqueta IA</Label>
              <Input value={doctorForm.ai_tag} onChange={(event) => setDoctorForm((prev) => ({ ...prev, ai_tag: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Duracion turno (min)</Label>
              <Input
                type="number"
                min={10}
                value={doctorForm.appointment_duration}
                onChange={(event) => setDoctorForm((prev) => ({ ...prev, appointment_duration: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Inicio agenda</Label>
              <Input type="time" value={doctorForm.start_time} onChange={(event) => setDoctorForm((prev) => ({ ...prev, start_time: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fin agenda</Label>
              <Input type="time" value={doctorForm.end_time} onChange={(event) => setDoctorForm((prev) => ({ ...prev, end_time: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Buffer entre pacientes (min)</Label>
              <Input
                type="number"
                min={0}
                value={doctorForm.buffer_minutes}
                onChange={(event) => setDoctorForm((prev) => ({ ...prev, buffer_minutes: event.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Dias laborales</Label>
              <Input value={doctorForm.working_days} onChange={(event) => setDoctorForm((prev) => ({ ...prev, working_days: event.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDoctorOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={saveDoctor}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleEditOpen} onOpenChange={setRuleEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar AvailabilityRule</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <Select
              value={ruleEditForm.doctor_id}
              onValueChange={(value) => setRuleEditForm((prev) => ({ ...prev, doctor_id: value ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Medico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.user_id} value={doctor.user_id}>
                    {doctor.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={ruleEditForm.day_of_week}
              onValueChange={(value) => setRuleEditForm((prev) => ({ ...prev, day_of_week: value ?? "1" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Dia" />
              </SelectTrigger>
              <SelectContent>
                {weekDays.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-1">
              <Label>Fecha especifica (opcional)</Label>
              <Input
                type="date"
                value={ruleEditForm.specific_date}
                onChange={(event) => setRuleEditForm((prev) => ({ ...prev, specific_date: event.target.value }))}
              />
            </div>

            <Input type="time" value={ruleEditForm.start_time} onChange={(event) => setRuleEditForm((prev) => ({ ...prev, start_time: event.target.value }))} />
            <Input type="time" value={ruleEditForm.end_time} onChange={(event) => setRuleEditForm((prev) => ({ ...prev, end_time: event.target.value }))} />
            <Input
              type="number"
              value={ruleEditForm.slot_duration}
              onChange={(event) => setRuleEditForm((prev) => ({ ...prev, slot_duration: event.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRuleEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateRule}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
