import type { RoastDelivery, RoastTrigger } from "./roast-channel";

type RoastContext = {
  userName: string;
  userBlock: string;
  friendName?: string;
  friendActivity?: string;
  minutesIn?: number;
  trigger: RoastTrigger;
};

type ThrowPayload = {
  toUserId: string;
  toName?: string;
  fromName: string;
  sessionId?: string;
  roastText: string;
  trigger: RoastTrigger;
};

function cookieValue(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getUserIdFromCookie() {
  return cookieValue("user_id");
}

export async function generateRoast(context: RoastContext) {
  try {
    const response = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    if (!response.ok) throw new Error(`roast failed: ${response.status}`);
    const data = (await response.json()) as { roast?: string };
    if (!data.roast) throw new Error("missing roast text");
    return data.roast;
  } catch {
    const friend = context.friendName || "Your friend";
    if (context.trigger === "friend_throw") {
      return `${friend} spotted you drifting. Refocus now and reclaim the climb.`;
    }
    return `${context.userName}, this drift costs altitude. Lock in for the next block.`;
  }
}

export async function persistThrowEvent(payload: ThrowPayload) {
  try {
    const response = await fetch("/api/roasts/throw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pollRoastInbox() {
  try {
    const response = await fetch("/api/roasts/inbox?limit=10&ack=true");
    if (!response.ok) return [] as RoastDelivery[];
    const data = (await response.json()) as {
      events?: Array<{
        id: number;
        from_user_id: string;
        from_name: string | null;
        to_user_id: string;
        to_name: string | null;
        session_id: string | null;
        roast_text: string;
        trigger_source: RoastTrigger;
        created_at: string;
      }>;
    };
    return (data.events || []).map((event) => ({
      id: `db-${event.id}`,
      fromUserId: event.from_user_id,
      fromName: event.from_name || "Friend",
      toUserId: event.to_user_id,
      toName: event.to_name || undefined,
      sessionId: event.session_id || undefined,
      roastText: event.roast_text,
      trigger: event.trigger_source,
      createdAt: event.created_at,
    }));
  } catch {
    return [] as RoastDelivery[];
  }
}
