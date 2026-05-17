"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileUp, LoaderCircle, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { DSButton } from "@/components/design-system";
import { safeValidateDocumentAnalysis } from "@/lib/document-analysis-schema";

const stepLabels = [
  "1. Subir imagen",
  "2. Procesamiento",
  "3. Vista previa editable",
  "4. Confirmar importacion",
];

const dayOptions = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRows(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : []).map((row, index) => ({
    id: String(row.id ?? `preview-${index + 1}`),
    doctor_id: String(row.doctor_id ?? ""),
    day_of_week: Number(row.day_of_week ?? 1),
    specific_date: row.specific_date ? formatDate(row.specific_date) : "",
    start_time: String(row.start_time ?? "08:00"),
    end_time: String(row.end_time ?? "12:00"),
    slot_duration: Number(row.slot_duration ?? 30),
  }));
}

function buildRowSignature(row) {
  return [
    row.doctor_id,
    Number(row.day_of_week),
    String(row.specific_date ?? "").trim(),
    String(row.start_time ?? "").trim(),
    String(row.end_time ?? "").trim(),
    Number(row.slot_duration),
  ].join("|");
}

function dedupeRows(rows) {
  const seen = new Set();
  const unique = [];

  for (const row of rows) {
    const signature = buildRowSignature(row);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(row);
  }

  return unique;
}

async function readApiError(response) {
  try {
    const payload = await response.json();
    const apiError = payload?.error;
    const rawDetails = apiError?.details;

    const messageFromDetails =
      rawDetails && typeof rawDetails === "object" && typeof rawDetails.message === "string"
        ? rawDetails.message.trim()
        : "";

    const providerDetail =
      rawDetails && typeof rawDetails === "object" && typeof rawDetails.provider_error === "string"
        ? rawDetails.provider_error.trim()
        : typeof rawDetails === "string"
          ? rawDetails.trim()
          : "";

    const message =
      messageFromDetails ||
      (typeof apiError?.message === "string" && apiError.message.trim() ? apiError.message.trim() : "Error desconocido");

    return {
      message,
      details: providerDetail || null,
    };
  } catch {
    return {
      message: `Error HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`,
      details: null,
    };
  }
}

async function fetchCollection(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  const payload = await response.json();
  return payload?.data ?? payload;
}

function getDayLabel(dayOfWeek) {
  return dayOptions.find((option) => option.value === dayOfWeek)?.label ?? "Dia";
}

function buildDateLabel(row) {
  return row.specific_date || getDayLabel(Number(row.day_of_week));
}

function extractDetectedNameFromPlaceholder(doctorId) {
  const raw = String(doctorId ?? "");
  if (!raw.startsWith("__detected__")) return "";
  return raw.replace("__detected__", "").replace(/_/g, " ").trim();
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "doctor-importado";
}

function randomPassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function buildAutoDoctorPayload(analysisMeta) {
  const baseName = analysisMeta?.detected_doctor_name || analysisMeta?.professional_name || "Profesional Importado";
  const nameSlug = slugify(baseName);
  const stamp = Date.now().toString().slice(-6);
  const specialty = analysisMeta?.specialty?.trim() || "Medicina General";
  const licenseBase = analysisMeta?.detected_doctor_license || analysisMeta?.license_number || "AUTO";
  const matricula = `${licenseBase}`.trim().slice(0, 40) || `AUTO-${stamp}`;

  return {
    name: baseName,
    email: `${nameSlug}.${stamp}@import.local`,
    initial_password: randomPassword(16),
    specialty,
    matricula,
    ai_tag: `auto-${slugify(specialty).slice(0, 40)}`,
    appointment_duration: 30,
    buffer_minutes: 10,
    start_time: "08:00",
    end_time: "18:00",
    working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  };
}

