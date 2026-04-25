import { Navigate } from 'react-router';
import { isOnboardingComplete } from '../../lib/onboarding';

export function IndexRoute() {
  if (!isOnboardingComplete()) {
    return <Navigate to="/welcome" replace />;
  }
  return <Navigate to="/calendar" replace />;
}
