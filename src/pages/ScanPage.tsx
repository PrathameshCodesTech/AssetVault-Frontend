import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, QrCode, Printer, ScanLine, AlertCircle, Loader2, Package } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { scanAsset, scanAssetByCode, fetchAssets, generateQr } from '@/services/assetService';
import { vendorGlobalScan } from '@/services/vendorService';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeScannedCode } from '@/lib/scanUtils';

export default function ScanPage() {
  const { user } = useAuth();
  const isVendorOnly =
    (user?.permissions?.includes('vendor.respond') ?? false) &&
    user?.role !== 'super_admin' &&
    user?.role !== 'location_admin' &&
    user?.role !== 'employee';

  const [tab, setTab] = useState('scan');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const [cameraError, setCameraError] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [generateId, setGenerateId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const safeStop = async () => {
    if (scanningRef.current && html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch { /* already stopped */ }
      scanningRef.current = false;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    setCameraError('');
    setScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('scanner-region', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
        ],
        verbose: false,
      });
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { handleScanResult(decodedText); safeStop(); },
        () => {},
      );
      scanningRef.current = true;
    } catch (err: any) {
      setCameraError(err?.message || 'Camera access denied.');
      setScanning(false);
      scanningRef.current = false;
    }
  };

  useEffect(() => { return () => { safeStop(); }; }, []);

  const handleVendorScanResult = async (raw: string) => {
    setSearchLoading(true);
    try {
      const { type, value } = normalizeScannedCode(raw);
      const result = await vendorGlobalScan(type === 'qr_uid' ? { qr_uid: value } : { asset_id: value });

      if (result.matched && result.in_package && result.request_id && result.request_asset_id) {
        toast({ title: 'Asset Found', description: `${result.asset_id} — ${result.asset_name}` });
        navigate(`/vendor/requests/${result.request_id}?asset=${result.request_asset_id}`);
        return;
      }

      if (result.matched && !result.in_package) {
        // Asset belongs to an approved/locked request
        toast({
          title: 'Request Locked',
          description: result.detail ?? 'This asset is in a locked request.',
          variant: 'destructive',
        });
        setSearchLoading(false);
        return;
      }

      toast({
        title: 'Asset Not Found',
        description: result.detail ?? `No active request found for: ${code}`,
        variant: 'destructive',
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const httpStatus = err?.response?.status;
      if (httpStatus === 404 || detail) {
        toast({
          title: 'Asset Not Found',
          description: detail ?? `No asset matched "${code}". Check the ID or QR code and try again.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Connection Error', description: 'Could not reach the server. Check your connection and try again.', variant: 'destructive' });
      }
    }
    setSearchLoading(false);
  };

  const handleScanResult = async (raw: string) => {
    if (isVendorOnly) { return handleVendorScanResult(raw); }

    setSearchLoading(true);
    const { type, value } = normalizeScannedCode(raw);
    try {
      // qr_uid → UUID endpoint; code (asset_id / barcode / tag_number) → generic lookup
      const asset = type === 'qr_uid' ? await scanAsset(value) : await scanAssetByCode(value);
      if (asset?.id) {
        toast({ title: 'Asset Found!', description: asset.name || asset.assetId });
        navigate(`/assets/${asset.id}`);
        setSearchLoading(false);
        return;
      }
    } catch { /* fall through to search */ }

    try {
      const resp = await fetchAssets({ search: code, page_size: 1 });
      if (resp.results?.length > 0) {
        const a = resp.results[0];
        toast({ title: 'Asset Found!', description: a.name || a.assetId });
        navigate(`/assets/${a.id}`);
        setSearchLoading(false);
        return;
      }
    } catch { /* ignore */ }

    toast({ title: 'Asset Not Found', description: `No asset found for: ${code}`, variant: 'destructive' });
    setSearchLoading(false);
  };

  const handleManualSearch = () => {
    if (manualCode.trim()) handleScanResult(manualCode.trim());
  };

  const [qrLoading, setQrLoading] = useState(false);
  const [qrAssetInfo, setQrAssetInfo] = useState<{ assetId: string; name: string; qrUid: string } | null>(null);

  const handleGenerateQr = async () => {
    if (!generateId.trim()) return;
    setQrLoading(true);
    try {
      const data = await generateQr(generateId.trim());
      const uid = data.qr_uid || data.qrUid || generateId.trim();
      setQrValue(uid);
      setQrAssetInfo({ assetId: data.asset_id || generateId.trim(), name: data.name || '', qrUid: uid });
      setQrDialogOpen(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Asset not found or QR generation failed.';
      toast({ title: 'QR Generation Failed', description: detail, variant: 'destructive' });
    }
    setQrLoading(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Scan & QR</h1>

      {isVendorOnly && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <Package className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Scan a QR code or barcode, or enter the asset ID / tag number. You can only scan assets included in your active packages.</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v); safeStop(); }}>
        <TabsList className={`w-full grid ${isVendorOnly ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="scan"><Camera className="mr-1 h-4 w-4" /> Scan</TabsTrigger>
          <TabsTrigger value="manual"><Keyboard className="mr-1 h-4 w-4" /> Manual</TabsTrigger>
          {!isVendorOnly && <TabsTrigger value="generate"><QrCode className="mr-1 h-4 w-4" /> Generate</TabsTrigger>}
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div id="scanner-region" ref={scannerRef} className="mx-auto aspect-square max-w-sm rounded-lg bg-muted overflow-hidden">
                {!scanning && !cameraError && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ScanLine className="h-16 w-16 mb-3 opacity-30" />
                    <p className="text-sm">Tap to start scanning</p>
                  </div>
                )}
              </div>
              {cameraError && (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /><span>{cameraError}</span>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {!scanning ? (
                  <Button onClick={startScanner} className="flex-1 h-14 text-base bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Camera className="mr-2 h-5 w-5" /> Start Scanning
                  </Button>
                ) : (
                  <Button onClick={() => safeStop()} variant="destructive" className="flex-1 h-14 text-base">Stop Scanner</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Enter Code Manually</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Enter the asset ID, tag number / barcode, or QR UID</p>
              <Input placeholder="e.g. FAR-2021-0001, C08466, or QR UID" value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()} className="h-12 text-base" />
              <Button onClick={handleManualSearch} disabled={searchLoading} className="w-full h-12">
                {searchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Search Asset
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {!isVendorOnly && (
          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Generate QR Code</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Enter an asset ID to generate its QR code</p>
                <Input placeholder="e.g. FAR-2021-0001" value={generateId} onChange={(e) => setGenerateId(e.target.value)} className="h-12" />
                <Button onClick={handleGenerateQr} disabled={qrLoading} className="w-full h-12">
                  {qrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />} Generate QR
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code{qrAssetInfo ? ` — ${qrAssetInfo.assetId}` : ''}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-card p-4 rounded-lg border"><QRCodeSVG value={qrValue} size={200} /></div>
            {qrAssetInfo && (
              <div className="text-center text-sm">
                <p className="font-medium">{qrAssetInfo.name}</p>
                <p className="text-muted-foreground font-mono text-xs mt-1">UID: {qrAssetInfo.qrUid}</p>
              </div>
            )}
            <Button className="w-full" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print QR Code</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
