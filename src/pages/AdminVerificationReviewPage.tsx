import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAdminVerificationRequests,
  fetchVerificationRequestDetail,
  reviewVerificationRequest,
  AdminVerificationRequest,
  AdminVerificationRequestDetail,
  AdminReviewDecision,
} from '@/services/verificationService';
import {
  ShieldCheck, CheckCircle, AlertTriangle, Clock, ChevronRight, ArrowLeft, X, AlertCircle, Copy,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrMsg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string } };
  if (e?.response?.data) {
    const d = e.response.data;
    if (typeof d === 'string') return d;
    if (typeof d === 'object' && d.detail) return d.detail;
    return JSON.stringify(d);
  }
  return 'Something went wrong';
}

function statusBadgeClass(s: string) {
  switch (s) {
    case 'pending': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'opened':
    case 'otp_verified': return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'submitted': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'correction_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function adminDecisionBadgeClass(d: string) {
  switch (d) {
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'correction_required': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'missing': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-500 border-gray-200';
  }
}

function responseIcon(resp: string | null | undefined) {
  switch (resp) {
    case 'verified': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'issue_reported': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function formatStatus(s: string) {
  // correction_requested covers mixed admin-reviewed states (approved + missing + correction_required).
  // "Verification Findings" is the correct audit-friendly label for admin/history contexts.
  if (s === 'correction_requested') return 'Verification Findings';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type DecisionMap = Record<string, AdminReviewDecision | 'pending_review' | 'missing'>;

const STATUS_FILTERS = ['all', 'pending', 'opened', 'submitted', 'correction_requested', 'approved'];

// ---------------------------------------------------------------------------
// Per-asset review row
// ---------------------------------------------------------------------------

type RequestAsset = AdminVerificationRequestDetail['request_assets'][0];

function AssetReviewRow({
  ra,
  decisions,
  onDecisionChange,
  canDecide,
}: {
  ra: RequestAsset;
  decisions: DecisionMap;
  onDecisionChange: (id: string, d: AdminReviewDecision | 'pending_review') => void;
  canDecide: boolean;
}) {
  const decision = decisions[ra.id] ?? 'pending_review';
  const resp = ra.response;

  return (
    <div className={`border rounded-md p-3 space-y-2 ${
      decision === 'missing'
        ? 'border-red-300 bg-red-50/30'
        : decision === 'correction_required'
          ? 'border-orange-300 bg-orange-50/30'
          : decision === 'approved'
            ? 'border-green-200 bg-green-50/20'
            : ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {responseIcon(resp?.response)}
            <span className="font-medium text-sm">{ra.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{ra.assetId}</span>
            {resp && (
              <Badge variant="outline" className="text-[10px]">
                {resp.response === 'verified' ? 'Verified' : 'Issue Reported'}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
            {ra.serialNumber && <span>SN: {ra.serialNumber}</span>}
            {ra.categoryName && <span>{ra.categoryName}</span>}
            {ra.locationName && <span>{ra.locationName}</span>}
          </div>
          {resp?.issue && (
            <div className="text-xs text-orange-700 mt-1 font-medium">
              {formatStatus(resp.issue.issue_type)}
              {resp.issue.description && (
                <span className="font-normal text-muted-foreground">: {resp.issue.description}</span>
              )}
            </div>
          )}
          {resp?.remarks && (
            <p className="text-xs italic text-muted-foreground mt-1">"{resp.remarks}"</p>
          )}
        </div>
        <Badge variant="outline" className={`${adminDecisionBadgeClass(decision)} text-xs flex-shrink-0`}>
          {formatStatus(decision)}
        </Badge>
      </div>

      {ra.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {ra.photos.map((p) =>
            p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt="asset" className="h-14 w-14 object-cover rounded border" />
              </a>
            ) : null
          )}
        </div>
      )}

      {canDecide && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Select
            value={decision}
            onValueChange={(v) => onDecisionChange(ra.id, v as AdminReviewDecision | 'pending_review')}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="correction_required">Correction Required</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request detail
// ---------------------------------------------------------------------------

function RequestDetail({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [decisions, setDecisions] = useState<DecisionMap>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'verification-request', requestId],
    queryFn: () => fetchVerificationRequestDetail(requestId),
  });

  useEffect(() => {
    if (data) {
      const init: DecisionMap = {};
      data.request_assets.forEach((ra) => {
        init[ra.id] = ra.response?.admin_review_status ?? 'pending_review';
      });
      setDecisions(init);
    }
  }, [data?.id]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admin', 'verification-request', requestId] });
    qc.invalidateQueries({ queryKey: ['adminVerificationRequests'] });
  }

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('No data');
      const assetReviews = data.request_assets.map((ra) => ({
        request_asset_id: ra.id,
        decision: 'approved' as AdminReviewDecision,
      }));
      return reviewVerificationRequest(requestId, assetReviews, reviewNote || undefined);
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Request approved' });
      setApproveOpen(false);
      setReviewNote('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const correctionMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('No data');
      const assetReviews = data.request_assets.map((ra) => {
        const d = decisions[ra.id] ?? 'pending_review';
        const decision: AdminReviewDecision =
          d === 'correction_required' ? 'correction_required'
          : d === 'missing' ? 'missing'
          : 'approved';
        return { request_asset_id: ra.id, decision };
      });
      return reviewVerificationRequest(requestId, assetReviews, reviewNote);
    },
    onSuccess: () => {
      refresh();
      toast({ title: 'Correction requested', description: 'Employee will be notified.' });
      setCorrectionOpen(false);
      setReviewNote('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Not found.</div>;

  const canReview = data.status === 'submitted';
  const hasCorrectionOrMissing = Object.values(decisions).some(
    (d) => d === 'correction_required' || d === 'missing'
  );

  // Live aggregate counts from local decision state (updates as admin picks decisions)
  const liveApproved = canReview
    ? Object.values(decisions).filter((d) => d === 'approved').length
    : data.approvedCount;
  const liveCorrection = canReview
    ? Object.values(decisions).filter((d) => d === 'correction_required').length
    : data.correctionCount;
  const liveMissing = canReview
    ? Object.values(decisions).filter((d) => d === 'missing').length
    : data.missingCount;
  const livePending = data.assetCount - liveApproved - liveCorrection - liveMissing;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold font-mono">{data.reference_code}</h2>
          <p className="text-sm text-muted-foreground">
            {data.employeeName} · {data.employeeEmail} · {data.assetCount} asset(s)
          </p>
        </div>
        <Badge variant="outline" className={statusBadgeClass(data.status)}>
          {formatStatus(data.status)}
        </Badge>
        {data.verification_link && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(data.verification_link!);
                toast({ title: 'Verification link copied', description: 'You can now share it manually with the employee.' });
              } catch {
                toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy Verification Link
          </Button>
        )}
      </div>

      {/* Previous review notes banner */}
      {data.review_notes && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Previous Review Notes</p>
            <p className="text-sm text-orange-800">{data.review_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Request metadata + aggregate summary */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Cycle:</span> {data.cycleName} ({data.cycleCode})</div>
            <div><span className="text-muted-foreground">Location:</span> {data.locationScopeName ?? '—'}</div>
            <div><span className="text-muted-foreground">Submitted:</span> {data.submitted_at ? new Date(data.submitted_at).toLocaleString() : '—'}</div>
            <div><span className="text-muted-foreground">Expires:</span> {data.expires_at ? new Date(data.expires_at).toLocaleDateString() : '—'}</div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1 border-t text-sm">
            <span className="text-green-700 font-medium">Approved: {liveApproved}</span>
            <span className="text-orange-700 font-medium">Correction: {liveCorrection}</span>
            {liveMissing > 0 && <span className="text-red-700 font-medium">Missing: {liveMissing}</span>}
            {livePending > 0 && <span className="text-muted-foreground">Pending: {livePending}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets ({data.request_assets.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.request_assets.map((ra) => (
            <AssetReviewRow
              key={ra.id}
              ra={ra}
              decisions={decisions}
              onDecisionChange={(id, d) => setDecisions((prev) => ({ ...prev, [id]: d }))}
              canDecide={canReview}
            />
          ))}
        </CardContent>
      </Card>

      {/* Missing assets section */}
      {liveMissing > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              Missing Assets ({liveMissing})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.request_assets
              .filter((ra) => (decisions[ra.id] ?? ra.response?.admin_review_status) === 'missing')
              .map((ra) => (
                <div key={ra.id} className="flex items-center justify-between border border-red-200 bg-red-50/30 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{ra.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{ra.assetId}{ra.serialNumber ? ` · SN: ${ra.serialNumber}` : ''}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200 shrink-0">Missing</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Employee reports */}
      {data.employee_reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Employee Reports ({data.employee_reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.employee_reports.map((r) => (
              <div key={r.id} className="border rounded-md p-3 border-orange-200 bg-orange-50/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{r.asset_name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{r.report_type}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {r.asset_id_if_known && <p>Asset ID: {r.asset_id_if_known}</p>}
                  {r.serial_number && <p>SN: {r.serial_number}</p>}
                  {r.location_description && <p>Found at: {r.location_description}</p>}
                  {r.expected_location && <p>Expected: {r.expected_location}</p>}
                  {r.remarks && <p>Remarks: {r.remarks}</p>}
                </div>
                {r.photos?.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {r.photos.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        <img src={p.url} alt="" className="h-14 w-14 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Declaration */}
      {data.declaration && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Declaration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Declared by:</span> {data.declaration.declared_by_name} ({data.declaration.declared_by_email})</p>
            <p><span className="text-muted-foreground">Consented at:</span> {new Date(data.declaration.consented_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {/* Review actions */}
      {canReview && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setReviewNote(''); setCorrectionOpen(true); }}>
            <X className="h-4 w-4 mr-2" />Submit Review
          </Button>
          <Button
            onClick={() => { setReviewNote(''); setApproveOpen(true); }}
            disabled={hasCorrectionOrMissing}
            title={hasCorrectionOrMissing ? 'Some assets are marked Correction Required or Missing. Use Submit Review instead.' : undefined}
          >
            <CheckCircle className="h-4 w-4 mr-2" />Approve All
          </Button>
        </div>
      )}

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            All assets will be marked as approved. The employee's verification will be completed.
          </p>
          <div className="space-y-1">
            <Label className="text-sm">Review Notes (optional)</Label>
            <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} placeholder="Any notes for record..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review submission dialog */}
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Review</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assets marked <strong>Correction Required</strong> will be sent back to the employee for re-verification.
            Assets marked <strong>Missing</strong> will be recorded and tracked — the asset master status will be set to missing.
            Approved assets remain locked.
          </p>
          {!hasCorrectionOrMissing && (
            <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
              Mark at least one asset as "Correction Required" or "Missing" before submitting. Use "Approve All" if everything is clear.
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-sm">Review Notes *</Label>
            <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} placeholder="Explain what needs to be corrected..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => correctionMutation.mutate()}
              disabled={correctionMutation.isPending || !reviewNote.trim() || !hasCorrectionOrMissing}
            >
              {correctionMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminVerificationReviewPage() {
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: listData, isLoading } = useQuery({
    queryKey: ['adminVerificationRequests', { page, status: statusFilter === 'all' ? undefined : statusFilter }],
    queryFn: () => fetchAdminVerificationRequests({
      page,
      page_size: PAGE_SIZE,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    enabled: !selectedId,
  });

  const requests = (listData?.results ?? []) as AdminVerificationRequest[];
  const totalCount = listData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (selectedId) {
    return (
      <div className="p-6">
        <RequestDetail requestId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Employee Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(s); setPage(1); }}
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
                  <TableHead>Employee</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No requests found</TableCell>
                  </TableRow>
                ) : requests.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(r.id)}>
                    <TableCell className="font-mono text-sm font-medium">{r.reference_code}</TableCell>
                    <TableCell>
                      <div className="text-sm">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.cycleName}</TableCell>
                    <TableCell>{r.assetCount}</TableCell>
                    <TableCell>
                      {(r.approvedCount > 0 || r.correctionCount > 0 || r.missingCount > 0) ? (
                        <div className="flex flex-col gap-0.5">
                          {r.approvedCount > 0 && (
                            <span className="text-xs text-green-700">{r.approvedCount} approved</span>
                          )}
                          {r.correctionCount > 0 && (
                            <span className="text-xs text-orange-700">{r.correctionCount} correction</span>
                          )}
                          {r.missingCount > 0 && (
                            <span className="text-xs text-red-700">{r.missingCount} missing</span>
                          )}
                        </div>
                      ) : r.issueCount > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                          {r.issueCount} issue(s)
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(r.status)}>
                        {formatStatus(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleDateString()
                        : new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{totalCount} request(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
