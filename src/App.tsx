import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AssetsPage from "@/pages/AssetsPage";
import AssetDetailPage from "@/pages/AssetDetailPage";
import AssetRegisterPage from "@/pages/AssetRegisterPage";
import BulkUploadPage from "@/pages/BulkUploadPage";
import ScanPage from "@/pages/ScanPage";
import ReconciliationPage from "@/pages/ReconciliationPage";
import ReportsPage from "@/pages/ReportsPage";
import ProfilePage from "@/pages/ProfilePage";
import SubmissionsPage from "@/pages/SubmissionsPage";
import AdminSubmissionsPage from "@/pages/AdminSubmissionsPage";
import EmployeeVerificationPage from "@/pages/EmployeeVerificationPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const ProtectedLayout = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: any[] }) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Public employee verification route -- no auth required */}
            <Route path="/verify/:publicToken" element={<EmployeeVerificationPage />} />
            <Route path="/" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
            <Route path="/assets" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin', 'employee']}><AssetsPage /></ProtectedLayout>} />
            <Route path="/assets/:id" element={<ProtectedLayout><AssetDetailPage /></ProtectedLayout>} />
            <Route path="/assets/register" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin']}><AssetRegisterPage /></ProtectedLayout>} />
            <Route path="/assets/upload" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin']}><BulkUploadPage /></ProtectedLayout>} />
            <Route path="/scan" element={<ProtectedLayout><ScanPage /></ProtectedLayout>} />
            <Route path="/reconciliation" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin', 'employee', 'third_party']}><ReconciliationPage /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin']}><ReportsPage /></ProtectedLayout>} />
            <Route path="/submissions" element={<ProtectedLayout allowedRoles={['third_party']}><SubmissionsPage /></ProtectedLayout>} />
            <Route path="/admin/submissions" element={<ProtectedLayout allowedRoles={['super_admin', 'location_admin']}><AdminSubmissionsPage /></ProtectedLayout>} />
            <Route path="/profile" element={<ProtectedLayout><ProfilePage /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
