import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVendorRequests, VendorVerificationRequest } from '@/services/vendorService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, ClipboardList, CheckCircle, AlertTriangle, ChevronRight,
  Send, ScanLine, FileCheck, ShieldCheck,
} from 'lucide-react';

function statusBadgeClass(s: string) {
  switch (s) {
    case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'submitted': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'correction_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: allRequests = [] } = useQuery({
    queryKey: ['vendor', 'requests', 'all'],
    queryFn: () => fetchVendorRequests(),
  });

  const requests = allRequests as VendorVerificationRequest[];

  const activeCount = requests.filter((r) =>
    ['sent', 'in_progress'].includes(r.status)
  ).length;
  const correctionCount = requests.filter((r) => r.status === 'correction_requested').length;
  const submittedCount = requests.filter((r) => r.status === 'submitted').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const actionRequired = requests.filter((r) =>
    ['sent', 'correction_requested'].includes(r.status)
  );

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-display">Vendor Portal</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Welcome back, {user?.name}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-body">Active</p>
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card className={correctionCount > 0 ? 'border-orange-300' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-body">Corrections</p>
              <AlertTriangle className={`h-4 w-4 ${correctionCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <p className={`text-2xl font-bold mt-1 ${correctionCount > 0 ? 'text-orange-600' : ''}`}>{correctionCount}</p>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-body">Submitted</p>
              <ClipboardList className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{submittedCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-body">Approved</p>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Action required */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Action Required
              </span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/vendor/requests')}>
                View all <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actionRequired.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">No pending actions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionRequired.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/vendor/requests/${r.id}`)}
                  >
                    <div>
                      <p className="font-mono text-xs font-medium">{r.reference_code}</p>
                      <p className="text-xs text-muted-foreground">{r.asset_count} asset(s)</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(r.status)}`}>
                      {formatStatus(r.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Recent Requests
              </span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/vendor/requests')}>
                View all <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No requests yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/vendor/requests/${r.id}`)}
                  >
                    <div>
                      <p className="font-mono text-xs font-medium">{r.reference_code}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.submitted_at
                          ? new Date(r.submitted_at).toLocaleDateString()
                          : new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{r.asset_count} assets</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(r.status)}`}>
                        {formatStatus(r.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            How Vendor Verification Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: Send, title: 'Request Sent', desc: 'Admin sends a batch of assets for you to verify on-site.' },
              { icon: ScanLine, title: 'Verify Assets', desc: 'Visit each asset, scan or confirm it, and record any issues found.' },
              { icon: FileCheck, title: 'Submit Report', desc: 'Submit your verification responses once all assets are reviewed.' },
              { icon: CheckCircle, title: 'Admin Review', desc: 'Admin reviews your submission. Approved assets are finalised.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick action */}
      <div className="flex justify-end">
        <Button onClick={() => navigate('/vendor/requests')}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Go to My Requests
        </Button>
      </div>
    </div>
  );
}
