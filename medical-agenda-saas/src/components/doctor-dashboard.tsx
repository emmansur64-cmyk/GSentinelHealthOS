"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CalendarClock, Clipboard, ImagePlus, LoaderCircle, Menu, MessageSquare, MessageSquarePlus, RefreshCcw, Send, Sparkles, Stethoscope, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { DOCTOR_CHAT_PARAMS } from "@/chat/doctor-chat-params";
import { formatMedicalImageAnalysisReport, type AiImageAnalysisResult } from "@/lib/ai-image-analysis-format";
import { fetchJsonWithRetry } from "@/lib/http-client";

type Appointment = {
  id: string;
  doctor_id: string;
  datetime: string;
  duration: number;
  status: string;
  source: string;
  notes?: string | null;
  patient: { id: string; name: string; phone: string; notes?: string | null };
};

type PatientHistoryRow = {
  id: string;
  datetime: string;
  status: string;
  notes: string | null;
  doctor_name: string;
};

type TodayResponse = {
  date: string;
  doctor_id: string;
  appointments: Appointment[];
  patient_context: {
    patient: { id: string; name: string; phone: string; notes: string | null };
    history: PatientHistoryRow[];
  } | null;
};

type ChatMessage = {
  id: string;
  role: "doctor" | "metabrain";
  content: string;
  created_at: string;
  confidence?: number;
  source?: string;
};

type ChatHistoryResponse = {
  conversation_id: string;
  messages: ChatMessage[];
};

type ChatSession = {
  session_id: string;
  conversation_id: string;
  title: string;
  patient_id: string | null;
  appointment_id: string | null;
  message_count: number;
  updated_at: string;
};

type ChatSessionsResponse = {
  sessions: ChatSession[];
};

type DoctorChatResponse = {
  response: string;
  confidence: number;
  source: string;
};

const CHAT_NONE_VALUE = "__none__";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJsonWithRetry<T>(url, init, {
    retries: 2,
    retryDelayMs: 350,
    timeoutMs: 12_000,
  });
}

async function fetchChatJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJsonWithRetry<T>(url, init, {
    retries: 0,
    timeoutMs: 30_000,
  });
}

