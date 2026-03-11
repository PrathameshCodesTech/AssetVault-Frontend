import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { fetchAdminSubmissions, approveSubmission, rejectSubmission, requestCorrection, convertToAsset } from '@/services/submissionService';
import { fetchAdminVerificationRequests, fetchVerificationRequestDetail, AdminVerificationRequestDetail } from '@/services/verificationService';
import { fetchLookups } from '@/services/assetService';
import { mapBackendSubmission } from '@/services/mappers';
import { ThirdPartySubmission } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, AlertCircle, MapPin, Loader2, Package, Eye, User, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import LocationHierarchySelector from '@/components/LocationHierarchySelector';
import { LocationPath, LOCATION_LEVELS } from '@/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const tpStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-warning/10 text-warning border-warning/20', label: 'Pending' },
  approved: { color: 'bg-success/10 text-success border-success/20', label: 'Approved' },
  rejected: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Rejected' },
  correction_requested: { color: 'bg-accent/10 text-accent border-accent/20', label: 'Correction' },
};

const vrStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-muted text-muted-foreground border-muted', label: 'Pending' },
  opened: { color: 'bg-accent/10 text-accent border-accent/20', label: 'Opened' },
  otp_verified: { color: 'bg-accent/10 text-accent border-accent/20', label: 'OTP Verified' },
  submitted: { color: 'bg-success/10 text-success border-success/20', label: 'Submitted' },
  expired: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Expired' },
  cancelled: { color: 'bg-muted text-muted-foreground', label: 'Cancelled' },
};

