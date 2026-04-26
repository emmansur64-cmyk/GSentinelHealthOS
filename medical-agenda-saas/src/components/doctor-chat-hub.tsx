"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eraser, ImagePlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJsonWithRetry } from "@/lib/http-client";

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

type DoctorChatResponse = {
  response: string;
  confidence: number;
  source: string;
};

type ClearChatResponse = {
  conversation_id: string;
  deleted_count: number;
};

type ParseAnalysisResponse = {
  analysis?: {
    document_type?: string;
    quality?: string;
    observations?: string[];
    raw_extracted_text?: string;
    confidence?: { overall?: number };
    clinical_content?: {
      diagnoses?: string[];
      imaging_findings?: string[];
      recommendations?: string[];
    };
  };
  imaging_analysis?: {
    type?: string;
    region?: string;
    quality?: string;
    confidence?: number;
    condition?: string;
    probability?: number;
    findings?: string[];
    technical_description?: string;
    limitations?: string;
    recommendation?: string;
    pipeline?: string;
    model_key?: string;
    model_version?: string;
    notes?: string;
    elapsed_ms?: number;
  } | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJsonWithRetry<T>(url, init, {
    retries: 2,
    retryDelayMs: 350,
    timeoutMs: 12_000,
  });
}

export function DoctorChatHub({ doctorId }: { doctorId: string }) {
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [clearingChat, setClearingChat] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ParseAnalysisResponse["analysis"] | null>(null);
  const [imagingAnalysis, setImagingAnalysis] = useState<ParseAnalysisResponse["imaging_analysis"] | null>(null);

  const extractionPreview = useMemo(() => {
    const raw = String(analysis?.raw_extracted_text ?? "").trim();
    if (!raw) return "";
    return raw.slice(0, 500);
  }, [analysis]);

  const loadChatHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ doctor_id: doctorId });
      const data = await fetchJson<ChatHistoryResponse>(`/chat/doctor?${params.toString()}`);
      setChatMessages(data.messages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial del chat");
    } finally {
      setLoadingHistory(false);
    }
  }, [doctorId]);

  useEffect(() => {
    void loadChatHistory();
  }, [loadChatHistory]);

  const sendDoctorChat = async () => {
    if (!chatInput.trim()) return;

    const outgoingText = chatInput.trim();
    const doctorMessage: ChatMessage = {
      id: `doctor-${Date.now()}`,
      role: "doctor",
      content: outgoingText,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, doctorMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const result = await fetchJson<DoctorChatResponse>("/chat/doctor", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: doctorId,
          message: outgoingText,
        }),
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `metabrain-${Date.now()}`,
          role: "metabrain",
          content: result.response,
          created_at: new Date().toISOString(),
          confidence: result.confidence,
          source: result.source,
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => prev.filter((message) => message.id !== doctorMessage.id));
      setChatInput(outgoingText);
      toast.error(error instanceof Error ? error.message : "No se pudo obtener respuesta de MetaBrain");
    } finally {
      setChatLoading(false);
    }
  };

  const clearDoctorChat = async () => {
    setClearingChat(true);
    try {
      const params = new URLSearchParams({ doctor_id: doctorId });
      const result = await fetchJson<ClearChatResponse>(`/chat/doctor?${params.toString()}`, {
        method: "DELETE",
      });

      setChatMessages([]);
      setChatInput("");
      toast.success(`Chat borrado (${result.deleted_count} intercambio${result.deleted_count === 1 ? "" : "s"})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar el chat");
    } finally {
      setClearingChat(false);
    }
  };

  const analyzeImage = async () => {
    if (!imageFile) {
      toast.error("Selecciona una imagen o PDF para analizar");
      return;
    }

    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", imageFile);

      const response = await fetch("/api/import/agenda/parse", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        data?: ParseAnalysisResponse;
        error?: { message?: string };
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }

      setAnalysis(payload.data?.analysis ?? null);
      setImagingAnalysis(payload.data?.imaging_analysis ?? null);
      toast.success("Analisis de imagen completado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen");
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-sky-600" />
            Chat clinico con MetaBrain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-[480px] space-y-2 overflow-auto rounded-md border bg-slate-50 p-3">
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Cargando historial clinico...
              </div>
            ) : chatMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Inicia una consulta clinica para recibir apoyo de IA.</p>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md px-3 py-2 text-sm ${message.role === "doctor" ? "ml-auto max-w-[85%] bg-slate-900 text-white" : "max-w-[90%] border bg-white text-slate-800"}`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="doctor-chat-hub-input">Consulta clinica libre</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clearingChat}
                onClick={() => void clearDoctorChat()}
              >
                {clearingChat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
                Borrar chat
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                id="doctor-chat-hub-input"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ej: orientame sobre diagnostico diferencial y conducta inicial"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendDoctorChat();
                  }
                }}
              />
              <Button disabled={chatLoading || !chatInput.trim()} onClick={() => void sendDoctorChat()}>
                {chatLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4" />
            Analisis de imagen / PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="doctor-image-input">Archivo</Label>
            <Input
              id="doctor-image-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
            <Button disabled={imageLoading || !imageFile} onClick={() => void analyzeImage()}>
              {imageLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              Analizar con IA
            </Button>
          </div>

          {analysis ? (
            <div className="space-y-2 rounded-md border bg-slate-50 p-3 text-sm">
              <p><strong>Tipo:</strong> {analysis.document_type || "n/d"}</p>
              <p><strong>Calidad:</strong> {analysis.quality || "n/d"}</p>
              <p>
                <strong>Confianza:</strong>{" "}
                {typeof analysis.confidence?.overall === "number" ? `${Math.round(analysis.confidence.overall * 100)}%` : "n/d"}
              </p>
              <p><strong>Observaciones:</strong> {(analysis.observations ?? []).join(" | ") || "Sin observaciones"}</p>

              {imagingAnalysis ? (
                <div className="mt-2 space-y-1 rounded-md border bg-emerald-50 p-2">
                  <p className="font-semibold text-emerald-900">Pipeline de imagen medica</p>
                  <p><strong>Tipo estudio:</strong> {imagingAnalysis.type || "n/d"}</p>
                  <p><strong>Region:</strong> {imagingAnalysis.region || "n/d"}</p>
                  <p><strong>Calidad imagen:</strong> {imagingAnalysis.quality || "n/d"}</p>
                  <p><strong>Confianza:</strong> {typeof imagingAnalysis.confidence === "number" ? `${Math.round(imagingAnalysis.confidence * 100)}%` : "n/d"}</p>
                  <p><strong>Condicion sugerida:</strong> {imagingAnalysis.condition || "n/d"}</p>
                  <p><strong>Probabilidad:</strong> {typeof imagingAnalysis.probability === "number" ? `${Math.round(imagingAnalysis.probability * 100)}%` : "n/d"}</p>
                  <p><strong>Hallazgos estructurados:</strong> {(imagingAnalysis.findings ?? []).join(" | ") || "Sin hallazgos"}</p>
                  <p><strong>Descripcion tecnica:</strong> {imagingAnalysis.technical_description || "n/d"}</p>
                  <p><strong>Limitaciones:</strong> {imagingAnalysis.limitations || "n/d"}</p>
                  <p><strong>Recomendacion:</strong> {imagingAnalysis.recommendation || "n/d"}</p>
                  <p><strong>Pipeline:</strong> {imagingAnalysis.pipeline || "n/d"}</p>
                  <p><strong>Model key:</strong> {imagingAnalysis.model_key || "n/d"}</p>
                  <p><strong>Modelo:</strong> {imagingAnalysis.model_version || "n/d"}</p>
                  <p><strong>Tiempo inferencia:</strong> {typeof imagingAnalysis.elapsed_ms === "number" ? `${imagingAnalysis.elapsed_ms} ms` : "n/d"}</p>
                  <p><strong>Nota:</strong> {imagingAnalysis.notes || "Analisis asistido"}</p>
                </div>
              ) : null}

              <div className="mt-2 space-y-1 rounded-md border bg-white p-2">
                <p className="font-semibold text-slate-800">Informe clinico preliminar</p>
                <p>
                  <strong>Impresion diagnostica:</strong>{" "}
                  {(analysis.clinical_content?.diagnoses ?? []).join(" | ") || "No concluyente con la calidad actual del archivo."}
                </p>
                <p>
                  <strong>Hallazgos de imagen:</strong>{" "}
                  {(analysis.clinical_content?.imaging_findings ?? []).join(" | ") || "No se detectaron hallazgos estructurados en el texto extraido."}
                </p>
                <p>
                  <strong>Recomendaciones:</strong>{" "}
                  {(analysis.clinical_content?.recommendations ?? []).join(" | ") || "Correlacionar con clinica y evaluar informe formal por especialista."}
                </p>
              </div>

              {extractionPreview ? (
                <p className="text-xs text-slate-600">
                  <strong>Texto extraido:</strong> {extractionPreview}{analysis.raw_extracted_text && analysis.raw_extracted_text.length > 500 ? "..." : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sube un archivo para obtener analisis asistido por IA.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
