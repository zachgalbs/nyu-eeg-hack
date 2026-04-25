import { useNavigate, useLocation } from "react-router";
import { CalendarDays, Mountain, Users } from "lucide-react";

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: 'calendar',
      label: 'Calendar',
      icon: CalendarDays,
      path: '/calendar',
      match: (p: string) => p === '/calendar' || p === '/',
    },
    {
      id: 'mountain',
      label: 'Mountain',
      icon: Mountain,
      path: '/mountain/active',
      match: (p: string) => p.includes('/mountain'),
    },
    {
      id: 'friends',
      label: 'Friends',
      icon: Users,
      path: '/friends',
      match: (p: string) => p === '/friends',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
      <div className="flex w-full max-w-6xl items-stretch justify-around px-4 pt-1 pb-3 sm:px-8 lg:px-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.match(location.pathname);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              className="relative flex flex-1 flex-col items-center gap-1 pt-2 transition-colors"
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-terracotta"
                  aria-hidden
                />
              )}
              <Icon
                className={`w-6 h-6 ${isActive ? 'text-terracotta' : 'text-warm-gray'}`}
                strokeWidth={2}
              />
              <span
                className={`text-[13px] ${isActive ? 'text-terracotta' : 'text-warm-gray'}`}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