export default function ImportAgenda() {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [autoCreateDoctorsByRow, setAutoCreateDoctorsByRow] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [analysisMeta, setAnalysisMeta] = useState(null);

  const doctorsQuery = useQuery({
    queryKey: ["import-agenda", "doctors"],
    queryFn: () => fetchCollection("/api/doctors"),
    staleTime: 60_000,
  });

  const doctors = useMemo(() => (Array.isArray(doctorsQuery.data) ? doctorsQuery.data : []), [doctorsQuery.data]);
  const doctorsById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.user_id, doctor.user?.name ?? doctor.user_id])),
    [doctors],
  );

  const duplicateSignatureCounts = useMemo(() => {
    const counts = new Map();

    for (const row of previewRows) {
      const signature = buildRowSignature(row);
      counts.set(signature, (counts.get(signature) ?? 0) + 1);
    }

    return counts;
  }, [previewRows]);

  const missingBaseData = doctors.length === 0;

  const onSelectFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setImportResult(null);
    setPreviewRows([]);
    setAutoCreateDoctorsByRow({});
    setAnalysisMeta(null);
    setStep(1);
  };

  const processWithBackend = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import/agenda/parse", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const apiError = await readApiError(response);
      const detail = typeof apiError?.details === "string" && apiError.details.trim() ? ` (${apiError.details.trim()})` : "";
      throw new Error(`${apiError?.message ?? "No se obtuvo respuesta util del motor de importacion"}${detail}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload;

    if (process.env.NODE_ENV === "development") {
      console.debug("ImportAgenda parse response", data);
    }

    if (data?.ok === false) {
      const backendMessage =
        data?.message || data?.error?.message || data?.error || "Error de parse en backend";
      throw new Error(String(backendMessage));
    }

    const analysisValidation = safeValidateDocumentAnalysis(data?.analysis ?? data);
    if (!analysisValidation.success) {
      throw new Error("La respuesta OCR/IA no cumple el contrato de analisis documental");
    }

    // Si la IA detectó doctor pero no hay coincidencia en BD, crear ID placeholder
    const detected_doctor_name =
      data?.detected_doctor_name?.trim() ||
      analysisValidation.data?.provider?.professional_name?.trim() ||
      "";
    const detected_doctor_license =
      data?.detected_doctor_license?.trim() ||
      analysisValidation.data?.provider?.license_number?.trim() ||
      "";
    const matched_doctor_id = data?.matched_doctor_id || null;
    const parsedRows =
      Array.isArray(data?.availability_rules) && data.availability_rules.length > 0
        ? data.availability_rules
        : Array.isArray(data?.rows) && data.rows.length > 0
          ? data.rows
          : Array.isArray(data?.appointments) && data.appointments.length > 0
            ? data.appointments
            : [];

    let rows_with_detected = normalizeRows(parsedRows);

    // Pre-asignar doctor detectado a todas las filas sin doctor_id
    // PRIORIDAD: matched_doctor_id > placeholder (detected_doctor_name)
    if (matched_doctor_id) {
      // Si existe matched_doctor_id, asignarlo a TODAS las filas sin doctor_id
      rows_with_detected = rows_with_detected.map((row) => ({
        ...row,
        doctor_id: row.doctor_id || matched_doctor_id,
      }));
    } else if (detected_doctor_name) {
      // Si NO hay matched_doctor_id pero sí detected_doctor_name, usar placeholder
      const placeholder_id = `__detected__${detected_doctor_name.replace(/\s+/g, "_")}`;
      rows_with_detected = rows_with_detected.map((row) => ({
        ...row,
        doctor_id: row.doctor_id || placeholder_id,
      }));
    }

    return {
      analysis: analysisValidation.data,
      source: data?.source ?? "ocr",
      rows: rows_with_detected,
      detected_doctor_name,
      detected_doctor_license,
      matched_doctor_id,
    };
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      toast.error("Sube una imagen o PDF antes de procesar");
      return;
    }

    setProcessing(true);
    setStep(2);

    try {
      const { analysis, source, rows, detected_doctor_name, detected_doctor_license, matched_doctor_id } = await processWithBackend(selectedFile);
      setAnalysisMeta({
        source,
        document_type: analysis.document_type,
        quality: analysis.quality,
        quality_score: analysis.quality_score,
        detected_sections: analysis.detected_sections,
        professional_name: analysis.provider?.professional_name ?? "",
        license_number: analysis.provider?.license_number ?? "",
        specialty: analysis.provider?.specialty ?? "",
        detected_doctor_name,
        detected_doctor_license,
        matched_doctor_id,
      });

      if (rows.length === 0) {
        toast.error("No se detectaron turnos ni reglas de disponibilidad en la imagen. Verifique que la imagen sea legible y que contenga medico, fecha y horario.");
        setProcessing(false);
        setStep(1);
        return;
      }

      setPreviewRows(rows);
      setAutoCreateDoctorsByRow(
        rows.reduce((acc, row) => {
          if (String(row.doctor_id || "").startsWith("__detected__")) {
            acc[row.id] = true;
          }
          return acc;
        }, {}),
      );
      setStep(3);
      toast.success("Planilla detectada. Revisa la disponibilidad y confirma la importacion");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar el documento");
      setStep(1);
    } finally {
      setProcessing(false);
    }
  };

  const updateRow = (id, field, value) => {
    setPreviewRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeRow = (id) => {
    setPreviewRows((prev) => prev.filter((row) => row.id !== id));
    setAutoCreateDoctorsByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addRow = () => {
    const defaultDoctorId =
      String(analysisMeta?.matched_doctor_id ?? "").trim()
      || (analysisMeta?.detected_doctor_name ? `__detected__${analysisMeta.detected_doctor_name.replace(/\s+/g, "_")}` : "");

    setPreviewRows((prev) => [
      ...prev,
      {
        id: `preview-${Date.now()}`,
        doctor_id: defaultDoctorId,
        day_of_week: 1,
        specific_date: "",
        start_time: "08:00",
        end_time: "12:00",
        slot_duration: 30,
      },
    ]);
  };

  const confirmImport = async () => {
    if (previewRows.length === 0) {
      toast.error("Agrega al menos una franja horaria para importar");
      return;
    }

    const incompleteRow = previewRows.find((row) => {
      const duration = Number(row.slot_duration);
      return !row.doctor_id || !row.start_time || !row.end_time || !Number.isFinite(duration) || duration <= 0;
    });
    if (incompleteRow) {
      if (!incompleteRow.doctor_id) {
        toast.error("Falta seleccionar o crear el profesional en una franja antes de importar");
        return;
      }
      if (!incompleteRow.start_time || !incompleteRow.end_time) {
        toast.error("Falta completar el horario en una franja antes de importar");
        return;
      }
      toast.error("Falta completar una duracion valida antes de importar");
      return;
    }

    setImporting(true);
    setStep(4);

    const dedupedRows = dedupeRows(previewRows);
    const duplicateCount = previewRows.length - dedupedRows.length;

    let success = 0;
    let failed = 0;
    let existing = 0;
    const rowResults = [];
    const autoCreatedDoctorByPlaceholder = new Map();

    if (duplicateCount > 0) {
      const seen = new Set();
      for (const row of previewRows) {
        const signature = buildRowSignature(row);
        if (seen.has(signature)) {
          rowResults.push({
            rowId: row.id,
            status: "duplicate_omitted",
            message: "Duplicado omitido antes de importar",
            doctorName: doctorsById.get(row.doctor_id) ?? row.doctor_id,
            dateLabel: buildDateLabel(row),
          });
          continue;
        }
        seen.add(signature);
      }
    }

    for (const row of dedupedRows) {
      try {
        const isDetectedPlaceholder = String(row.doctor_id || "").startsWith("__detected__");
        const shouldAutoCreateDoctor = Boolean(autoCreateDoctorsByRow[row.id]);
        let doctorIdForSchedule = row.doctor_id;

        if (isDetectedPlaceholder) {
          if (shouldAutoCreateDoctor) {
            if (autoCreatedDoctorByPlaceholder.has(row.doctor_id)) {
              doctorIdForSchedule = autoCreatedDoctorByPlaceholder.get(row.doctor_id);
            } else {
              const ingestResponse = await fetch("/api/import/agenda/ingest", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  autoCreateDoctors: true,
                  doctor: buildAutoDoctorPayload(analysisMeta),
                  availability_rules: [
                    {
                      day_of_week: Number(row.day_of_week),
                      specific_date: row.specific_date || undefined,
                      start_time: row.start_time,
                      end_time: row.end_time,
                      slot_duration: Number(row.slot_duration),
                    },
                  ],
                }),
              });

              if (ingestResponse.ok) {
                const ingestPayload = await ingestResponse.json().catch(() => ({}));
                const resolvedDoctorId =
                  ingestPayload?.data?.doctor_user_id || ingestPayload?.doctor_user_id || ingestPayload?.data?.doctor_id || null;

                if (resolvedDoctorId) {
                  autoCreatedDoctorByPlaceholder.set(row.doctor_id, resolvedDoctorId);
                  doctorIdForSchedule = resolvedDoctorId;
                }

                success += 1;
                rowResults.push({
                  rowId: row.id,
                  status: "created",
                  message: "Profesional auto-creado y disponibilidad importada",
                  doctorName: analysisMeta?.detected_doctor_name || "Profesional importado",
                  dateLabel: buildDateLabel(row),
                });
                continue;
              }

              const ingestError = await readApiError(ingestResponse);
              failed += 1;
              rowResults.push({
                rowId: row.id,
                status: "error",
                message: ingestError?.message ?? "No se pudo auto-crear el profesional",
                rawMessage: ingestError?.message ?? null,
                doctorName: analysisMeta?.detected_doctor_name || row.doctor_id,
                dateLabel: buildDateLabel(row),
              });
              continue;
            }
          } else {
            failed += 1;
            rowResults.push({
              rowId: row.id,
              status: "warning",
              message: "Profesional no registrado. Marca 'Crear nuevo profesional automaticamente' para esta fila.",
              doctorName: analysisMeta?.detected_doctor_name || row.doctor_id,
              dateLabel: buildDateLabel(row),
            });
            continue;
          }
        }

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            doctor_id: doctorIdForSchedule,
            day_of_week: Number(row.day_of_week),
            specific_date: row.specific_date || undefined,
            start_time: row.start_time,
            end_time: row.end_time,
            slot_duration: Number(row.slot_duration),
            autoCreateDoctors: true,
          }),
        });

        if (response.ok) {
          if (response.status === 201) {
            success += 1;
            rowResults.push({
              rowId: row.id,
              status: "created",
              message: "Disponibilidad creada",
              doctorName: doctorsById.get(row.doctor_id) ?? row.doctor_id,
              dateLabel: buildDateLabel(row),
            });
          } else {
            existing += 1;
            rowResults.push({
              rowId: row.id,
              status: "existing",
              message: "Disponibilidad ya existente",
              doctorName: doctorsById.get(row.doctor_id) ?? row.doctor_id,
              dateLabel: buildDateLabel(row),
            });
          }
          continue;
        }

        const apiError = await readApiError(response);
        failed += 1;
        rowResults.push({
          rowId: row.id,
          status: "error",
          message: apiError?.message ?? "No se pudo crear la disponibilidad",
          rawMessage: apiError?.message ?? null,
          doctorName: doctorsById.get(row.doctor_id) ?? row.doctor_id,
          dateLabel: buildDateLabel(row),
        });
      } catch {
        failed += 1;
        rowResults.push({
          rowId: row.id,
          status: "error",
          message: "Error de red o de servidor",
          doctorName: doctorsById.get(row.doctor_id) ?? row.doctor_id,
          dateLabel: buildDateLabel(row),
        });
      }
    }

    setImportResult({
      success,
      failed,
      duplicateCount,
      existing,
      rows: rowResults,
    });
    setImporting(false);

    if (failed === 0 && duplicateCount === 0 && existing === 0) {
      toast.success(`Importacion completada: ${success} reglas de agenda`);
      return;
    }

    if (failed === 0) {
      const duplicateMsg = duplicateCount > 0 ? `, ${duplicateCount} duplicados omitidos` : "";
      const existingMsg = existing > 0 ? `, ${existing} ya existentes` : "";
      toast.success(`Importacion completada: ${success} creadas${existingMsg}${duplicateMsg}`);
    } else {
      const duplicateMsg = duplicateCount > 0 ? `, ${duplicateCount} duplicados omitidos` : "";
      const existingMsg = existing > 0 ? `, ${existing} ya existentes` : "";
      toast.warning(`Importacion parcial: ${success} creadas, ${failed} fallidas${duplicateMsg}${existingMsg}`);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Importar Agenda</h2>
        <p className="mt-1 text-sm text-slate-500">
          Carga una planilla mensual del medico, valida la disponibilidad detectada y confirma la importacion de agenda.
        </p>
      </div>

      {missingBaseData ? (
        <div className="surface-card border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">Advertencia: no hay profesionales registrados</p>
          <p className="mt-1 text-sm text-amber-800">
            Puedes continuar e importar la agenda usando la opcion de crear profesional automaticamente por fila.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {stepLabels.map((label, index) => {
          const currentStep = index + 1;
          const active = currentStep === step;
          const completed = currentStep < step;

          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : completed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className="surface-card p-5">
        <div
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragActive ? "border-slate-900 bg-slate-50" : "border-slate-300 bg-slate-50/50"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            onSelectFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-base font-medium text-slate-900">Arrastra una imagen o PDF de la planilla del medico</p>
          <p className="mt-1 text-sm text-slate-500">
            Admitido: JPG, PNG, PDF. La IA extraera el medico, el mes y las franjas horarias de la planilla.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
          />

          <DSButton className="mt-4" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="h-4 w-4" />
            Seleccionar archivo
          </DSButton>

          {selectedFile ? (
            <p className="mt-3 text-sm text-slate-700">
              Archivo seleccionado: <strong>{selectedFile.name}</strong>
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DSButton onClick={handleProcess} loading={processing || doctorsQuery.isLoading}>
            <Sparkles className="h-4 w-4" />
            Procesar planilla
          </DSButton>
        </div>
      </div>

      {step === 2 || processing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-900">Procesando documento con IA...</p>
          <p className="text-sm text-slate-500">Extrayendo disponibilidad del medico y normalizando la estructura mensual.</p>
        </div>
      ) : null}

      {step >= 3 && previewRows.length > 0 ? (
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Vista previa de disponibilidad detectada</h3>
              <p className="text-sm text-slate-500">Edita las reglas del medico antes de confirmar la importacion.</p>
            </div>
            <DSButton variant="secondary" onClick={addRow}>Agregar franja</DSButton>
          </div>

          {analysisMeta ? (
            <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {(analysisMeta.professional_name || analysisMeta.license_number) ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-200 pb-2">
                  {analysisMeta.professional_name ? (
                    <p><span className="font-semibold text-slate-900">Profesional:</span> {analysisMeta.professional_name}</p>
                  ) : null}
                  {analysisMeta.license_number ? (
                    <p><span className="font-semibold text-slate-900">Matricula:</span> {analysisMeta.license_number}</p>
                  ) : null}
                  {analysisMeta.specialty ? (
                    <p><span className="font-semibold text-slate-900">Especialidad:</span> {analysisMeta.specialty}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-2 md:grid-cols-5">
                <p><span className="font-semibold text-slate-900">Motor:</span> {analysisMeta.source}</p>
                <p><span className="font-semibold text-slate-900">Documento:</span> {analysisMeta.document_type}</p>
                <p><span className="font-semibold text-slate-900">Calidad:</span> {analysisMeta.quality}</p>
                <p><span className="font-semibold text-slate-900">Score:</span> {analysisMeta.quality_score}</p>
                <p><span className="font-semibold text-slate-900">Secciones:</span> {analysisMeta.detected_sections.length}</p>
              </div>
            </div>
          ) : null}

          {Array.from(duplicateSignatureCounts.values()).some((count) => count > 1) ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Hay filas duplicadas en la vista previa. Se marcaran abajo y se omitiran al confirmar la importacion.
            </div>
          ) : null}

          {analysisMeta?.detected_doctor_name && previewRows.some((r) => r.doctor_id?.startsWith("__detected__")) ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Advertencia: profesional detectado sin registro</p>
              <p className="mt-1">Nombre: <strong>{analysisMeta.detected_doctor_name}</strong></p>
              {analysisMeta.detected_doctor_license ? <p>Matrícula: <strong>{analysisMeta.detected_doctor_license}</strong></p> : null}
              <p className="mt-2 text-xs italic">Puedes continuar: selecciona un profesional existente o activa la creación automática por fila.</p>
            </div>
          ) : null}

          <div className="space-y-3">
            {previewRows.map((row) => {
              const isDuplicate = (duplicateSignatureCounts.get(buildRowSignature(row)) ?? 0) > 1;
              const isDetectedPlaceholder = String(row.doctor_id || "").startsWith("__detected__");
              const doctorDisplayName =
                doctorsById.get(row.doctor_id)
                || (isDetectedPlaceholder
                  ? (analysisMeta?.detected_doctor_name || extractDetectedNameFromPlaceholder(row.doctor_id) || "Profesional detectado")
                  : "")
                || analysisMeta?.professional_name
                || "Sin profesional detectado";

              return (
                <div
                  key={row.id}
                  className={`grid gap-2 rounded-2xl border p-3 md:grid-cols-6 ${
                    isDuplicate ? "border-amber-300 bg-amber-50/60" : "border-slate-200"
                  }`}
                >
                  <input
                    type="text"
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
                    value={doctorDisplayName}
                    readOnly
                    title={doctorDisplayName}
                  />

                  <select
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={row.day_of_week}
                    onChange={(event) => updateRow(row.id, "day_of_week", Number(event.target.value))}
                  >
                    {dayOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={row.specific_date}
                    onChange={(event) => updateRow(row.id, "specific_date", event.target.value)}
                  />

                  <input
                    type="time"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={row.start_time}
                    onChange={(event) => updateRow(row.id, "start_time", event.target.value)}
                  />

                  <input
                    type="time"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={row.end_time}
                    onChange={(event) => updateRow(row.id, "end_time", event.target.value)}
                  />

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={10}
                      max={180}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={row.slot_duration}
                      onChange={(event) => updateRow(row.id, "slot_duration", Number(event.target.value))}
                    />
                    <button
                      type="button"
                      className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700"
                      onClick={() => removeRow(row.id)}
                    >
                      Quitar
                    </button>
                  </div>

                  {isDuplicate ? (
                    <div className="md:col-span-6">
                      <p className="text-sm font-medium text-amber-800">
                        Duplicado local detectado. Esta regla se omitira al confirmar si no la corriges.
                      </p>
                    </div>
                  ) : null}

                  {isDetectedPlaceholder ? (
                    <div className="md:col-span-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <label className="flex items-center gap-2 text-sm text-amber-900">
                        <input
                          type="checkbox"
                          checked={Boolean(autoCreateDoctorsByRow[row.id])}
                          onChange={(event) =>
                            setAutoCreateDoctorsByRow((prev) => ({
                              ...prev,
                              [row.id]: event.target.checked,
                            }))
                          }
                        />
                        Crear nuevo profesional automaticamente para esta fila
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <DSButton onClick={confirmImport} loading={importing}>Confirmar importacion de agenda</DSButton>
          </div>
        </div>
      ) : null}

      {step === 4 && importResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <p className="text-sm font-semibold">Importacion finalizada</p>
          </div>
          <p className="mt-1 text-sm text-emerald-800">Reglas creadas: {importResult.success}</p>
          <p className="text-sm text-emerald-800">Reglas con error: {importResult.failed}</p>
          <p className="text-sm text-emerald-800">Reglas ya existentes: {importResult.existing}</p>
          <p className="text-sm text-emerald-800">Duplicados omitidos: {importResult.duplicateCount}</p>

          {importResult.rows?.length > 0 ? (
            <div className="mt-4 space-y-2">
              {importResult.rows
                .filter((item) => item.status !== "created")
                .map((item) => (
                  <div key={`${item.rowId}-${item.status}`} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{item.doctorName}</p>
                    <p>{item.dateLabel} - {item.message}</p>
                    {item.rawMessage ? <p className="text-xs text-slate-500">Detalle: {item.rawMessage}</p> : null}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
