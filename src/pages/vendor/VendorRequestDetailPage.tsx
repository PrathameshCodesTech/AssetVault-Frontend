import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchVendorRequestDetail,
  updateVendorRequestAsset,
  uploadVendorAssetPhoto,
  submitVendorRequest,
  scanVendorRequestAsset,
  VendorRequestAsset,
  VendorVerificationRequestDetail,
} from '@/services/vendorService';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Camera, CheckCircle, AlertTriangle, Clock, Upload, Send, ScanLine, XCircle } from 'lucide-react';
import { normalizeScannedCode } from '@/lib/scanUtils';

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

function responseIcon(status: string) {
  switch (status) {
    case 'confirmed': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'issue_reported': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

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

function adminDecisionClass(d: string) {
  switch (d) {
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'correction_required': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// ---------------------------------------------------------------------------
// Per-asset response card
// ---------------------------------------------------------------------------

function AssetCard({
  ra,
  requestId,
  requestStatus,
  highlighted,
  onUpdate,
}: {
  ra: VendorRequestAsset;
  requestId: string;
  requestStatus: string;
  highlighted: boolean;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [responseStatus, setResponseStatus] = useState(ra.response_status);
  const [notes, setNotes] = useState(ra.response_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isEditable =
    requestStatus === 'in_progress' ||
    (requestStatus === 'correction_requested' && ra.admin_decision === 'correction_required');

  const isLocked = !isEditable;

  async function handleSave() {
    setSaving(true);
    try {
      await updateVendorRequestAsset(requestId, ra.id, {
        response_status: responseStatus,
        response_notes: notes || undefined,
      });
      toast({ title: 'Response saved' });
      onUpdate();
    } catch (err) {
      toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadVendorAssetPhoto(requestId, ra.id, file);
      toast({ title: 'Photo uploaded' });
      onUpdate();
    } catch (err) {
      toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={`border rounded-md p-4 space-y-3 transition-all ${highlighted ? 'ring-2 ring-primary border-primary' : ra.admin_decision === 'correction_required' ? 'border-orange-300 bg-orange-50/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {responseIcon(ra.response_status)}
            <span className="font-mono text-sm font-medium">{ra.asset_id_snapshot}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{ra.asset_name_snapshot}</p>
          {ra.asset_location_snapshot && (
            <p className="text-xs text-muted-foreground">Location: {ra.asset_location_snapshot}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {ra.admin_decision !== 'pending_review' && (
            <Badge variant="outline" className={`${adminDecisionClass(ra.admin_decision)} text-xs`}>
              Admin: {ra.admin_decision.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      </div>

      {/* Photos */}
      {ra.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {ra.photos.map((p) => (
            p.image_url ? (
              <a key={p.id} href={p.image_url} target="_blank" rel="noreferrer">
                <img src={p.image_url} alt="asset" className="h-16 w-16 object-cover rounded border" />
              </a>
            ) : null
          ))}
        </div>
      )}

      {/* Response controls */}
      {isEditable && (
        <div className="space-y-2 pt-1 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Response</Label>
            <Select value={responseStatus} onValueChange={(v) => setResponseStatus(v as typeof responseStatus)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed Present</SelectItem>
                <SelectItem value="issue_reported">Issue Reported</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)..."
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Upload className="h-3 w-3 mr-1 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
              Photo
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>
      )}

      {isLocked && ra.response_notes && (
        <p className="text-xs text-muted-foreground italic border-t pt-2">"{ra.response_notes}"</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VendorRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  // QR / Asset-ID scan
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    in_package: boolean;
    request_asset_id?: string;
    asset_name?: string;
    asset_id?: string;
    detail?: string;
  } | null>(null);
  const assetCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    const query = scanInput.trim();
    if (!query || !id) return;
    setScanning(true);
    setScanResult(null);
    try {
      const { type, value } = normalizeScannedCode(query);
      const result = await scanVendorRequestAsset(id, type === 'qr_uid' ? { qr_uid: value } : { asset_id: value });
      setScanResult(result);
      if (result.in_package && result.request_asset_id) {
        setHighlightedAssetId(result.request_asset_id);
        const el = assetCardRefs.current[result.request_asset_id];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedAssetId(null), 3000);
      }
    } catch {
      setScanResult({ in_package: false, detail: 'Failed to reach scan endpoint.' });
    } finally {
      setScanning(false);
    }
  }, [scanInput, id]);

  const { data: req, isLoading } = useQuery({
    queryKey: ['vendor', 'request', id],
    queryFn: () => fetchVendorRequestDetail(id!),
    enabled: !!id,
  });

  // Auto-scroll to asset highlighted via ?asset= query param (from /scan deep-link)
  const deepLinkAssetId = searchParams.get('asset');
  useEffect(() => {
    if (!deepLinkAssetId || !req) return;
    setHighlightedAssetId(deepLinkAssetId);
    // Give the DOM a tick to render the cards before scrolling
    const t = setTimeout(() => {
      const el = assetCardRefs.current[deepLinkAssetId];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedAssetId(null), 3000);
    }, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkAssetId, req?.id]);

  const submitMutation = useMutation({
    mutationFn: () => submitVendorRequest(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'request', id] });
      qc.invalidateQueries({ queryKey: ['vendor', 'requests'] });
      toast({ title: 'Request submitted successfully' });
      setSubmitConfirmOpen(false);
    },
    onError: (err) => {
      toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' });
      setSubmitConfirmOpen(false);
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['vendor', 'request', id] });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }
  if (!req) {
    return <div className="p-6 text-muted-foreground">Request not found.</div>;
  }

  const r = req as VendorVerificationRequestDetail;
  const canSubmit = r.status === 'in_progress' || r.status === 'correction_requested';

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/vendor/requests')}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold font-mono">{r.reference_code}</h1>
          <p className="text-sm text-muted-foreground">{r.asset_count} asset(s)</p>
        </div>
        <Badge variant="outline" className={statusBadgeClass(r.status)}>
          {r.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </Badge>
      </div>

      {/* Correction banner */}
      {r.status === 'correction_requested' && r.review_notes && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium text-orange-800">Correction Required</p>
            <p className="text-sm text-orange-700 mt-1">{r.review_notes}</p>
            <p className="text-xs text-orange-600 mt-1">Only assets marked for correction can be updated. Approved assets are locked.</p>
          </CardContent>
        </Card>
      )}

      {/* Admin notes */}
      {r.notes && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes from Admin</p>
            <p className="text-sm">{r.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* QR / Asset-ID scan — only while vendor is actively working */}
      {canSubmit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" />Scan Asset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Asset ID, tag number, or QR code..."
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="text-sm h-9"
              />
              <Button size="sm" onClick={handleScan} disabled={scanning || !scanInput.trim()} className="h-9">
                {scanning ? 'Scanning...' : 'Find'}
              </Button>
            </div>
            {scanResult && (
              scanResult.in_package ? (
                <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span><span className="font-medium">{scanResult.asset_id}</span> — {scanResult.asset_name} is in this package.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{scanResult.detail ?? 'This asset is not part of your current verification package.'}</span>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets ({r.asset_count})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {r.request_assets.map((ra) => (
            <div key={ra.id} ref={(el) => { assetCardRefs.current[ra.id] = el; }}>
              <AssetCard
                ra={ra}
                requestId={r.id}
                requestStatus={r.status}
                highlighted={highlightedAssetId === ra.id}
                onUpdate={refresh}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Submit button */}
      {canSubmit && (
        <div className="flex justify-end">
          <Button onClick={() => setSubmitConfirmOpen(true)}>
            <Send className="h-4 w-4 mr-2" />Submit for Review
          </Button>
        </div>
      )}

      {/* Submit confirm dialog */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to submit this verification request for admin review?
            {r.status === 'in_progress' && ' Make sure all assets have been responded to.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
