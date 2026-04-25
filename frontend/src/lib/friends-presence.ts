export interface FriendPresence {
  id: number;
  name: string;
  currentTask: string | null;
  focusedTimeToday: number;
  altitude: number;
  status: "climbing" | "summited" | "idle";
  isUser?: boolean;
}

export const friendsPresenceData: FriendPresence[] = [
  {
    id: 1,
    name: "You",
    currentTask: "Deep Work: Design System",
    focusedTimeToday: 145,
    altitude: 68,
    status: "climbing",
    isUser: true,
  },
  {
    id: 2,
    name: "Sarah",
    currentTask: "Writing Sprint",
    focusedTimeToday: 132,
    altitude: 82,
    status: "climbing",
  },
  {
    id: 3,
    name: "Mike",
    currentTask: "Code Review Session",
    focusedTimeToday: 98,
    altitude: 55,
    status: "climbing",
  },
  {
    id: 4,
    name: "Alex",
    currentTask: null,
    focusedTimeToday: 180,
    altitude: 100,
    status: "summited",
  },
  {
    id: 5,
    name: "Jordan",
    currentTask: null,
    focusedTimeToday: 0,
    altitude: 0,
    status: "idle",
  },
];

export function getSortedFriendPresence() {
  return [...friendsPresenceData].sort((a, b) => {
    if (a.status === "climbing" && b.status !== "climbing") return -1;
    if (a.status !== "climbing" && b.status === "climbing") return 1;
    if (a.status === "summited" && b.status === "idle") return -1;
    if (a.status === "idle" && b.status === "summited") return 1;
    return b.altitude - a.altitude;
  });
}
