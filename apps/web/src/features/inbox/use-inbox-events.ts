import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_BASE_URL } from "../../lib/api/client.ts";

/**
 * Subscribes to the inbox feed. The worker publishes to a Postgres channel and the
 * API relays only events for pages this seller owns, so this needs no page filter.
 */
export function useInboxEvents(queryClient: QueryClient): void {
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource(`${API_BASE_URL}/api/events`, { withCredentials: true });

      source.addEventListener("inbox", () => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["conversation"] });
        void queryClient.invalidateQueries({ queryKey: ["comments"] });
      });

      source.onerror = () => {
        // EventSource retries by itself, but it does not survive a closed stream
        // after a server restart, so reconnect deliberately.
        source?.close();
        retry = setTimeout(connect, 3_000);
      };
    };

    connect();

    return () => {
      if (retry) {
        clearTimeout(retry);
      }
      source?.close();
    };
  }, [queryClient]);
}
