import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingChatScreen from '../screens/OnboardingChatScreen';

const Stack = createNativeStackNavigator();

/**
 * Onboarding stack — chat-style guided conversation that collects all user data
 * for persona assignment and workout personalization. Replaces the placeholder
 * with a full conversational flow matching the UI design.
 */
export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingChat" component={OnboardingChatScreen} />
    </Stack.Navigator>
  );
}
