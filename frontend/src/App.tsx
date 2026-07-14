import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { usePushNotification } from "@/hooks/usePushNotification";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeCredentialsPage from "./pages/EmployeeCredentialsPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import PayrollPage from "./pages/PayrollPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import BillingPage from "./pages/BillingPage";
import ReportsPage from "./pages/ReportsPage";
import HolidaysPage from "./pages/HolidaysPage";
import PayrollSettingsPage from "./pages/PayrollSettingsPage";
import StudentsPage from "./pages/StudentsPage";
import StudentAttendancePage from "./pages/StudentAttendancePage";
import PlansPage from "./pages/PlansPage";
import TournamentsPage from "./pages/TournamentsPage";
import TournamentDetailPage from "./pages/TournamentDetailPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import ExpensesPage from "./pages/ExpensesPage";
import InventoryPage from "./pages/InventoryPage";
import FacilitiesPage from "./pages/FacilitiesPage";
import BookingsPage from "./pages/BookingsPage";
import ParentHomePage from "./pages/ParentHomePage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailedPage from "./pages/PaymentFailedPage";
import WelcomePage from "./pages/WelcomePage";
import ManagePage from "./pages/ManagePage";
import EmployeePayrollPage from "./pages/EmployeePayrollPage";
import MyLoansPage from "./pages/MyLoansPage";
import EmployeeReportPage from "./pages/EmployeeReportPage";
import LoansPage from "./pages/LoansPage";
import NotFound from "./pages/NotFound";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuditLogPage from "./pages/AuditLogPage";
import SupportPage from "./pages/SupportPage";
import DocumentVaultPage from "./pages/DocumentVaultPage";
import nesthrlogo from "../assets/nesthr.png";
import PageTransition from "@/components/layout/PageTransition";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading NestSports...
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const hasCompany = user?.company;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;

  const hasActiveSubscription =
    user?.subscription?.status === "active" ||
    user?.subscription?.status === "pending_renewal";
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
          path="/payroll-settings"
          element={
            <ProtectedRoute>
              <PayrollSettingsPage />
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
          path="/plans"
          element={
            <ProtectedRoute>
              <PlansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tournaments"
          element={
            <ProtectedRoute>
              <TournamentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <ProtectedRoute>
              <TournamentDetailPage />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
