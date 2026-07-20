import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Menu,
  ClipboardCheck,
  UserCheck,
  Package,
  Clock,
  Wallet,
  CalendarClock,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import DashboardScreen from '../screens/DashboardScreen';
import MyProfileScreen from '../screens/MyProfileScreen';
import ParentHomeScreen from '../screens/ParentHomeScreen';
import ParentAttendanceScreen from '../screens/ParentAttendanceScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import BookingsScreen from '../screens/BookingsScreen';
import StudentAttendanceScreen from '../screens/StudentAttendanceScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import InventoryScreen from '../screens/InventoryScreen';
import MenuScreen from '../screens/MenuScreen';
import { colors, FONT } from '../theme/colors';

const Tab = createBottomTabNavigator();

const OWNER: UserRole[] = ['super_admin', 'hr_manager'];
const OWNER_STAFF: UserRole[] = ['super_admin', 'hr_manager', 'employee'];
const PARENT: UserRole[] = ['parent'];

// The role picks which screen sits behind the "Home" tab — same split as
// RootRedirect in the web app's App.tsx (owner -> Dashboard, employee ->
// My Profile, parent -> Parent Home).
function HomeTabScreen({ navigation }: any) {
  const { user } = useAuth();
  if (user?.role === 'employee')
    return <MyProfileScreen navigation={navigation} />;
  if (user?.role === 'parent')
    return <ParentHomeScreen navigation={navigation} />;
  return <DashboardScreen />;
}

export default function MainTabs() {
  const { user } = useAuth();
  const role = user?.role;
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: [
          styles.tabBar,
          { height: tabBarHeight, paddingBottom: insets.bottom + 4 },
        ],
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Home color={color} size={20} strokeWidth={2} />
            </View>
          ),
        }}
      />
      {role && PARENT.includes(role) && (
        <Tab.Screen
          name="ParentAttendanceTab"
          component={ParentAttendanceScreen}
          options={{
            title: 'Attendance',
            tabBarLabel: 'Attendance',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Clock color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && PARENT.includes(role) && (
        <Tab.Screen
          name="SubscriptionsTab"
          component={SubscriptionsScreen}
          options={{
            title: 'Subscriptions',
            tabBarLabel: 'Wallet',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Wallet color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && PARENT.includes(role) && (
        <Tab.Screen
          name="BookingsTab"
          component={BookingsScreen}
          options={{
            title: 'Bookings',
            tabBarLabel: 'Bookings',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <CalendarClock color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && OWNER_STAFF.includes(role) && (
        <Tab.Screen
          name="StudentAttendanceTab"
          component={StudentAttendanceScreen}
          options={{
            title: 'Student Attendance',
            tabBarLabel: 'Students',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <ClipboardCheck color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && OWNER.includes(role) && (
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceScreen}
          options={{
            title: 'Staff Attendance',
            tabBarLabel: 'Staff',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <UserCheck color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && OWNER_STAFF.includes(role) && (
        <Tab.Screen
          name="InventoryTab"
          component={InventoryScreen}
          options={{
            title: 'Inventory',
            tabBarLabel: 'Inventory',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Package color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Menu color={color} size={20} strokeWidth={2} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 2,
    borderTopColor: colors.black,
    backgroundColor: colors.white,
    paddingTop: 4,
  },
  tabLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {},
});
