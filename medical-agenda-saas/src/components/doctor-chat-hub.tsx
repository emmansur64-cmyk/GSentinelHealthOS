"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Clipboard, Eraser, ImagePlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMedicalImageAnalysisReport, type AiImageAnalysisResult } from "@/lib/ai-image-analysis-format";
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

export function DoctorChatHub({ doctorId }: { doctorId: string }) {
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [clearingChat, setClearingChat] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const chatRequestRef = useRef<{ requestId: string; controller: AbortController } | null>(null);

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

  useEffect(() => {
    return () => {
      chatRequestRef.current?.controller.abort();
      chatRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    if (!shouldAutoScrollRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!imageFile || !imageFile.type.startsWith("image/")) {
      setImagePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleChatScroll = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceToBottom <= 120;
  }, []);

  const postDoctorChat = useCallback(
    async (message: string, context: Record<string, unknown>, signal: AbortSignal) => {
      return fetchChatJson<DoctorChatResponse>("/chat/doctor", {
        method: "POST",
        signal,
        body: JSON.stringify({
          doctor_id: doctorId,
          message,
          context,
        }),
      });
    },
    [doctorId],
  );

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

    try {
      const result = await postDoctorChat(
        outgoingText,
        {
          metadata: {
            chat_request_id: requestId,
          },
        },
        controller.signal,
      );

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
      formData.set("source", "doctor_chat");

      const response = await fetch("/api/ai/image-analysis", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        data?: AiImageAnalysisResult;
        error?: { message?: string };
      };

      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }
      const analysis = payload.data;

      const doctorImageMessage: ChatMessage = {
        id: `doctor-image-${Date.now()}`,
        role: "doctor",
        content: `Adjunté imagen para análisis asistido: ${imageFile.name}`,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, doctorImageMessage]);

      setChatMessages((prev) => [
        ...prev,
        {
          id: `metabrain-image-${Date.now()}`,
          role: "metabrain",
          content: formatMedicalImageAnalysisReport(analysis),
          created_at: new Date().toISOString(),
          source: "GROQ_IMAGE_ANALYSIS",
        },
      ]);

      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      toast.success("Análisis asistido generado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen");
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-sky-600" />
            Chat clinico con MetaBrain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="max-h-[480px] space-y-2 overflow-auto rounded-md border bg-slate-50 p-3"
          >
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="doctor-chat-hub-input">Consulta clinica libre</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="doctor-chat-image-input"
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Adjuntar imagen
                </Button>
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
            </div>
            {imageFile ? (
              <div className="grid gap-2 rounded-md border bg-slate-50 p-2 text-xs text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">Archivo: {imageFile.name}</span>
                  <Button size="sm" disabled={imageLoading} onClick={() => void analyzeImage()}>
                    {imageLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    Analizar imagen
                  </Button>
                </div>
                {imagePreviewUrl ? (
                  <Image
                    src={imagePreviewUrl}
                    alt="Vista previa de imagen adjunta"
                    width={180}
                    height={112}
                    unoptimized
                    className="max-h-28 rounded-md border object-contain"
                  />
                ) : null}
                <p className="text-amber-700">Informe preliminar generado por IA. Requiere validación de un profesional médico.</p>
              </div>
            ) : null}
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
    </div>
  );
}
