import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeStack from './HomeStack';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TabBarIcon from '../components/TabBarIcon';
import { colors } from '../theme';
import { useUIStore } from '../stores/uiStore';

const Tab = createBottomTabNavigator();

// Keep the floating pill just wide enough for 3 tabs, centered on screen.
const TAB_WIDTH = 300;

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  // Reactive width (recomputes on rotation / different devices) so the pill
  // stays centered and correctly sized instead of using a stale module value.
  const { width } = useWindowDimensions();
  const TAB_SIDE = Math.max(16, (width - TAB_WIDTH) / 2);
  // During an active workout (focus mode) the tab bar is hidden entirely.
  const hideTabBar = useUIStore((s) => s.hideTabBar);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Subtle slide + fade between tabs so switching feels smooth, not instant.
        animation: 'shift',
        tabBarActiveTintColor: 'rgb(166, 250, 4)',
        tabBarInactiveTintColor: colors.textLight,
        // Floating pill tab bar — content flows behind it (position: absolute).
        tabBarStyle: hideTabBar
          ? { display: 'none' }
          : {
          position: 'absolute',
          left: TAB_SIDE,
          right: TAB_SIDE,
          bottom: Math.max(insets.bottom, 10),
          height: 78,
          borderRadius: 39,
          paddingTop: 12,
          paddingBottom: 14,
          backgroundColor: 'rgba(24,24,26,0.92)',
          borderTopWidth: 0,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.12)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 12 },
      }}
    >
      <Tab.Screen
        name="AICoach"
        component={HomeStack}
        options={{
          tabBarLabel: 'AI Coach',
          tabBarIcon: ({ color }) => <TabBarIcon name="coach" color={color} size={27} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color }) => <TabBarIcon name="progress" color={color} size={27} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="profile" color={color} size={27} />,
        }}
      />
    </Tab.Navigator>
  );
}
