import { Outlet, useLocation } from "react-router";
import { TabBar } from "./TabBar";

export function Root() {
  const location = useLocation();

  // Hide tabs only on full-focus summit route.
  const hideTabBar = location.pathname.includes('/summit');
  const showTabBar = !hideTabBar;

  return (
    <div className="min-h-screen w-full flex flex-col items-center text-ink">
      <div className="relative flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-8 lg:px-10">
        <main className="flex-1 pb-44 text-foreground sm:pb-48">
          <Outlet />
        </main>
        {showTabBar && <TabBar />}
      </div>
    </div>
  );
}
