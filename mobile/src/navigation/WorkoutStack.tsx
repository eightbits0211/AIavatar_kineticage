import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BundleSelectionScreen from '../screens/BundleSelectionScreen';
import BundleDetailScreen from '../screens/BundleDetailScreen';
import WorkoutSessionScreen from '../screens/WorkoutSessionScreen';

const Stack = createNativeStackNavigator();

/**
 * Workout flow: bundle selection → bundle detail → workout session.
 * Used as the "Workout" tab so we can push detail/session screens.
 */
export default function WorkoutStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BundleSelection" component={BundleSelectionScreen} />
      <Stack.Screen name="BundleDetail" component={BundleDetailScreen} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
    </Stack.Navigator>
  );
}
