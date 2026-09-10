import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import PublicLayout from "./layouts/PublicLayout";
import GovernmentLayout from "./layouts/GovernmentLayout";
import LandingPage from "./pages/public/LandingPage";
import ReportIssuePage from "./pages/public/ReportIssuePage";
import ReportSuccessPage from "./pages/public/ReportSuccessPage";
import TrackComplaintPage from "./pages/public/TrackComplaintPage";
import LoginPage from "./pages/auth/LoginPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import DashboardPage from "./pages/government/DashboardPage";
import IncidentsPage from "./pages/government/IncidentsPage";
import IncidentDetailsPage from "./pages/government/IncidentDetailsPage";
import MapPage from "./pages/government/MapPage";
import WorkOrdersPage from "./pages/government/WorkOrdersPage";
import WorkersPage from "./pages/government/WorkersPage";
import BusesPage from "./pages/government/BusesPage";
import RoutesPage from "./pages/government/RoutesPage";
import BusStandsPage from "./pages/government/BusStandsPage";
import ProfilePage from "./pages/government/ProfilePage";
import AiMonitoringPage from "./pages/government/AiMonitoringPage";
import AssistantPage from "./pages/government/AssistantPage";
import WorkerDashboardPage from "./pages/worker/WorkerDashboardPage";
import MyWorkPage from "./pages/worker/MyWorkPage";
import WorkDetailsPage from "./pages/worker/WorkDetailsPage";
import LoadingSpinner from "./components/LoadingSpinner";
import SystemBootOverlay from "./components/SystemBootOverlay";
import PageTransition from "./components/PageTransition";
function Protected({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, loading, token } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to={user.role === "worker" ? "/worker" : "/dashboard"} replace />;
  return <>{children}</>;
}

export default function App() {
  return <AuthProvider>
    <SystemBootOverlay />
    <BrowserRouter>
      <PageTransition>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/report" element={<ReportIssuePage />} />
            <Route path="/report-success" element={<ReportSuccessPage />} />
            <Route path="/track" element={<TrackComplaintPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />

          <Route element={<Protected roles={["admin", "transport_officer"]}><GovernmentLayout /></Protected>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ai-monitoring" element={<AiMonitoringPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/:id" element={<WorkDetailsPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/buses" element={<BusesPage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/bus-stands" element={<BusStandsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route element={<Protected roles={["worker", "admin", "transport_officer"]}><GovernmentLayout /></Protected>}>
            <Route path="/worker" element={<WorkerDashboardPage />} />
            <Route path="/worker/work" element={<MyWorkPage />} />
            <Route path="/worker/work/:id" element={<WorkDetailsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </BrowserRouter>
  </AuthProvider>;
}

