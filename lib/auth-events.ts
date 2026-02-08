const CHANNEL_NAME = "auth";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export type AuthEventType = "login" | "logout" | "refresh";

export function broadcastAuthEvent(type: AuthEventType) {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage({ type });
}

export function subscribeAuthEvents(
  handler: (event: { type: AuthEventType }) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const onMessage = (event: MessageEvent) => {
    if (!event.data || typeof event.data.type !== "string") return;
    handler(event.data as { type: AuthEventType });
  };

  ch.addEventListener("message", onMessage);

  return () => {
    ch.removeEventListener("message", onMessage);
  };
}
