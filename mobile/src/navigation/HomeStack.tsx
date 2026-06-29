import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import BundleSelectionScreen from '../screens/BundleSelectionScreen';
import BundleDetailScreen from '../screens/BundleDetailScreen';
import WorkoutSessionScreen from '../screens/WorkoutSessionScreen';

const Stack = createNativeStackNavigator();

/**
 * AI Coach tab flow: Home dashboard → bundle selection → bundle detail →
 * workout session.
 */
export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="BundleSelection" component={BundleSelectionScreen} />
      <Stack.Screen name="BundleDetail" component={BundleDetailScreen} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
    </Stack.Navigator>
  );
}
