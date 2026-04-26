import { useEffect, useMemo, useRef, useState } from "react";

const APPOINTMENT_EVENT_TYPES = new Set([
  "appointment_created",
  "appointment_updated",
  "appointment_cancelled",
  "whatsapp_message_received",
]);

function buildWsUrl() {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

  try {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${parsed.host}/ws/notifications`;
  } catch {
    return "ws://localhost:4000/ws/notifications";
  }
}

export function useAppointmentEvents({ onEvent }) {
  const onEventRef = useRef(onEvent);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const wsRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  onEventRef.current = onEvent;

  const wsUrl = useMemo(() => buildWsUrl(), []);

  useEffect(() => {
    let isUnmounted = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function connect() {
      if (isUnmounted) return;

      setConnectionStatus("connecting");
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!APPOINTMENT_EVENT_TYPES.has(payload?.type)) return;
          onEventRef.current?.(payload);
        } catch {
          // Ignore malformed ws payloads to keep the stream alive.
        }
      };

      socket.onerror = () => {
        setConnectionStatus("error");
      };

      socket.onclose = () => {
        if (isUnmounted) return;

        setConnectionStatus("reconnecting");
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(1_000 * 2 ** Math.min(attempt, 4), 15_000);

        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      clearReconnectTimer();

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  return { connectionStatus };
}
