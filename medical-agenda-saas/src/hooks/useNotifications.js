"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SUPPORTED_TYPES = new Set(["appointment_created", "appointment_cancelled", "appointment_rescheduled"]);

function buildDefaultSocketUrl() {
  if (typeof window === "undefined") return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/notifications`;
}

function parseNotificationPayload(payload) {
  const type = String(payload?.type ?? payload?.event ?? "").toLowerCase();
  if (!SUPPORTED_TYPES.has(type)) return null;

  const now = new Date();
  const timestamp = payload?.timestamp ? new Date(payload.timestamp) : now;

  return {
    id: String(payload?.id ?? `${type}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`),
    type,
    title: String(payload?.title ?? payload?.message ?? "Actualizacion de turno"),
    message: String(payload?.message ?? "Se recibio un evento de agenda"),
    appointmentId: payload?.appointment_id ?? payload?.appointmentId ?? null,
    timestamp: Number.isNaN(timestamp.getTime()) ? now.toISOString() : timestamp.toISOString(),
    read: false,
  };
}

export function useNotifications(options = {}) {
  const {
    socketUrl,
    maxItems = 50,
    reconnectDelayMs = 3000,
    enable = true,
  } = options;

  const [items, setItems] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(false);

  const connect = useCallback(() => {
    if (!enable) return;
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) wsRef.current.close();

    const targetUrl = socketUrl || buildDefaultSocketUrl();
    if (!targetUrl) return;

    try {
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        retryRef.current = 0;
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          const parsed = parseNotificationPayload(payload);
          if (!parsed) return;

          setItems((prev) => [parsed, ...prev].slice(0, maxItems));
        } catch {
          setError("Formato de notificacion invalido");
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setError("No se pudo conectar al canal de notificaciones");
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        const delay = Math.min(30_000, reconnectDelayMs * 2 ** retryRef.current);
        retryRef.current += 1;
        reconnectRef.current = window.setTimeout(() => {
          // eslint-disable-next-line react-hooks/immutability
          connect();
        }, delay);
      };
    } catch {
      setIsConnected(false);
      setError("WebSocket no disponible");
    }
  }, [enable, maxItems, reconnectDelayMs, socketUrl]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAllAsRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    unreadCount,
    isConnected,
    error,
    markAllAsRead,
    clearAll,
  };
}
