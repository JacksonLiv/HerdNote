import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Opens the per-engagement WebSocket and invalidates any cached query
 * scoped to this engagement when a teammate makes a change — keeps every
 * operator's view live. Reconnects automatically.
 */
export function useEngagementSync(eid: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eid) return;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/engagements/${eid}`);

      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "changed") {
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) && q.queryKey.includes(eid),
            });
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [eid, qc]);
}
