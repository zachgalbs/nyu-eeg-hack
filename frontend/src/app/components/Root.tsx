import { Outlet, useLocation } from "react-router";
import { TabBar } from "./TabBar";

export function Root() {
  const location = useLocation();

  const hiddenTabBarRoutes = ['/summit'];
  const showTabBar = !hiddenTabBarRoutes.some(route => location.pathname.includes(route));

  return (
    <div className="min-h-screen flex flex-col items-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen relative">
        <main className="flex-1 pb-20">
          <Outlet />
        </main>
        {showTabBar && <TabBar />}
      </div>
    </div>
  );
}
