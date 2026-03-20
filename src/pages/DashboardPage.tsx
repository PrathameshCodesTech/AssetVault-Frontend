import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary } from '@/services/dashboardService';
import { mapDashboardSummary } from '@/services/mappers';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import VendorDashboard from '@/components/dashboard/VendorDashboard';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const isVendorOnly = (user?.permissions?.includes('vendor.respond') ?? false)
    && !['super_admin', 'location_admin', 'employee'].includes(user?.role ?? '');

  const { data: rawSummary, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardSummary,
    enabled: !isVendorOnly,
  });

  // Vendor-only users have their own dashboard — skip summary fetch entirely
  if (isVendorOnly) {
    return <div className="p-4 md:p-6"><VendorDashboard /></div>;
  }

  const summary = rawSummary ? mapDashboardSummary(rawSummary) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-destructive">Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-display">Asset Vault</h1>
        </div>
      </div>

      <div className="mb-6 hidden md:block">
        <h1 className="text-2xl font-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">Welcome back, {user?.name}</p>
      </div>

      {user?.role === 'employee' && <EmployeeDashboard summary={summary} />}
      {user?.role === 'location_admin' && <AdminDashboard summary={summary} extraData={rawSummary} />}
      {user?.role === 'super_admin' && <SuperAdminDashboard summary={summary} extraData={rawSummary} />}
    </div>
  );
}
