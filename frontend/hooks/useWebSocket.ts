"use client";
import { useEffect, useRef, useCallback } from "react";
import { WS_URL } from "@/lib/api";

interface WSMessage {
  type: "snapshot_update";
  city: string;
  timestamp: string;
}

export function useWebSocket(city: string, onUpdate: (msg: WSMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stableOnUpdate = useRef(onUpdate);
  stableOnUpdate.current = onUpdate;

  const connect = useCallback(() => {
    if (!city || typeof window === "undefined") return;
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      ws.current = new WebSocket(`${WS_URL}/ws/city/${encodeURIComponent(city)}`);

      ws.current.onopen = () => {
        clearTimeout(reconnectTimer.current);
      };

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as WSMessage;
          stableOnUpdate.current(data);
        } catch {}
      };

      ws.current.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {}
  }, [city]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
