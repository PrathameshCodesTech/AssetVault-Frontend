import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchVendorRequests, VendorVerificationRequest } from '@/services/vendorService';
import { ChevronRight, Package } from 'lucide-react';

const STATUS_FILTERS = ['all', 'sent', 'in_progress', 'submitted', 'correction_requested', 'approved'];

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

export default function VendorRequestsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['vendor', 'requests', statusFilter],
    queryFn: () => fetchVendorRequests({ status: statusFilter === 'all' ? undefined : statusFilter }),
  });

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Verification Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs"
              >
                {s === 'all' ? 'All' : formatStatus(s)}
              </Button>
            ))}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (requests as VendorVerificationRequest[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
                ) : (requests as VendorVerificationRequest[]).map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/vendor/requests/${r.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{r.reference_code}</TableCell>
                    <TableCell>{r.asset_count}</TableCell>
                    <TableCell>
                      {r.pending_count > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                          {r.pending_count} pending
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(r.status)}>
                        {formatStatus(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.sent_at ? new Date(r.sent_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
