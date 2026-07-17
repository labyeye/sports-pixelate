import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import MainTabs from './MainTabs';

// Auth / onboarding
import LoginScreen from '../screens/auth/LoginScreen';
import PhoneOtpLoginScreen from '../screens/auth/PhoneOtpLoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import PaymentSuccessScreen from '../screens/PaymentSuccessScreen';
import PaymentFailedScreen from '../screens/PaymentFailedScreen';

// Academy
import StudentsScreen from '../screens/StudentsScreen';
import AddStudentScreen from '../screens/AddStudentScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import AddEmployeeScreen from '../screens/AddEmployeeScreen';
import DepartmentsScreen from '../screens/DepartmentsScreen';
import EmployeeCredentialsScreen from '../screens/EmployeeCredentialsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import CreateTournamentScreen from '../screens/CreateTournamentScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';

// Attendance
import StudentAttendanceScreen from '../screens/StudentAttendanceScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import LeaveScreen from '../screens/LeaveScreen';
import HolidaysScreen from '../screens/HolidaysScreen';

// My Workspace (employee)
import MyPayrollScreen from '../screens/MyPayrollScreen';
import MyReportScreen from '../screens/MyReportScreen';
import MyLoansScreen from '../screens/MyLoansScreen';

// Parents / Billing & Plans
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import QrRenewalScreen from '../screens/QrRenewalScreen';
import BookingsScreen from '../screens/BookingsScreen';
import PlansScreen from '../screens/PlansScreen';
import AddPlanScreen from '../screens/AddPlanScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import PayrollScreen from '../screens/PayrollScreen';
import PayrollSettingsScreen from '../screens/PayrollSettingsScreen';
import LoansScreen from '../screens/LoansScreen';

// Facilities
import InventoryScreen from '../screens/InventoryScreen';
import FacilitiesScreen from '../screens/FacilitiesScreen';

// System
import ReportsScreen from '../screens/ReportsScreen';
import ManageScreen from '../screens/ManageScreen';
import BillingScreen from '../screens/BillingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TwoFactorScreen from '../screens/TwoFactorScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import SupportScreen from '../screens/SupportScreen';
import NotFoundScreen from '../screens/NotFoundScreen';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.blue} />
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingScreen />;

  const hasCompany = !!user?.company;
  const hasActiveSubscription =
    user?.subscription?.status === 'active' ||
    user?.subscription?.status === 'pending_renewal';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PhoneOtpLogin"
              component={PhoneOtpLoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Create Account' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Forgot Password' }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Reset Password' }}
            />
          </>
        ) : !hasCompany ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ title: 'Set Up Academy' }}
          />
        ) : !hasActiveSubscription && user?.role !== 'super_admin' ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PhoneOtpLogin"
              component={PhoneOtpLoginScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen
              name="PaymentSuccess"
              component={PaymentSuccessScreen}
              options={{ title: 'Payment Successful' }}
            />
            <Stack.Screen
              name="PaymentFailed"
              component={PaymentFailedScreen}
              options={{ title: 'Payment Failed' }}
            />

            <Stack.Screen name="Students" component={StudentsScreen} />
            <Stack.Screen
              name="AddStudent"
              component={AddStudentScreen}
              options={{ title: 'Add Student' }}
            />
            <Stack.Screen
              name="Employees"
              component={EmployeesScreen}
              options={{ title: 'Staff' }}
            />
            <Stack.Screen
              name="AddEmployee"
              component={AddEmployeeScreen}
              options={{ title: 'Add Staff' }}
            />
            <Stack.Screen name="Departments" component={DepartmentsScreen} />
            <Stack.Screen
              name="EmployeeCredentials"
              component={EmployeeCredentialsScreen}
              options={{ title: 'Credentials' }}
            />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Tournaments" component={TournamentsScreen} />
            <Stack.Screen
              name="CreateTournament"
              component={CreateTournamentScreen}
              options={{ title: 'New Tournament' }}
            />
            <Stack.Screen
              name="TournamentDetail"
              component={TournamentDetailScreen}
              options={{ title: 'Tournament' }}
            />

            <Stack.Screen
              name="StudentAttendance"
              component={StudentAttendanceScreen}
              options={{ title: 'Student Attendance' }}
            />
            <Stack.Screen
              name="Attendance"
              component={AttendanceScreen}
              options={{ title: 'Staff Attendance' }}
            />
            <Stack.Screen name="Leave" component={LeaveScreen} />
            <Stack.Screen name="Holidays" component={HolidaysScreen} />

            <Stack.Screen
              name="MyPayroll"
              component={MyPayrollScreen}
              options={{ title: 'My Payroll' }}
            />
            <Stack.Screen
              name="MyReport"
              component={MyReportScreen}
              options={{ title: 'My Report' }}
            />
            <Stack.Screen
              name="MyLoans"
              component={MyLoansScreen}
              options={{ title: 'My Loans' }}
            />

            <Stack.Screen
              name="Subscriptions"
              component={SubscriptionsScreen}
            />
            <Stack.Screen
              name="QrRenewal"
              component={QrRenewalScreen}
              options={{ title: 'Renew Subscription' }}
            />
            <Stack.Screen name="Bookings" component={BookingsScreen} />
            <Stack.Screen
              name="Plans"
              component={PlansScreen}
              options={{ title: 'Coaching Plans' }}
            />
            <Stack.Screen
              name="AddPlan"
              component={AddPlanScreen}
              options={{ title: 'Add Plan' }}
            />
            <Stack.Screen name="Expenses" component={ExpensesScreen} />
            <Stack.Screen name="Payroll" component={PayrollScreen} />
            <Stack.Screen
              name="PayrollSettings"
              component={PayrollSettingsScreen}
              options={{ title: 'Payroll Settings' }}
            />
            <Stack.Screen
              name="Loans"
              component={LoansScreen}
              options={{ title: 'Loans & Advances' }}
            />

            <Stack.Screen name="Inventory" component={InventoryScreen} />
            <Stack.Screen name="Facilities" component={FacilitiesScreen} />

            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Manage" component={ManageScreen} />
            <Stack.Screen name="Billing" component={BillingScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'My Profile' }}
            />
            <Stack.Screen
              name="TwoFactor"
              component={TwoFactorScreen}
              options={{ title: '2FA Security' }}
            />
            <Stack.Screen
              name="Permissions"
              component={PermissionsScreen}
              options={{ title: 'Permissions' }}
            />
            <Stack.Screen
              name="AuditLog"
              component={AuditLogScreen}
              options={{ title: 'Audit Log' }}
            />
            <Stack.Screen name="Support" component={SupportScreen} />
          </>
        )}
        <Stack.Screen
          name="NotFound"
          component={NotFoundScreen}
          options={{ title: 'Not Found' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
