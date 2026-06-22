import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
      />
    </Stack.Navigator>
  );
}