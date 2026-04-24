import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { TodayScreen } from "./components/TodayScreen";
import { MountainScreen } from "./components/MountainScreen";
import { SummitScreen } from "./components/SummitScreen";
import { FriendsScreen } from "./components/FriendsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: TodayScreen },
      { path: "mountain/:eventId", Component: MountainScreen },
      { path: "summit/:eventId", Component: SummitScreen },
      { path: "friends", Component: FriendsScreen },
    ],
  },
]);
