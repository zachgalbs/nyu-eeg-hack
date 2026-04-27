import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { IndexRoute } from "./components/IndexRoute";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CalendarScreen } from "./components/CalendarScreen";
import { MountainScreen } from "./components/MountainScreen";
import { SummitScreen } from "./components/SummitScreen";
import { FriendsScreen } from "./components/FriendsScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { JoinScreen } from "./components/JoinScreen";
import { PrivacyPolicyScreen } from "./components/PrivacyPolicyScreen";

export const router = createBrowserRouter([
  { path: "/welcome", Component: WelcomeScreen },
  { path: "/join", Component: JoinScreen },
  { path: "/privacy", Component: PrivacyPolicyScreen },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: IndexRoute },
      { path: "calendar", Component: CalendarScreen },
      { path: "mountain/:eventId", Component: MountainScreen },
      { path: "summit/:eventId", Component: SummitScreen },
      { path: "friends", Component: FriendsScreen },
      { path: "profile", Component: ProfileScreen },
    ],
  },
]);
