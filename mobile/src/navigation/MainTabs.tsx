import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TabBarIcon from '../components/TabBarIcon';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 78,
          paddingBottom: 18,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="AICoach"
        component={HomeStack}
        options={{
          tabBarLabel: 'AI Coach',
          tabBarIcon: ({ color }) => <TabBarIcon name="coach" color={color} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color }) => <TabBarIcon name="progress" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="profile" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
