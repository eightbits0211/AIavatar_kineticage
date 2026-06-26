import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingChatScreen from '../screens/OnboardingChatScreen';
import HealthMetricsScreen from '../screens/HealthMetricsScreen';

const Stack = createNativeStackNavigator();

/**
 * Onboarding stack — chat-style guided conversation that collects all user data
 * for persona assignment and workout personalization, followed by the Health
 * Metrics summary screen shown once /api/personalize returns.
 */
export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingChat" component={OnboardingChatScreen} />
      <Stack.Screen name="HealthMetrics" component={HealthMetricsScreen} />
    </Stack.Navigator>
  );
}
