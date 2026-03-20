import { useState } from 'react';
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
  fetchAdminVendorRequests,
  fetchAdminVendorRequest,
  approveVendorRequest,
  requestCorrectionVendorRequest,
  setAssetAdminDecision,
  sendVendorRequest,
  removeAssetFromDraftRequest,
  cancelVendorRequest,
  VendorVerificationRequest,
  VendorVerificationRequestDetail,
  VendorRequestAsset,
} from '@/services/vendorService';
import { CheckCircle, AlertTriangle, Clock, ChevronRight, ArrowLeft, Send, X, FileEdit, Trash2, Ban } from 'lucide-react';

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
    case 'draft': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'submitted': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'correction_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function adminDecisionClass(d: string) {
  switch (d) {
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'correction_required': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function responseIcon(status: string) {
  switch (status) {
    case 'confirmed': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'issue_reported': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_FILTERS = ['all', 'draft', 'sent', 'in_progress', 'submitted', 'correction_requested', 'approved'];

// ---------------------------------------------------------------------------
// Per-asset decision row inside detail view
// ---------------------------------------------------------------------------

function AssetDecisionRow({
  ra,
  requestId,
  requestStatus,
  onUpdate,
}: {
  ra: VendorRequestAsset;
  requestId: string;
  requestStatus: string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [decision, setDecision] = useState(ra.admin_decision);
  const [saving, setSaving] = useState(false);

  const canDecide = requestStatus === 'submitted';

  async function handleSave() {
    setSaving(true);
    try {
      await setAssetAdminDecision(requestId, ra.id, decision);
      toast({ title: 'Decision saved' });
      onUpdate();
    } catch (err) {
      toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`border rounded-md p-3 space-y-2 ${ra.admin_decision === 'correction_required' ? 'border-orange-300 bg-orange-50/30' : ra.admin_decision === 'approved' ? 'border-green-200 bg-green-50/20' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {responseIcon(ra.response_status)}
            <span className="font-mono text-sm font-medium">{ra.asset_id_snapshot}</span>
            <Badge variant="outline" className="text-[10px]">{formatStatus(ra.response_status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{ra.asset_name_snapshot}</p>
          {ra.asset_location_snapshot && (
            <p className="text-xs text-muted-foreground">Location: {ra.asset_location_snapshot}</p>
          )}
          {ra.response_notes && (
            <p className="text-xs italic text-muted-foreground mt-1">"{ra.response_notes}"</p>
          )}
        </div>
        <Badge variant="outline" className={`${adminDecisionClass(ra.admin_decision)} text-xs flex-shrink-0`}>
          {formatStatus(ra.admin_decision)}
        </Badge>
      </div>

      {/* Photos */}
      {ra.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {ra.photos.map((p) =>
            p.image_url ? (
              <a key={p.id} href={p.image_url} target="_blank" rel="noreferrer">
                <img src={p.image_url} alt="asset" className="h-14 w-14 object-cover rounded border" />
              </a>
            ) : null
          )}
        </div>
      )}

      {canDecide && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="correction_required">Correction Required</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request detail panel
// ---------------------------------------------------------------------------

function RequestDetail({
  requestId,
  onBack,
}: {
  requestId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'vendor-request', requestId],
    queryFn: () => fetchAdminVendorRequest(requestId),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admin', 'vendor-request', requestId] });
    qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
  }

  const sendMutation = useMutation({
    mutationFn: () => sendVendorRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-request', requestId] });
      toast({ title: 'Request sent to vendor', description: 'Vendor users have been notified by email.' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelVendorRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
      toast({ title: 'Request cancelled' });
      setCancelOpen(false);
      onBack();
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  async function handleRemoveAsset(assetId: string, assetPk: string) {
    setRemovingAssetId(assetPk);
    try {
      const result = await removeAssetFromDraftRequest(requestId, assetPk);
      if (result?.detail?.includes('cancelled')) {
        toast({ title: 'Asset removed', description: 'Request was empty and has been cancelled.' });
        qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
        onBack();
      } else {
        toast({ title: 'Asset removed', description: `${assetId} removed from draft.` });
        refresh();
      }
    } catch (err) {
      toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' });
    } finally {
      setRemovingAssetId(null);
    }
  }

  const approveMutation = useMutation({
    mutationFn: () => approveVendorRequest(requestId, reviewNotes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-request', requestId] });
      toast({ title: 'Request approved' });
      setApproveOpen(false);
      setReviewNotes('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const correctionMutation = useMutation({
    mutationFn: () => requestCorrectionVendorRequest(requestId, reviewNotes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-request', requestId] });
      toast({ title: 'Correction requested', description: 'Vendor users have been notified by email.' });
      setCorrectionOpen(false);
      setReviewNotes('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Not found.</div>;

  const r = data as VendorVerificationRequestDetail;
  const canSend = r.status === 'draft';
  const canReview = r.status === 'submitted';
  const hasCorrectionRequired = r.correction_count > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-mono">{r.reference_code}</h2>
          <p className="text-sm text-muted-foreground">{r.vendor_name} · {r.asset_count} asset(s)</p>
        </div>
        <Badge variant="outline" className={statusBadgeClass(r.status)}>
          {formatStatus(r.status)}
        </Badge>
      </div>

      {/* Draft action banner */}
      {canSend && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-800">Draft — not yet visible to the vendor</p>
              <p className="text-xs text-blue-600 mt-0.5">Review the asset list below, then send when ready.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setCancelOpen(true)}
                disabled={cancelMutation.isPending}
              >
                <Ban className="h-4 w-4 mr-2" />Cancel Draft
              </Button>
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || r.asset_count === 0}
              >
                {sendMutation.isPending ? 'Sending...' : <><Send className="h-4 w-4 mr-2" />Send to Vendor</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregate review summary (shown when review has happened or is in progress) */}
      {(r.approved_count > 0 || r.correction_count > 0 || r.pending_review_count < r.asset_count) && r.status !== 'draft' && r.status !== 'sent' && r.status !== 'in_progress' && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-4 text-sm">
              <span className="text-green-700 font-medium">Approved: {r.approved_count}</span>
              <span className="text-orange-700 font-medium">Correction Required: {r.correction_count}</span>
              <span className="text-muted-foreground">Pending Review: {r.pending_review_count}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review notes from previous cycle */}
      {r.review_notes && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Previous Review Notes</p>
            <p className="text-sm text-orange-800">{r.review_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {r.request_assets.map((ra) => (
            <div key={ra.id} className="relative">
              <AssetDecisionRow
                ra={ra}
                requestId={r.id}
                requestStatus={r.status}
                onUpdate={refresh}
              />
              {r.status === 'draft' && (
                <button
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  title="Remove from draft"
                  disabled={removingAssetId === ra.id}
                  onClick={() => handleRemoveAsset(ra.asset_id_snapshot, ra.id)}
                >
                  {removingAssetId === ra.id
                    ? <span className="text-xs">...</span>
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Review actions */}
      {canReview && (
        <div className="flex justify-end gap-2 items-center">
          {r.correction_count > 0 && (
            <span className="text-xs text-orange-700 mr-2">
              {r.correction_count} asset(s) need correction — approve disabled
            </span>
          )}
          <Button variant="outline" onClick={() => { setReviewNotes(''); setCorrectionOpen(true); }}>
            <X className="h-4 w-4 mr-2" />Request Correction
          </Button>
          <Button
            onClick={() => { setReviewNotes(''); setApproveOpen(true); }}
            disabled={r.correction_count > 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />Approve
          </Button>
        </div>
      )}

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All assets will be marked as approved. Asset statuses will be updated.</p>
          <div className="space-y-1">
            <Label className="text-sm">Review Notes (optional)</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2} placeholder="Any notes for the vendor..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction dialog */}
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Correction</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assets marked "Correction Required" above will be sent back to the vendor for re-verification.
            Approved assets will remain locked and will not need to be re-verified.
          </p>
          {!hasCorrectionRequired && (
            <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
              Mark at least one asset as "Correction Required" before submitting.
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-sm">Review Notes *</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} placeholder="Explain what needs to be corrected..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => correctionMutation.mutate()}
              disabled={correctionMutation.isPending || !reviewNotes.trim() || !hasCorrectionRequired}
            >
              {correctionMutation.isPending ? 'Sending...' : 'Send for Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel draft dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" />Cancel Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cancel draft request <span className="font-mono font-medium">{r.reference_code}</span>? All {r.asset_count} asset(s) will be released. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Draft</Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
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

export default function AdminVendorRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('draft');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin', 'vendor-requests', statusFilter],
    queryFn: () => fetchAdminVendorRequests({ status: statusFilter === 'all' ? undefined : statusFilter }),
    enabled: !selectedId,
  });

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
            <Send className="h-5 w-5" />
            Vendor Verification Requests
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (requests as VendorVerificationRequest[]).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
                ) : (requests as VendorVerificationRequest[]).map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(r.id)}>
                    <TableCell className="font-mono text-sm font-medium">{r.reference_code}</TableCell>
                    <TableCell className="text-sm">{r.vendor_name}</TableCell>
                    <TableCell>{r.asset_count}</TableCell>
                    <TableCell>
                      {r.pending_count > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                          {r.pending_count} pending
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {(r.approved_count > 0 || r.correction_count > 0) ? (
                        <div className="flex flex-col gap-0.5">
                          {r.approved_count > 0 && (
                            <span className="text-xs text-green-700">{r.approved_count} approved</span>
                          )}
                          {r.correction_count > 0 && (
                            <span className="text-xs text-orange-700">{r.correction_count} correction</span>
                          )}
                        </div>
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
                      {r.status === 'draft'
                        ? <FileEdit className="h-4 w-4 text-blue-500" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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
