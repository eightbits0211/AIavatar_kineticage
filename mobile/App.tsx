import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import RootNavigator from './src/navigation/RootNavigator';
import { initAuthListener } from './src/services/auth';

export default function App() {
  useEffect(() => {
    // Register the Firebase auth listener once. It keeps the API token fresh,
    // hydrates the user profile, and drives conditional navigation.
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