const issueTypeLabel: Record<string, string> = {
  missing: 'Missing',
  damaged: 'Damaged',
  wrong_serial: 'Wrong Serial',
  not_in_possession: 'Not in Possession',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSubmissionsPage() {
  // Source tab: all | third_party | employee_verification
  const [sourceTab, setSourceTab] = useState('all');
  // Third-party status filter
  const [tpFilter, setTpFilter] = useState('pending');

  const [selectedSub, setSelectedSub] = useState<ThirdPartySubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'correction' | null>(null);

  const [convertSub, setConvertSub] = useState<ThirdPartySubmission | null>(null);
  const [convertForm, setConvertForm] = useState({ asset_id: '', name: '', category_id: '', serial_number: '', description: '' });
  const [convertLocationPath, setConvertLocationPath] = useState<LocationPath>({});

  // Employee verification detail
  const [selectedVrId, setSelectedVrId] = useState<string | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const tpParams: Record<string, any> = { page_size: 50 };
  if (tpFilter !== 'all') tpParams.status = tpFilter;

  const { data: tpRawData, isLoading: tpLoading } = useQuery({
    queryKey: ['adminSubmissions', tpParams],
    queryFn: () => fetchAdminSubmissions(tpParams),
    enabled: sourceTab === 'all' || sourceTab === 'third_party',
  });

  const { data: vrRawData, isLoading: vrLoading } = useQuery({
    queryKey: ['adminVerificationRequests', { status: 'submitted', page_size: 50 }],
    queryFn: () => fetchAdminVerificationRequests({ status: 'submitted', page_size: 50 }),
    enabled: sourceTab === 'all' || sourceTab === 'employee_verification',
  });

  const { data: lookups } = useQuery({
    queryKey: ['assetLookups'],
    queryFn: fetchLookups,
    staleTime: 5 * 60 * 1000,
  });

  const { data: vrDetail, isLoading: vrDetailLoading } = useQuery({
    queryKey: ['vrDetail', selectedVrId],
    queryFn: () => fetchVerificationRequestDetail(selectedVrId!),
    enabled: !!selectedVrId,
  });

  const categories: { id: string; name: string }[] = lookups?.categories ?? [];
  const submissions = (tpRawData?.results ?? []).map(mapBackendSubmission);
  const vrItems = vrRawData?.results ?? [];

  const isLoading = tpLoading || vrLoading;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!actionType || !selectedSub) throw new Error('Invalid state');
      const id = selectedSub.id;
      if (actionType === 'approve') await approveSubmission(id, reviewNotes);
      else if (actionType === 'reject') await rejectSubmission(id, reviewNotes);
      else if (actionType === 'correction') await requestCorrection(id, reviewNotes);
    },
    onSuccess: () => {
      const labels = { approve: 'Approved', reject: 'Rejected', correction: 'Correction Requested' };
      toast({ title: `Submission ${labels[actionType!]}`, description: `Submission has been ${labels[actionType!].toLowerCase()}.` });
      setSelectedSub(null);
      setActionType(null);
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Action Failed', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!convertSub) throw new Error('No submission');
      const reversed = [...LOCATION_LEVELS].reverse();
      let locationId = '';
      for (const lvl of reversed) {
        if (convertLocationPath[lvl]) { locationId = convertLocationPath[lvl]!; break; }
      }
      if (!locationId) throw new Error('Location is required');
      return convertToAsset(convertSub.id, {
        asset_id: convertForm.asset_id,
        name: convertForm.name,
        category_id: convertForm.category_id,
        location_id: locationId,
        serial_number: convertForm.serial_number || undefined,
        description: convertForm.description || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Asset Created', description: 'Submission has been converted to an official asset.' });
      setConvertSub(null);
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      let msg = err?.message || 'Failed to convert.';
      if (data) {
        if (data.detail) msg = data.detail;
        else {
          const k = Object.keys(data)[0];
          if (k) msg = `${k}: ${Array.isArray(data[k]) ? data[k][0] : data[k]}`;
        }
      }
      toast({ title: 'Conversion Failed', description: msg, variant: 'destructive' });
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAction = (type: 'approve' | 'reject' | 'correction', sub: ThirdPartySubmission) => {
    setSelectedSub(sub);
    setActionType(type);
    setReviewNotes('');
  };

  const handleConvert = (sub: ThirdPartySubmission) => {
    setConvertSub(sub);
    setConvertForm({ asset_id: '', name: sub.assetName || '', category_id: '', serial_number: sub.serialNumber || '', description: '' });
    setConvertLocationPath({});
  };

  // ---------------------------------------------------------------------------
  // Row renderers
  // ---------------------------------------------------------------------------

  const renderTpRow = (sub: ThirdPartySubmission) => {
    const cfg = tpStatusConfig[sub.status] ?? tpStatusConfig.pending;
    return (
      <TableRow key={sub.id}>
        <TableCell>
          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Third Party</Badge>
        </TableCell>
        <TableCell className="font-mono text-xs">{sub.id.slice(0, 8)}…</TableCell>
        <TableCell><Badge variant="secondary" className="text-xs">{sub.type === 'verification' ? 'Verify' : 'New Asset'}</Badge></TableCell>
        <TableCell className="text-sm">{sub.type === 'verification' ? sub.assetId : (sub.assetName || sub.tempRefId)}</TableCell>
        <TableCell className="text-sm">{sub.submittedByName}</TableCell>
        <TableCell className="text-xs max-w-[180px] truncate" title={sub.locationBreadcrumb}>{sub.locationBreadcrumb}</TableCell>
        <TableCell><Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge></TableCell>
        <TableCell>
          <div className="flex gap-1">
            {sub.status === 'pending' && (
              <>
                <Button size="sm" variant="ghost" className="h-7 text-success hover:text-success" onClick={() => handleAction('approve', sub)}><CheckCircle2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-accent hover:text-accent" onClick={() => handleAction('correction', sub)}><AlertCircle className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => handleAction('reject', sub)}><XCircle className="h-4 w-4" /></Button>
              </>
            )}
            {sub.status === 'approved' && sub.type === 'new_asset' && (
              <Button size="sm" variant="ghost" className="h-7 text-primary hover:text-primary" onClick={() => handleConvert(sub)}><Package className="h-4 w-4" /></Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderVrRow = (vr: typeof vrItems[0]) => {
    const cfg = vrStatusConfig[vr.status] ?? vrStatusConfig.submitted;
    return (
      <TableRow key={vr.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedVrId(vr.id)}>
        <TableCell>
          <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Employee</Badge>
        </TableCell>
        <TableCell className="font-mono text-xs">{vr.reference_code}</TableCell>
        <TableCell><Badge variant="secondary" className="text-xs">Verification</Badge></TableCell>
        <TableCell className="text-sm">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            {vr.employeeName}
          </div>
          <div className="text-xs text-muted-foreground">{vr.employeeEmail}</div>
        </TableCell>
        <TableCell className="text-sm">{vr.cycleName}</TableCell>
        <TableCell className="text-xs">
          <div>{vr.assetCount} assets</div>
          <div className="text-muted-foreground">{vr.verifiedCount}✓ {vr.issueCount > 0 ? `${vr.issueCount}⚠` : ''}</div>
        </TableCell>
        <TableCell><Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge></TableCell>
        <TableCell>
          <Button size="sm" variant="ghost" className="h-7"><Eye className="h-4 w-4" /></Button>
        </TableCell>
      </TableRow>
    );
  };

  const renderTpMobileCard = (sub: ThirdPartySubmission) => {
    const cfg = tpStatusConfig[sub.status] ?? tpStatusConfig.pending;
    return (
      <Card key={sub.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Third Party</Badge>
              </div>
              <p className="font-medium text-sm">{sub.type === 'verification' ? `Verify: ${sub.assetId}` : `New: ${sub.assetName || sub.tempRefId}`}</p>
              <p className="text-xs text-muted-foreground">by {sub.submittedByName} · {sub.submittedAt ? formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true }) : ''}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
          </div>
          <div className="text-xs flex items-start gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground leading-relaxed line-clamp-2">{sub.locationBreadcrumb}</span>
          </div>
          {sub.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleAction('approve', sub)}><CheckCircle2 className="mr-1 h-3 w-3" /> Approve</Button>
              <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => handleAction('correction', sub)}><AlertCircle className="mr-1 h-3 w-3" /> Correct</Button>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => handleAction('reject', sub)}><XCircle className="h-3 w-3" /></Button>
            </div>
          )}
          {sub.status === 'approved' && sub.type === 'new_asset' && (
            <Button size="sm" variant="outline" className="w-full h-8" onClick={() => handleConvert(sub)}><Package className="mr-1 h-3 w-3" /> Convert to Asset</Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderVrMobileCard = (vr: typeof vrItems[0]) => {
    const cfg = vrStatusConfig[vr.status] ?? vrStatusConfig.submitted;
    return (
      <Card key={vr.id} className="cursor-pointer" onClick={() => setSelectedVrId(vr.id)}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Employee</Badge>
              </div>
              <p className="font-medium text-sm">{vr.employeeName}</p>
              <p className="text-xs text-muted-foreground">{vr.employeeEmail}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">Ref: {vr.reference_code} · Cycle: {vr.cycleName}</div>
          <div className="text-xs">{vr.assetCount} assets · {vr.verifiedCount} verified · {vr.issueCount} issues</div>
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  const showTp = sourceTab === 'all' || sourceTab === 'third_party';
  const showVr = sourceTab === 'all' || sourceTab === 'employee_verification';
  const isEmpty = !isLoading && submissions.length === 0 && vrItems.length === 0;

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Review Inbox</h1>

      {/* Source tabs */}
      <Tabs value={sourceTab} onValueChange={setSourceTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="third_party" className="text-xs">Third Party</TabsTrigger>
          <TabsTrigger value="employee_verification" className="text-xs">Employee Verification</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Third-party status sub-filter (shown only when third-party is active) */}
      {(sourceTab === 'third_party') && (
        <Tabs value={tpFilter} onValueChange={setTpFilter}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : isMobile ? (
        <div className="space-y-3">
          {isEmpty && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No items.</CardContent></Card>}
          {showTp && submissions.map(renderTpMobileCard)}
          {showVr && vrItems.map(renderVrMobileCard)}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Source</TableHead>
                <TableHead>Ref / ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>From / Cycle</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isEmpty && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No items.</TableCell></TableRow>
              )}
              {showTp && submissions.map(renderTpRow)}
              {showVr && vrItems.map(renderVrRow)}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* TP Review Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedSub(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Submission'}
              {actionType === 'reject' && 'Reject Submission'}
              {actionType === 'correction' && 'Request Correction'}
            </DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <div className="space-y-3">
              <div className="text-sm space-y-1 bg-muted rounded-lg p-3">
                <p><span className="text-muted-foreground">Type:</span> {selectedSub.type}</p>
                <p><span className="text-muted-foreground">By:</span> {selectedSub.submittedByName}</p>
                {selectedSub.assetName && <p><span className="text-muted-foreground">Asset:</span> {selectedSub.assetName}</p>}
              </div>
              {(actionType === 'reject' || actionType === 'correction') && (
                <Textarea placeholder={actionType === 'correction' ? 'What needs to be corrected?' : 'Reason for rejection...'} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionType(null); setSelectedSub(null); }}>Cancel</Button>
            <Button
              onClick={() => actionMutation.mutate()}
              disabled={actionMutation.isPending}
              className={actionType === 'approve' ? 'bg-success hover:bg-success/90 text-success-foreground' : actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}
            >
              {actionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'correction' && 'Request Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Asset Dialog */}
      <Dialog open={!!convertSub} onOpenChange={() => setConvertSub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Convert to Official Asset</DialogTitle>
          </DialogHeader>
          {convertSub && (
            <div className="space-y-4">
              <div className="text-sm bg-muted rounded-lg p-3 space-y-1">
                <p><span className="text-muted-foreground">Submission:</span> {convertSub.assetName || convertSub.tempRefId}</p>
                <p><span className="text-muted-foreground">Submitted by:</span> {convertSub.submittedByName}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-sm">Asset ID *</Label>
                  <Input placeholder="e.g. FAR-2025-0001" value={convertForm.asset_id} onChange={(e) => setConvertForm((f) => ({ ...f, asset_id: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Name *</Label>
                  <Input value={convertForm.name} onChange={(e) => setConvertForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Category *</Label>
                  <Select value={convertForm.category_id} onValueChange={(v) => setConvertForm((f) => ({ ...f, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Serial Number</Label>
                  <Input value={convertForm.serial_number} onChange={(e) => setConvertForm((f) => ({ ...f, serial_number: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Location *</Label>
                <LocationHierarchySelector value={convertLocationPath} onChange={setConvertLocationPath} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Description</Label>
                <Textarea value={convertForm.description} onChange={(e) => setConvertForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertSub(null)}>Cancel</Button>
            <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending || !convertForm.asset_id || !convertForm.name || !convertForm.category_id}>
              {convertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Create Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Verification Detail Dialog */}
      <Dialog open={!!selectedVrId} onOpenChange={() => setSelectedVrId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Employee Verification</Badge>
              {vrDetail?.reference_code}
            </DialogTitle>
          </DialogHeader>

          {vrDetailLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : vrDetail ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-medium">{vrDetail.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{vrDetail.employeeEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cycle</p>
                  <p className="font-medium">{vrDetail.cycleName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`text-xs ${(vrStatusConfig[vrDetail.status] ?? vrStatusConfig.submitted).color}`}>
                    {(vrStatusConfig[vrDetail.status] ?? vrStatusConfig.submitted).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Results</p>
                  <p className="font-medium">{vrDetail.assetCount} assets · {vrDetail.verifiedCount} verified · {vrDetail.issueCount} issues</p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Timeline</p>
                {[
                  ['Sent', vrDetail.sent_at],
                  ['Opened', vrDetail.opened_at],
                  ['OTP Verified', vrDetail.otp_verified_at],
                  ['Submitted', vrDetail.submitted_at],
                ].filter(([, v]) => v).map(([label, ts]) => (
                  <div key={label as string} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-24 shrink-0">{label as string}</span>
                    <span>{formatDistanceToNow(new Date(ts as string), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>

              {/* Assets */}
              {vrDetail.request_assets && vrDetail.request_assets.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Assets ({vrDetail.request_assets.length})</p>
                  <div className="space-y-2">
                    {vrDetail.request_assets.map((ra) => (
                      <div key={ra.id} className="rounded-lg border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{ra.assetId} — {ra.name}</span>
                          {ra.response ? (
                            ra.response.response === 'verified'
                              ? <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Verified</Badge>
                              : <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">Issue Reported</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">No Response</Badge>
                          )}
                        </div>
                        {ra.response?.remarks && (
                          <p className="text-xs text-muted-foreground">Remarks: {ra.response.remarks}</p>
                        )}
                        {ra.response?.issue && (
                          <div className="flex items-start gap-1.5 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{issueTypeLabel[ra.response.issue.issue_type] ?? ra.response.issue.issue_type}: {ra.response.issue.description}</span>
                          </div>
                        )}
                        {ra.photos && ra.photos.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {ra.photos.map((p) => (
                              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title="View full photo">
                                <img
                                  src={p.url}
                                  alt="employee photo"
                                  className="h-12 w-12 rounded object-cover border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Declaration */}
              {vrDetail.declaration && (
                <div className="rounded-lg border p-3 text-sm space-y-1 bg-success/5">
                  <p className="text-xs font-medium text-muted-foreground">Declaration</p>
                  <p>{vrDetail.declaration.declared_by_name} ({vrDetail.declaration.declared_by_email})</p>
                  <p className="text-xs text-muted-foreground">Consented at: {new Date(vrDetail.declaration.consented_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVrId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
