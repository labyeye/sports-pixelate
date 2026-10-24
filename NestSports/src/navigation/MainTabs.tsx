import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  Menu,
  ClipboardCheck,
  UserCheck,
  Package,
  Clock,
  Wallet,
  IndianRupee,
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
import { useDisabledFeatures } from '../utils/disabledFeatures';
import CustomTabBar from '../components/common/CustomTabBar';

const Tab = createBottomTabNavigator();
const tabIconWrap = {
  width: 32,
  height: 28,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

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
  const disabledFeatures = useDisabledFeatures(!!user);

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View style={tabIconWrap}>
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
            tabBarIcon: ({ color }) => (
              <View style={tabIconWrap}>
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
            tabBarIcon: ({ color }) => (
              <View style={tabIconWrap}>
                <Wallet color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role &&
        PARENT.includes(role) &&
        !disabledFeatures.includes('bookings') && (
          <Tab.Screen
            name="BookingsTab"
            component={BookingsScreen}
            options={{
              title: 'Bookings',
              tabBarLabel: 'Bookings',
              tabBarIcon: ({ color }) => (
                <View style={tabIconWrap}>
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
            tabBarIcon: ({ color }) => (
              <View style={tabIconWrap}>
                <ClipboardCheck color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role && OWNER.includes(role) && (
        <Tab.Screen
          name="FeesTab"
          component={SubscriptionsScreen}
          options={{
            title: 'Fees',
            tabBarLabel: 'Fees',
            tabBarIcon: ({ color }) => (
              <View style={tabIconWrap}>
                <IndianRupee color={color} size={20} strokeWidth={2} />
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
            tabBarIcon: ({ color }) => (
              <View style={tabIconWrap}>
                <UserCheck color={color} size={20} strokeWidth={2} />
              </View>
            ),
          }}
        />
      )}
      {role &&
        OWNER_STAFF.includes(role) &&
        !OWNER.includes(role) &&
        !disabledFeatures.includes('inventory') && (
          <Tab.Screen
            name="InventoryTab"
            component={InventoryScreen}
            options={{
              title: 'Inventory',
              tabBarLabel: 'Inventory',
              tabBarIcon: ({ color }) => (
                <View style={tabIconWrap}>
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
          tabBarIcon: ({ color }) => (
            <View style={tabIconWrap}>
              <Menu color={color} size={20} strokeWidth={2} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
