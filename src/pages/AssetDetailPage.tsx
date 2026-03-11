import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchAsset, fetchAssetHistory } from '@/services/assetService';
import { quickSendVerification } from '@/services/verificationService';
import { mapBackendAsset, mapBackendHistory } from '@/services/mappers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, User, Calendar, DollarSign, QrCode, Clock, Package, Loader2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  in_transit: 'bg-accent/10 text-accent border-accent/20',
  pending_verification: 'bg-warning/10 text-warning border-warning/20',
  missing: 'bg-destructive/10 text-destructive border-destructive/20',
  disposed: 'bg-muted text-muted-foreground',
};

const actionIcons: Record<string, string> = {
  verified: '✅', moved: '🔄', registered: '📦', updated: '✏️', reassigned: '👤', disposed: '🗑️', assigned: '👤', created: '📦',
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vrSent, setVrSent] = useState(false);

  const sendVerificationMutation = useMutation({
    mutationFn: () => quickSendVerification(id!),
    onSuccess: (data) => {
      setVrSent(true);
      toast({ title: 'Verification Request Sent', description: `Reference: ${data.reference_code}` });
    },
    onError: (err: any) => {
      toast({
        title: 'Send Failed',
        description: err?.response?.data?.detail || 'Could not send verification request.',
        variant: 'destructive',
      });
    },
  });

  const { data: rawAsset, isLoading: assetLoading, error: assetError } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchAsset(id!),
    enabled: !!id,
  });

  const { data: rawHistory } = useQuery({
    queryKey: ['assetHistory', id],
    queryFn: () => fetchAssetHistory(id!),
    enabled: !!id,
  });

  if (assetLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (assetError || !rawAsset) {
    return (
      <div className="p-4 md:p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <p className="text-destructive">Asset not found.</p>
      </div>
    );
  }

  const asset = mapBackendAsset(rawAsset);
  const history = (rawHistory ?? []).map(mapBackendHistory);

  const details = [
    { label: 'Asset ID', value: asset.assetId, icon: Package },
    { label: 'Serial Number', value: asset.serialNumber },
    { label: 'Category', value: asset.category },
    { label: 'Sub Type', value: asset.subAssetType || '—' },
    { label: 'Entity', value: asset.entity || '—' },
    { label: 'Location', value: asset.locationName, icon: MapPin },
    { label: 'Sub-location', value: asset.subLocation || '—' },
    { label: 'Assigned To', value: asset.assignedToName || 'Unassigned', icon: User },
    { label: 'Purchase Date', value: asset.purchaseDate, icon: Calendar },
    { label: 'Purchase Value', value: asset.purchaseValue ? `₹${asset.purchaseValue.toLocaleString()}` : '—', icon: DollarSign },
  ];

  const financialDetails = asset.assetDetails;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back to Assets</Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusColors[asset.status] ?? ''}>{asset.status.replace(/_/g, ' ')}</Badge>
          <Badge variant="outline" className="text-xs"><QrCode className="mr-1 h-3 w-3" />{asset.qrCode || 'No QR'}</Badge>
          {asset.assignedTo && (
            <Button
              size="sm"
              variant="outline"
              disabled={sendVerificationMutation.isPending || vrSent}
              onClick={() => sendVerificationMutation.mutate()}
            >
              {sendVerificationMutation.isPending
                ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                : <Send className="mr-2 h-3 w-3" />}
              {vrSent ? 'Verification Sent' : 'Send Verification'}
            </Button>
          )}
        </div>
      </div>

      {asset.locationBreadcrumb && (
        <div className="rounded-lg bg-muted p-3 text-sm flex items-start gap-2">
          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <p className="font-medium">{asset.locationBreadcrumb}</p>
        </div>
      )}

      {(asset.qrUid || (asset.images && asset.images.length > 0)) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {asset.qrUid && (
            <Card className="flex-shrink-0">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" /> QR Code</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                <QRCodeSVG value={asset.qrUid} size={140} />
                <p className="text-xs text-muted-foreground font-mono">{asset.qrUid}</p>
              </CardContent>
            </Card>
          )}
          {asset.images && asset.images.length > 0 && (
            <Card className="flex-1">
              <CardHeader className="pb-2"><CardTitle className="text-base">Asset Images</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {asset.images.map((img) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.url}
                        alt="Asset"
                        className="h-32 w-32 object-cover rounded-lg border"
                      />
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Asset Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {details.map((d) => (
              <div key={d.label}>
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-medium">{d.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {financialDetails && (
        <Card>
          <CardHeader><CardTitle className="text-base">Financial Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {Object.entries(financialDetails).filter(([, val]) => typeof val !== 'object' || val === null).map(([key, val]) => (
                <div key={key}>
                  <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="font-medium">{val != null ? String(val) : '—'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && <p className="text-sm text-muted-foreground">No history available.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 text-sm">
              <span className="text-lg mt-0.5">{actionIcons[h.action] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{h.description}</p>
                <p className="text-xs text-muted-foreground">
                  {h.performedByName} · {h.timestamp ? formatDistanceToNow(new Date(h.timestamp), { addSuffix: true }) : ''}
                  {h.fromLocation && h.toLocation && ` · ${h.fromLocation} → ${h.toLocation}`}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
