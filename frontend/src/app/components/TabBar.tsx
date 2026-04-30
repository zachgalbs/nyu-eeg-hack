import { useNavigate, useLocation } from "react-router";
import { CalendarDays, Mountain, Users, UserRound } from "lucide-react";

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: "calendar",
      label: "Calendar",
      icon: CalendarDays,
      path: "/calendar",
      match: (p: string) => p === "/calendar" || p === "/",
    },
    {
      id: "mountain",
      label: "Mountain",
      icon: Mountain,
      path: "/mountain",
      match: (p: string) => p.startsWith("/mountain"),
    },
    {
      id: "friends",
      label: "Friends",
      icon: Users,
      path: "/friends",
      match: (p: string) => p === "/friends",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserRound,
      path: "/profile",
      match: (p: string) => p === "/profile",
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div
        className="pointer-events-auto w-full max-w-6xl px-3 sm:px-6 lg:px-8"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <nav
          className="rounded-2xl border border-border bg-card/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-card/88"
          aria-label="Main"
        >
          <div className="flex items-end justify-between gap-0 px-1 pt-2 pb-2 sm:px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.match(location.pathname);

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.path)}
                  className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors active:scale-[0.98]"
                >
                  {isActive && (
                    <span
                      className="absolute top-0 left-1/2 h-1 w-7 -translate-x-1/2 rounded-full bg-terracotta"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={`h-6 w-6 shrink-0 ${isActive ? "text-terracotta" : "text-warm-gray"}`}
                    strokeWidth={isActive ? 2.25 : 2}
                  />
                  <span
                    className={`max-w-full truncate px-0.5 text-[11px] leading-tight sm:text-[12px] ${isActive ? "text-terracotta" : "text-warm-gray"}`}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