export function DoctorDashboard({ doctorId }: { doctorId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [history, setHistory] = useState<PatientHistoryRow[]>([]);
  const [patientNotes, setPatientNotes] = useState<string>("");
  const [evolution, setEvolution] = useState("");
  const [reprogramDateTime, setReprogramDateTime] = useState("");
  const [reprogramDuration, setReprogramDuration] = useState("30");
  const [followupDays, setFollowupDays] = useState("30");
  const [followupSource, setFollowupSource] = useState("manual");
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPatientId, setChatPatientId] = useState<string | null>(null);
  const [chatAppointmentId, setChatAppointmentId] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState(() => crypto.randomUUID());
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatImageFile, setChatImageFile] = useState<File | null>(null);
  const [chatImageLoading, setChatImageLoading] = useState(false);
  const [chatImagePreviewUrl, setChatImagePreviewUrl] = useState<string | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatRequestRef = useRef<{ requestId: string; controller: AbortController } | null>(null);
  const chatHistoryRequestRef = useRef<AbortController | null>(null);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId],
  );

  const chatPatientOptions = useMemo(() => {
    const seen = new Set<string>();
    return appointments
      .filter((apt) => {
        if (seen.has(apt.patient.id)) return false;
        seen.add(apt.patient.id);
        return true;
      })
      .map((apt) => ({ id: apt.patient.id, name: apt.patient.name }));
  }, [appointments]);

  const loadToday = useCallback(async () => {
    try {
      const data = await fetchJson<TodayResponse>("/api/appointments/today");
      const filtered = data.appointments.filter((item) => item.doctor_id === doctorId);
      setAppointments(filtered);

      setSelectedAppointmentId((prev) => {
        if (prev && filtered.some((item) => item.id === prev)) return prev;
        return filtered[0]?.id ?? null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar turnos");
    }
  }, [doctorId]);

  const loadPatientContext = useCallback(async () => {
    if (!selectedAppointment) {
      setHistory([]);
      setPatientNotes("");
      return;
    }

    try {
      const data = await fetchJson<TodayResponse>(`/api/appointments/today?patient_id=${selectedAppointment.patient.id}`);
      setHistory(data.patient_context?.history ?? []);
      setPatientNotes(data.patient_context?.patient.notes ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar historial del paciente");
    }
  }, [selectedAppointment]);

  const loadChatHistory = useCallback(async () => {
    chatHistoryRequestRef.current?.abort();
    const controller = new AbortController();
    chatHistoryRequestRef.current = controller;
    setChatHistoryLoading(true);
    try {
      const params = new URLSearchParams({ doctor_id: doctorId, session_id: chatSessionId });
      if (chatPatientId) params.set("patient_id", chatPatientId);
      if (chatAppointmentId) params.set("appointment_id", chatAppointmentId);
      const data = await fetchJson<ChatHistoryResponse>(`${DOCTOR_CHAT_PARAMS.route}?${params.toString()}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setChatMessages(data.messages);
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial del chat clinico");
    } finally {
      if (chatHistoryRequestRef.current === controller) {
        chatHistoryRequestRef.current = null;
        setChatHistoryLoading(false);
      }
    }
  }, [doctorId, chatAppointmentId, chatPatientId, chatSessionId]);

  const loadChatSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ doctor_id: doctorId, mode: "sessions" });
      const data = await fetchJson<ChatSessionsResponse>(`${DOCTOR_CHAT_PARAMS.route}?${params.toString()}`);
      setChatSessions(data.sessions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los chats guardados");
    }
  }, [doctorId]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await loadToday();
      setLoading(false);
    };
    void bootstrap();
  }, [loadToday]);

  useEffect(() => {
    void loadPatientContext();
    if (selectedAppointment) {
      setReprogramDateTime(new Date(selectedAppointment.datetime).toISOString().slice(0, 16));
      setReprogramDuration(String(selectedAppointment.duration));
      setEvolution("");
    }
  }, [loadPatientContext, selectedAppointment]);

  useEffect(() => {
    if (chatOpen) {
      void loadChatHistory();
      return;
    }
    chatHistoryRequestRef.current?.abort();
    chatHistoryRequestRef.current = null;
    setChatHistoryLoading(false);
  }, [chatOpen, loadChatHistory]);

  useEffect(() => {
    if (chatOpen) void loadChatSessions();
  }, [chatOpen, loadChatSessions]);

  useEffect(() => {
    if (!chatImageFile || !chatImageFile.type.startsWith("image/")) {
      setChatImagePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(chatImageFile);
    setChatImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [chatImageFile]);

  useEffect(() => {
    return () => {
      chatRequestRef.current?.controller.abort();
      chatRequestRef.current = null;
      chatHistoryRequestRef.current?.abort();
      chatHistoryRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wsBase = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    const wsUrl = wsBase?.trim()
      ? `${wsBase.replace(/\/$/, "")}/ws/notifications`
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/notifications`;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string; payload?: { doctor_id?: string } };
          const eventType = String(payload?.type ?? "");
          const targetDoctorId = payload?.payload?.doctor_id;

          if (eventType === "message") {
            if (chatOpen) void loadChatHistory();
            return;
          }

          if ((eventType === "new_appointment" || eventType === "cancel") && (!targetDoctorId || targetDoctorId === doctorId)) {
            void loadToday();
            return;
          }
        } catch {
          // Ignorar mensajes no parseables
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [chatOpen, doctorId, loadChatHistory, loadToday]);

  const optimisticReplace = (id: string, patch: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateClinicalStatus = async (status: string) => {
    if (!selectedAppointment) return;

    const previous = { ...selectedAppointment };
    optimisticReplace(selectedAppointment.id, {
      status,
      notes: evolution.trim() ? `${selectedAppointment.notes ?? ""}\n\n${evolution.trim()}`.trim() : selectedAppointment.notes,
    });

    setSaving(true);
    try {
      await fetchJson("/api/appointments/update-status", {
        method: "POST",
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          status,
          evolution: evolution.trim() || undefined,
        }),
      });
      toast.success("Registro clinico actualizado");
      setEvolution("");
      await loadToday();
      await loadPatientContext();
    } catch (error) {
      optimisticReplace(selectedAppointment.id, previous);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar estado");
    } finally {
      setSaving(false);
    }
  };

  const reprogramAppointment = async () => {
    if (!selectedAppointment || !reprogramDateTime) return;

    const previous = { ...selectedAppointment };
    const nextDate = new Date(reprogramDateTime).toISOString();
    const nextDuration = Number(reprogramDuration);
    optimisticReplace(selectedAppointment.id, { datetime: nextDate, duration: nextDuration });

    setSaving(true);
    try {
      await fetchJson("/api/appointments/update-status", {
        method: "POST",
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          datetime: nextDate,
          duration: nextDuration,
          evolution: evolution.trim() || undefined,
        }),
      });
      toast.success("Turno reprogramado");
      setEvolution("");
      await loadToday();
      await loadPatientContext();
    } catch (error) {
      optimisticReplace(selectedAppointment.id, previous);
      toast.error(error instanceof Error ? error.message : "No se pudo reprogramar");
    } finally {
      setSaving(false);
    }
  };

  const createFollowup = async () => {
    if (!selectedAppointment) return;

    setSaving(true);
    try {
      await fetchJson("/api/appointments/create-followup", {
        method: "POST",
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          days: Number(followupDays),
          source: followupSource,
          notes: evolution.trim() || undefined,
        }),
      });
      toast.success(`Seguimiento creado a ${followupDays} dias`);
      await loadToday();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear seguimiento");
    } finally {
      setSaving(false);
    }
  };

  const startNewChat = async () => {
    chatRequestRef.current?.controller.abort();
    chatRequestRef.current = null;
    chatHistoryRequestRef.current?.abort();
    chatHistoryRequestRef.current = null;
    setChatLoading(false);
    setChatHistoryLoading(false);
    setChatSessionId(crypto.randomUUID());
    setChatMessages([]);
    setChatInput("");
    setChatPatientId(null);
    setChatAppointmentId(null);
    setChatMenuOpen(false);
    toast.success("Nuevo chat iniciado");
  };

  const closeDoctorChat = () => {
    chatRequestRef.current?.controller.abort();
    chatRequestRef.current = null;
    chatHistoryRequestRef.current?.abort();
    chatHistoryRequestRef.current = null;
    setChatLoading(false);
    setChatHistoryLoading(false);
    setChatOpen(false);
  };

  const openSavedChat = (session: ChatSession) => {
    setChatSessionId(session.session_id);
    setChatPatientId(session.patient_id);
    setChatAppointmentId(session.appointment_id);
    setChatMenuOpen(false);
  };

  const deleteSavedChat = async (session: ChatSession) => {
    try {
      const params = new URLSearchParams({
        doctor_id: doctorId,
        session_id: session.session_id,
      });
      if (session.patient_id) params.set("patient_id", session.patient_id);
      if (session.appointment_id) params.set("appointment_id", session.appointment_id);
      await fetchJson(`${DOCTOR_CHAT_PARAMS.route}?${params.toString()}`, { method: "DELETE" });

      setChatSessions((prev) => prev.filter((item) => item.conversation_id !== session.conversation_id));
      if (session.session_id === chatSessionId) {
        chatHistoryRequestRef.current?.abort();
        chatHistoryRequestRef.current = null;
        setChatHistoryLoading(false);
        setChatSessionId(crypto.randomUUID());
        setChatMessages([]);
        setChatInput("");
        setChatPatientId(null);
        setChatAppointmentId(null);
        setChatMenuOpen(false);
      }
      toast.success("Chat eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el chat");
    }
  };

  const sendDoctorChat = async () => {
    if (!chatInput.trim() || chatRequestRef.current) return;

    const outgoingText = chatInput.trim();
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    chatRequestRef.current = { requestId, controller };
    const doctorMessage: ChatMessage = {
      id: `doctor-${requestId}`,
      role: "doctor",
      content: outgoingText,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, doctorMessage]);
    setChatInput("");
    setChatLoading(true);

    const appointmentForPatient =
      chatPatientId && selectedAppointment?.patient.id === chatPatientId ? selectedAppointment : null;
    const resolvedAppointmentId = chatAppointmentId ?? appointmentForPatient?.id;

    try {
      const result = await fetchChatJson<DoctorChatResponse>(DOCTOR_CHAT_PARAMS.route, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          doctor_id: doctorId,
          message: outgoingText,
          context: chatPatientId
            ? {
                patient_id: chatPatientId,
                appointment_id: resolvedAppointmentId,
                patient_notes: patientNotes || undefined,
                clinical_state: evolution.trim() || appointmentForPatient?.notes || undefined,
                recent_history: history.map((row) => ({
                  id: row.id,
                  datetime: row.datetime,
                  status: row.status,
                  notes: row.notes,
                  doctor_name: row.doctor_name,
                })),
                metadata: {
                  chat_request_id: requestId,
                  ...(appointmentForPatient
                    ? {
                        appointment_status: appointmentForPatient.status,
                        appointment_datetime: appointmentForPatient.datetime,
                      }
                    : {}),
                  [DOCTOR_CHAT_PARAMS.sessionMetadataKey]: chatSessionId,
                },
              }
            : {
                metadata: {
                  chat_request_id: requestId,
                  [DOCTOR_CHAT_PARAMS.sessionMetadataKey]: chatSessionId,
                },
              },
        }),
      });

      if (chatRequestRef.current?.requestId !== requestId || controller.signal.aborted) return;

      setChatMessages((prev) => [
        ...prev,
        {
          id: `metabrain-${requestId}`,
          role: "metabrain",
          content: result.response,
          created_at: new Date().toISOString(),
          confidence: result.confidence,
          source: result.source,
        },
      ]);
      void loadChatSessions();
    } catch (error) {
      if (controller.signal.aborted) return;
      setChatMessages((prev) => prev.filter((message) => message.id !== doctorMessage.id));
      setChatInput(outgoingText);
      toast.error(error instanceof Error ? error.message : "No se pudo obtener respuesta de MetaBrain");
    } finally {
      if (chatRequestRef.current?.requestId === requestId) {
        chatRequestRef.current = null;
        setChatLoading(false);
      }
    }
  };

  const analyzeChatImage = async () => {
    if (!chatImageFile) {
      toast.error("Seleccioná una imagen o PDF para analizar");
      return;
    }

    setChatImageLoading(true);
    const uploadedFile = chatImageFile;
    try {
      const formData = new FormData();
      formData.set("file", uploadedFile);
      formData.set("source", "doctor_chat");
      if (chatPatientId) formData.set("optionalContext", `Paciente seleccionado en chat: ${chatPatientId}`);

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

      const report = formatMedicalImageAnalysisReport(payload.data);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `doctor-image-${Date.now()}`,
          role: "doctor",
          content: `Adjunté imagen para análisis asistido: ${uploadedFile.name}`,
          created_at: new Date().toISOString(),
        },
        {
          id: `metabrain-image-${Date.now()}`,
          role: "metabrain",
          content: report,
          created_at: new Date().toISOString(),
          source: "GROQ_IMAGE_ANALYSIS",
        },
      ]);
      setChatImageFile(null);
      if (chatImageInputRef.current) chatImageInputRef.current.value = "";
      toast.success("Análisis asistido generado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen. Verificá el formato o intentá nuevamente.");
    } finally {
      setChatImageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-700" suppressHydrationWarning>
        <LoaderCircle className="h-5 w-5 animate-spin" />
        Cargando agenda del doctor...
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Panel Doctor</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Atencion y seguimiento clinico</h1>
              <p className="mt-1 text-sm text-slate-600">Agenda del dia, evolucion del paciente y soporte clinico desde el chat IA.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Turnos</p>
              <p className="font-semibold text-slate-950">{appointments.length}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Seleccionado</p>
              <p className="truncate font-semibold text-slate-950">{selectedAppointment?.patient.name ?? "Ninguno"}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Historial</p>
              <p className="font-semibold text-slate-950">{history.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Agenda de hoy
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => void loadToday()}>
            <RefreshCcw className="mr-1 h-4 w-4" />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-500">No hay turnos para hoy.</p>
          ) : (
            appointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                className={`w-full rounded-md border p-3 text-left transition ${selectedAppointmentId === appointment.id ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                onClick={() => setSelectedAppointmentId(appointment.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{appointment.patient.name}</p>
                  <StatusBadge status={appointment.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{new Date(appointment.datetime).toLocaleTimeString()}</p>
                <p className="text-xs text-slate-500">Duracion: {appointment.duration} min | Origen: {appointment.source}</p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4" />
            Vista clinica del paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedAppointment ? (
            <p className="text-sm text-slate-500">Selecciona un turno para abrir el panel clinico.</p>
          ) : (
            <>
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{selectedAppointment.patient.name}</p>
                  <StatusBadge status={selectedAppointment.status} />
                </div>
                <p className="text-sm text-slate-600">Telefono: {selectedAppointment.patient.phone}</p>
                <p className="text-sm text-slate-600">Turno: {new Date(selectedAppointment.datetime).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Notas previas del paciente: {patientNotes || "Sin notas"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution">Registro clinico (evolucion)</Label>
                <Textarea
                  id="evolution"
                  rows={4}
                  value={evolution}
                  onChange={(event) => setEvolution(event.target.value)}
                  placeholder="Escribe evolucion, hallazgos y conducta..."
                />
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <Button disabled={saving} onClick={() => void updateClinicalStatus("completed")}>
                  Marcar como atendido
                </Button>
                <Button disabled={saving} variant="outline" onClick={() => void updateClinicalStatus("no_show")}>
                  Marcar ausente
                </Button>
                <Button disabled={saving} variant="outline" onClick={() => void updateClinicalStatus("confirmed")}>
                  Marcar confirmado
                </Button>
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Reprogramar</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input type="datetime-local" value={reprogramDateTime} onChange={(event) => setReprogramDateTime(event.target.value)} />
                  <Input type="number" min={10} value={reprogramDuration} onChange={(event) => setReprogramDuration(event.target.value)} />
                </div>
                <Button className="mt-2" disabled={saving} onClick={() => void reprogramAppointment()}>
                  Reprogramar turno
                </Button>
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Crear seguimiento</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <Input type="number" min={1} value={followupDays} onChange={(event) => setFollowupDays(event.target.value)} placeholder="Dias" />
                  <Select value={followupSource} onValueChange={(value) => setFollowupSource(value ?? "manual")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">manual</SelectItem>
                      <SelectItem value="whatsapp">whatsapp</SelectItem>
                      <SelectItem value="web">web</SelectItem>
                      <SelectItem value="phone">phone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button disabled={saving} onClick={() => void createFollowup()}>
                    Control en X dias
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Historial del paciente (real DB)</p>
                <div className="max-h-48 space-y-2 overflow-auto pr-1">
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin historial registrado.</p>
                  ) : (
                    history.map((row) => (
                      <div key={row.id} className="rounded-md border bg-white p-2 text-xs">
                        <p className="font-semibold">{new Date(row.datetime).toLocaleString()} | {row.status}</p>
                        <p className="text-slate-600">Medico: {row.doctor_name}</p>
                        <p className="text-slate-600">Notas: {row.notes || "Sin notas"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </>
          )}
        </CardContent>
      </Card>
      </div>

      {chatOpen ? (
        <div className="fixed bottom-5 right-5 z-40 w-[min(calc(100vw-2.5rem),460px)] rounded-lg border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-900">Chat IA</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={closeDoctorChat} aria-label="Cerrar chat IA">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" onClick={() => setChatMenuOpen((prev) => !prev)} aria-label="Chats guardados">
                <Menu className="h-4 w-4" />
              </Button>
              <Select
                value={chatPatientId ?? CHAT_NONE_VALUE}
                onValueChange={(value) => {
                  setChatPatientId(value === CHAT_NONE_VALUE ? null : value);
                  setChatAppointmentId(null);
                }}
              >
                <SelectTrigger className="h-9 min-w-0 flex-1">
                  <SelectValue placeholder="Paciente opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CHAT_NONE_VALUE}>Sin paciente seleccionado</SelectItem>
                  {chatPatientOptions.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon-sm" disabled={chatLoading} onClick={() => void startNewChat()} aria-label="Nuevo chat">
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </div>

            {chatMenuOpen ? (
              <div className="max-h-52 space-y-2 overflow-auto rounded-md border bg-white p-2">
                {chatSessions.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-500">Todavia no hay chats guardados.</p>
                ) : (
                  chatSessions.map((session) => (
                    <div key={session.conversation_id} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openSavedChat(session)}
                      >
                        <p className="truncate text-sm font-medium text-slate-900">{session.title}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(session.updated_at).toLocaleDateString()} · {session.message_count} intercambio{session.message_count === 1 ? "" : "s"}
                        </p>
                      </button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void deleteSavedChat(session)} aria-label="Eliminar chat">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <div className="h-80 space-y-2 overflow-auto rounded-md border bg-slate-50 p-3">
              {chatHistoryLoading && chatMessages.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Cargando historial clinico...
                </div>
              ) : chatMessages.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {chatPatientId ? "Inicia la consulta clinica para este paciente." : "Selecciona un paciente o escribe una consulta libre para comenzar."}
                </p>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-md px-3 py-2 text-sm ${message.role === "doctor" ? "ml-auto max-w-[85%] bg-slate-900 text-white" : "max-w-[90%] border bg-white text-slate-800"}`}
                  >
                    {message.content.startsWith("Análisis asistido de imagen") ? (
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-700">Análisis asistido de imagen</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Copiar informe"
                          onClick={() => {
                            void navigator.clipboard.writeText(message.content);
                            toast.success("Informe copiado");
                          }}
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-md border bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  ref={chatImageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(event) => setChatImageFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => chatImageInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Adjuntar imagen
                </Button>
                <Button type="button" size="sm" disabled={!chatImageFile || chatImageLoading} onClick={() => void analyzeChatImage()}>
                  {chatImageLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analizar imagen
                </Button>
              </div>
              {chatImageFile ? (
                <div className="mt-2 grid gap-2 text-xs text-slate-600">
                  <span className="truncate">Archivo: {chatImageFile.name}</span>
                  {chatImagePreviewUrl ? (
                    <Image
                      src={chatImagePreviewUrl}
                      alt="Vista previa de imagen adjunta"
                      width={180}
                      height={112}
                      unoptimized
                      className="max-h-28 rounded-md border object-contain"
                    />
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-amber-700">Informe preliminar generado por IA. Requiere validación de un profesional médico.</p>
            </div>

            <div className="flex gap-2">
              <Input
                id="doctor-chat-input"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Consulta libre"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendDoctorChat();
                  }
                }}
              />
              <Button disabled={chatLoading || !chatInput.trim()} onClick={() => void sendDoctorChat()} aria-label="Enviar consulta">
                {chatLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          className="fixed bottom-5 right-5 z-40 h-12 rounded-full px-4 shadow-xl"
          onClick={() => setChatOpen(true)}
        >
          <MessageSquare className="h-4 w-4" />
          Chat IA
        </Button>
      )}
    </div>
  );
}
