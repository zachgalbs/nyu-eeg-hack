import { useNavigate, useLocation } from "react-router";
import { Home, Mountain, Users } from "lucide-react";

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'today', label: 'Today', icon: Home, path: '/' },
    { id: 'mountain', label: 'Mountain', icon: Mountain, path: '/mountain/active' },
    { id: 'friends', label: 'Friends', icon: Users, path: '/friends' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-snow border-t border-border">
      <div className="flex items-center justify-around px-8 py-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path ||
                          (tab.id === 'mountain' && location.pathname.includes('/mountain'));

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 transition-colors"
            >
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
