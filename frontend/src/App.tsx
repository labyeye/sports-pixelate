import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImageCropHost } from "@/components/ui/ImageCropper";
import { useDisabledFeatures } from "@/hooks/useDisabledFeatures";
import { isPathDisabled } from "@/config/features";
import { ToastProvider } from "@/hooks/use-toast";
import { usePushNotification } from "@/hooks/usePushNotification";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const EmployeeCredentialsPage = lazy(() => import("./pages/EmployeeCredentialsPage"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const HolidaysPage = lazy(() => import("./pages/HolidaysPage"));
const AttendanceSettingsPage = lazy(() => import("./pages/AttendanceSettingsPage"));
const LateApprovalsPage = lazy(() => import("./pages/LateApprovalsPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const StudentAttendancePage = lazy(() => import("./pages/StudentAttendancePage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ExitManagementPage = lazy(() => import("./pages/ExitManagementPage"));
const FacilitiesPage = lazy(() => import("./pages/FacilitiesPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const ParentHomePage = lazy(() => import("./pages/ParentHomePage"));
const ParentAttendancePage = lazy(() => import("./pages/ParentAttendancePage"));
const ParentReportPage = lazy(() => import("./pages/ParentReportPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const PaymentFailedPage = lazy(() => import("./pages/PaymentFailedPage"));
const PaymentReturnPage = lazy(() => import("./pages/PaymentReturnPage"));
const PayLinkPage = lazy(() => import("./pages/PayLinkPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const ManagePage = lazy(() => import("./pages/ManagePage"));
const EmployeePayrollPage = lazy(() => import("./pages/EmployeePayrollPage"));
const MyLoansPage = lazy(() => import("./pages/MyLoansPage"));
const EmployeeReportPage = lazy(() => import("./pages/EmployeeReportPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
import NotFound from "./pages/NotFound";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const DocumentVaultPage = lazy(() => import("./pages/DocumentVaultPage"));
const BiometricPage = lazy(() => import("./pages/BiometricPage"));
const BiometricDevicePage = lazy(() => import("./pages/BiometricDevicePage"));
import nesthrlogo from "../assets/nesthr.png";
import PageTransition from "@/components/layout/PageTransition";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src={nesthrlogo} alt="NestPlay" className="h-16 w-auto" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading NestPlay...
        </p>
      </div>
    </div>
  );
}

// Pages that only the owner/HR may open. The API enforces the same rule; this
// just stops other roles landing on a half-broken screen by typing the URL.
const OWNER_ONLY_PATHS = [
  "/loans",
  "/payroll",
  "/employee-credentials",
  "/departments",
  "/attendance-settings",
  "/biometric",
  "/late-approvals",
  "/audit-log",
  "/manage",
  "/reports",
  "/plans",
  "/groups",
  "/expenses",
  "/exits",
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { pathname } = useLocation();
  const disabledFeatures = useDisabledFeatures(isAuthenticated);
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isPathDisabled(pathname, disabledFeatures)) {
    return <Navigate to="/" replace />;
  }

  const hasCompany = user?.company;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;

  const isOwnerRole =
    user?.role === "super_admin" || user?.role === "hr_manager";
  if (
    !isOwnerRole &&
    OWNER_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return <Navigate to="/" replace />;
  }

  const sub: any = user?.subscription;
  const now = Date.now();
  const GRACE_MS = 7 * 86400000; // keep in sync with backend GRACE_DAYS
  const hasActiveSubscription =
    (sub?.status === "active" || sub?.status === "pending_renewal") &&
    !(
      sub?.isTrial &&
      sub?.trialEndDate &&
      new Date(sub.trialEndDate).getTime() < now
    ) &&
    !(
      !sub?.isTrial &&
      sub?.renewalDate &&
      new Date(sub.renewalDate).getTime() + GRACE_MS < now
    );
  if (!hasActiveSubscription) {
    if (user?.role === "super_admin") return <Navigate to="/billing" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function BillingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.company) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user?.role === "employee") return <Navigate to="/my-profile" replace />;
  if (user?.role === "parent") return <Navigate to="/parent-home" replace />;
  return <DashboardPage />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  usePushNotification(isAuthenticated);
  if (isLoading) return <LoadingScreen />;

  return (
    <PageTransition>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/register"
          element={
            !isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        {}
        <Route path="/device/:token" element={<BiometricDevicePage />} />
        <Route
          path="/onboarding"
          element={
            isAuthenticated ? (
              <OnboardingPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        {}
        <Route
          path="/payment/success"
          element={
            isAuthenticated ? (
              <PaymentSuccessPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/payment/failed"
          element={
            isAuthenticated ? (
              <PaymentFailedPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        {/* Public: opened from the WhatsApp fee link, no login needed */}
        <Route path="/pay/:token" element={<PayLinkPage />} />
        <Route
          path="/payment-return"
          element={
            isAuthenticated ? (
              <PaymentReturnPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/welcome"
          element={
            isAuthenticated ? <WelcomePage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <BillingRoute>
              <BillingPage />
            </BillingRoute>
          }
        />
        <Route
          path="/my-profile"
          element={
            <ProtectedRoute>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee-credentials"
          element={
            <ProtectedRoute>
              <EmployeeCredentialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <LeavePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <PayrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments"
          element={
            <ProtectedRoute>
              <DepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/holidays"
          element={
            <ProtectedRoute>
              <HolidaysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance-settings"
          element={
            <ProtectedRoute>
              <AttendanceSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/late-approvals"
          element={
            <ProtectedRoute>
              <LateApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage"
          element={
            <ProtectedRoute>
              <ManagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-payroll"
          element={
            <ProtectedRoute>
              <EmployeePayrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-report"
          element={
            <ProtectedRoute>
              <EmployeeReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-loans"
          element={
            <ProtectedRoute>
              <MyLoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loans"
          element={
            <ProtectedRoute>
              <LoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exits"
          element={
            <ProtectedRoute>
              <ExitManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        {}
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentVaultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/biometric"
          element={
            <ProtectedRoute>
              <BiometricPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-attendance"
          element={
            <ProtectedRoute>
              <StudentAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <PlansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute>
              <SubscriptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <ExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/facilities"
          element={
            <ProtectedRoute>
              <FacilitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <BookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-home"
          element={
            <ProtectedRoute>
              <ParentHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-attendance"
          element={
            <ProtectedRoute>
              <ParentAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-report"
          element={
            <ProtectedRoute>
              <ParentReportPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </PageTransition>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <ImageCropHost />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
