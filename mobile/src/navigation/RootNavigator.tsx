import { useUserStore } from '../stores/userStore';
import AuthStack from './AuthStack';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';
import LoadingScreen from '../screens/LoadingScreen';

/**
 * Conditional routing based on auth + onboarding state:
 *   - still resolving auth        → LoadingScreen
 *   - not signed in               → AuthStack (login / register / guest)
 *   - signed in, not onboarded    → OnboardingStack (guided setup)
 *   - signed in and onboarded     → MainTabs (the app)
 */
export default function RootNavigator() {
  const isInitializing = useUserStore((s) => s.isInitializing);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isOnboarded = useUserStore((s) => s.isOnboarded);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  if (!isOnboarded) {
    return <OnboardingStack />;
  }

  return <MainTabs />;
}
