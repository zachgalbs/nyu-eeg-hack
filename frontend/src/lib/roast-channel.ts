export type RoastTrigger = "auto" | "friend_throw";

export type RoastDelivery = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName?: string;
  sessionId?: string;
  roastText: string;
  trigger: RoastTrigger;
  createdAt: string;
};

const CHANNEL_NAME = "compcal-roast-events-v1";
const TAB_ID_KEY = "compcal_demo_tab_id";

function canUseSessionStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

export function getTabIdentity() {
  if (!canUseSessionStorage()) return "local-tab";
  let id = window.sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    window.sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

export function canUseRoastChannel() {
  return typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined";
}

export function publishRoast(delivery: RoastDelivery) {
  if (!canUseRoastChannel()) return;
  const channel = new window.BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(delivery);
  channel.close();
}

export function subscribeRoasts(onRoast: (payload: RoastDelivery) => void) {
  if (!canUseRoastChannel()) return () => {};
  const channel = new window.BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<RoastDelivery>) => {
    if (!event.data || !event.data.id) return;
    onRoast(event.data);
  };
  return () => channel.close();
}
