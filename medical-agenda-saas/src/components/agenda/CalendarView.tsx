"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppointmentModal } from "@/components/agenda/AppointmentModal";
import { DoctorFilter } from "@/components/agenda/DoctorFilter";
import type { Appointment, AppointmentMutationPayload, CalendarEvent, Doctor, Patient, ScheduleRule } from "@/components/agenda/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJsonWithRetry } from "@/lib/http-client";

const eventColorByStatus: Record<Appointment["status"], string> = {
  scheduled: "#f59e0b",
  confirmed: "#10b981",
  cancelled: "#ef4444",
  completed: "#16a34a",
  no_show: "#f97316",
};

type CalendarRange = {
  start: Date;
  end: Date;
};

type BusinessHour = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
};

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatAsIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hasOverlap(candidateStart: Date, candidateEnd: Date, doctorId: string, appointments: Appointment[], excludeId?: string): boolean {
  return appointments.some((item) => {
    if (item.doctor_id !== doctorId) return false;
    if (item.id === excludeId) return false;
    if (item.status === "cancelled" || item.status === "no_show") return false;

    const start = new Date(item.datetime);
    const end = new Date(start.getTime() + item.duration * 60_000);
    return candidateStart < end && start < candidateEnd;
  });
}

function isWithinAvailability(start: Date, end: Date, doctorId: string, rules: ScheduleRule[]): boolean {
  const doctorRules = rules.filter((rule) => rule.doctor_id === doctorId);
  if (doctorRules.length === 0) return true;

  const day = start.getDay();
  const isoDay = formatAsIsoDate(start);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  return doctorRules.some((rule) => {
    if (rule.specific_date) {
      const specificDate = formatAsIsoDate(new Date(rule.specific_date));
      if (specificDate !== isoDay) return false;
    } else if (rule.day_of_week !== day) {
      return false;
    }

    const ruleStart = toMinutes(rule.start_time);
    const ruleEnd = toMinutes(rule.end_time);
    return startMinutes >= ruleStart && endMinutes <= ruleEnd;
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJsonWithRetry<T>(url, init, { retries: 2, retryDelayMs: 300, timeoutMs: 12_000 });
}

export function CalendarView() {
  const queryClient = useQueryClient();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [calendarRange, setCalendarRange] = useState<CalendarRange>(() => {
    const start = new Date();
    return {
      start,
      end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [draftDateTime, setDraftDateTime] = useState<string>(new Date().toISOString());
  const [draftDuration, setDraftDuration] = useState<number>(30);

  const doctorsQuery = useQuery({
    queryKey: ["agenda", "doctors"],
    queryFn: () => fetchJson<Doctor[]>("/api/doctors"),
  });

  const patientsQuery = useQuery({
    queryKey: ["agenda", "patients"],
    queryFn: () => fetchJson<Patient[]>("/api/patients"),
  });

  const schedulesQuery = useQuery({
    queryKey: ["agenda", "schedules"],
    queryFn: () => fetchJson<ScheduleRule[]>("/api/schedules"),
  });

  const appointmentsQuery = useQuery({
    queryKey: ["agenda", "appointments", selectedDoctorId, calendarRange.start.toISOString(), calendarRange.end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("start", calendarRange.start.toISOString());
      params.set("end", calendarRange.end.toISOString());
      if (selectedDoctorId !== "all") params.set("doctor_id", selectedDoctorId);
      return fetchJson<Appointment[]>(`/api/appointments?${params.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: AppointmentMutationPayload) =>
      fetchJson<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      toast.success("Turno creado");
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["agenda", "appointments"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el turno");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AppointmentMutationPayload> }) =>
      fetchJson<Appointment>(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda", "appointments"] });
    },
  });

  const doctors = doctorsQuery.data ?? [];
  const patients = patientsQuery.data ?? [];
  const rules = schedulesQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return appointments.map((appointment) => {
      const start = new Date(appointment.datetime);
      const end = new Date(start.getTime() + appointment.duration * 60_000);
      const color = eventColorByStatus[appointment.status] ?? "#64748b";

      return {
        id: appointment.id,
        title: appointment.patient.name,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        extendedProps: {
          appointmentId: appointment.id,
          doctorId: appointment.doctor_id,
          patientId: appointment.patient_id,
          doctorName: appointment.doctor.user.name,
          patientName: appointment.patient.name,
          status: appointment.status,
          duration: appointment.duration,
        },
      };
    });
  }, [appointments]);

  const businessHours = useMemo<BusinessHour[] | undefined>(() => {
    if (selectedDoctorId === "all") return undefined;

    const weeklyRules = rules.filter((rule) => rule.doctor_id === selectedDoctorId && !rule.specific_date);
    if (weeklyRules.length === 0) return undefined;

    return weeklyRules.map((rule) => ({
      daysOfWeek: [rule.day_of_week],
      startTime: rule.start_time,
      endTime: rule.end_time,
    }));
  }, [rules, selectedDoctorId]);

  const canPlaceInSchedule = (start: Date, end: Date, doctorId: string, excludeId?: string): boolean => {
    const withinAvailability = isWithinAvailability(start, end, doctorId, rules);
    if (!withinAvailability) return false;

    return !hasOverlap(start, end, doctorId, appointments, excludeId);
  };

  const handleDateSelect = (selection: DateSelectArg) => {
    const start = selection.start;
    const end = selection.end;
    const duration = Math.max(10, Math.round((end.getTime() - start.getTime()) / 60_000));

    const candidateDoctors =
      selectedDoctorId === "all" ? doctors.map((doctor) => doctor.user_id) : [selectedDoctorId];

    const allowedDoctor = candidateDoctors.find((doctorId) => canPlaceInSchedule(start, end, doctorId));
    if (!allowedDoctor) {
      toast.error("Horario bloqueado: fuera de disponibilidad o solapado");
      return;
    }

    setDraftDateTime(start.toISOString());
    setDraftDuration(duration);
    setModalMode("create");
    setActiveAppointment(null);
    setModalOpen(true);
  };

  const handleEventClick = (click: EventClickArg) => {
    const appointment = appointments.find((item) => item.id === click.event.id);
    if (!appointment) return;

    setModalMode("edit");
    setActiveAppointment(appointment);
    setModalOpen(true);
  };

  const handleDateRangeChange = (args: DatesSetArg) => {
    setCalendarRange({ start: args.start, end: args.end });
  };

  const handleEventDrop = async (eventDrop: EventDropArg) => {
    const appointment = appointments.find((item) => item.id === eventDrop.event.id);
    const nextStart = eventDrop.event.start;
    const nextEnd = eventDrop.event.end;
    if (!appointment || !nextStart || !nextEnd) return;

    const nextDuration = Math.max(10, Math.round((nextEnd.getTime() - nextStart.getTime()) / 60_000));

    if (!canPlaceInSchedule(nextStart, nextEnd, appointment.doctor_id, appointment.id)) {
      eventDrop.revert();
      toast.error("No se puede mover: horario fuera de disponibilidad o ya ocupado");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: appointment.id,
        payload: { datetime: nextStart.toISOString(), duration: nextDuration },
      });
      toast.success("Turno actualizado");
    } catch (error) {
      eventDrop.revert();
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el turno");
    }
  };

  const handleEventResize = async (eventResize: EventResizeDoneArg) => {
    const appointment = appointments.find((item) => item.id === eventResize.event.id);
    const nextStart = eventResize.event.start;
    const nextEnd = eventResize.event.end;
    if (!appointment || !nextStart || !nextEnd) return;

    const nextDuration = Math.max(10, Math.round((nextEnd.getTime() - nextStart.getTime()) / 60_000));

    if (!canPlaceInSchedule(nextStart, nextEnd, appointment.doctor_id, appointment.id)) {
      eventResize.revert();
      toast.error("No se puede redimensionar: bloqueado por disponibilidad u ocupacion");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: appointment.id,
        payload: { duration: nextDuration },
      });
      toast.success("Duracion actualizada");
    } catch (error) {
      eventResize.revert();
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la duracion");
    }
  };

  const handleModalSubmit = async (payload: AppointmentMutationPayload) => {
    if (modalMode === "create") {
      await createMutation.mutateAsync(payload);
      return;
    }

    if (!activeAppointment) return;
    await updateMutation.mutateAsync({ id: activeAppointment.id, payload });
    toast.success("Turno actualizado");
    setModalOpen(false);
  };

  const openNewAppointmentModal = () => {
    setModalMode("create");
    setActiveAppointment(null);
    setDraftDateTime(new Date().toISOString());
    setDraftDuration(30);
    setModalOpen(true);
  };

  const isLoading = doctorsQuery.isLoading || patientsQuery.isLoading || schedulesQuery.isLoading;

  return (
    <Card className="border-slate-200/70 bg-white">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Agenda medica profesional</CardTitle>
          <p className="text-sm text-slate-500">Vista diaria y semanal con persistencia real y bloqueos de disponibilidad.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DoctorFilter
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            loading={doctorsQuery.isLoading}
            onChange={setSelectedDoctorId}
          />
          <Button onClick={openNewAppointmentModal} disabled={doctors.length === 0 || patients.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo turno
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-slate-500">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Cargando agenda...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridDay,timeGridWeek,dayGridMonth",
              }}
              locale="es"
              selectable
              editable
              eventResizableFromStart
              events={calendarEvents as EventInput[]}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={(arg) => void handleEventDrop(arg)}
              eventResize={(arg) => void handleEventResize(arg)}
              datesSet={handleDateRangeChange}
              selectAllow={(selection) => {
                const start = selection.start;
                const end = selection.end;
                const candidates =
                  selectedDoctorId === "all" ? doctors.map((doctor) => doctor.user_id) : [selectedDoctorId];
                return candidates.some((doctorId) => canPlaceInSchedule(start, end, doctorId));
              }}
              eventAllow={(dropInfo, draggedEvent) => {
                if (!draggedEvent) return false;
                const start = dropInfo.start;
                const end = dropInfo.end;
                const appointment = appointments.find((item) => item.id === draggedEvent.id);
                if (!appointment) return false;
                return canPlaceInSchedule(start, end, appointment.doctor_id, appointment.id);
              }}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              allDaySlot={false}
              businessHours={businessHours}
              nowIndicator
              height="auto"
            />
          </div>
        )}
      </CardContent>

      <AppointmentModal
        open={modalOpen}
        mode={modalMode}
        doctors={doctors}
        patients={patients}
        selectedDoctorId={selectedDoctorId}
        initialDateTime={draftDateTime}
        initialDuration={draftDuration}
        appointment={activeAppointment}
        submitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={setModalOpen}
        onSubmit={handleModalSubmit}
      />
    </Card>
  );
}
