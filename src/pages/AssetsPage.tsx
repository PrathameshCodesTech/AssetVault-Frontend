import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchAssets, fetchLookups } from '@/services/assetService';
import { mapBackendAsset } from '@/services/mappers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, ChevronLeft, ChevronRight, Mail, Send, Loader2, AlertCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ASSET_COLUMNS, Asset } from '@/types';
import ColumnSelector from '@/components/ColumnSelector';
import { Label } from '@/components/ui/label';
import { sendSelectedAssetsVerification, fetchVerificationCycles, VerificationCycle } from '@/services/verificationService';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  in_transit: 'bg-accent/10 text-accent border-accent/20',
  pending_verification: 'bg-warning/10 text-warning border-warning/20',
  missing: 'bg-destructive/10 text-destructive border-destructive/20',
  disposed: 'bg-muted text-muted-foreground',
};

const reconColors: Record<string, string> = {
  verified: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  discrepancy: 'bg-destructive/10 text-destructive border-destructive/20',
};

function getCellValue(asset: Asset, key: string): string {
  switch (key) {
    case 'entity': return asset.entity || '—';
    case 'assetId': return asset.assetId;
    case 'serialNumber': return asset.serialNumber;
    case 'category': return asset.category;
    case 'subAssetType': return asset.subAssetType || '—';
    case 'locationName': return asset.locationName;
    case 'subLocation': return asset.subLocation || '—';
    case 'status': return asset.status.replace(/_/g, ' ');
    case 'reconciliationStatus': return asset.reconciliationStatus;
    case 'assignedToName': return asset.assignedToName;
    case 'purchaseDate': return asset.purchaseDate;
    case 'purchaseValue': return asset.purchaseValue ? `₹${asset.purchaseValue.toLocaleString()}` : '—';
    case 'costCenter': return asset.assetDetails?.costCenter || '—';
    case 'supplier': return asset.assetDetails?.supplier || '—';
    case 'currency': return asset.assetDetails?.currency || '—';
    default: return '—';
  }
}

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ASSET_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
  );
  const [sendRequestOpen, setSendRequestOpen] = useState(false);

  const PAGE_SIZE = 20;
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'location_admin';

  const queryParams: Record<string, any> = { page, page_size: PAGE_SIZE };
  if (search) queryParams.search = search;
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (categoryFilter !== 'all') queryParams.category = categoryFilter;

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['assets', queryParams],
    queryFn: () => fetchAssets(queryParams),
    placeholderData: keepPreviousData,
  });

  const { data: lookups } = useQuery({
    queryKey: ['assetLookups'],
    queryFn: fetchLookups,
    staleTime: 5 * 60 * 1000,
  });

  const assets = (rawData?.results ?? []).map(mapBackendAsset);
  const totalCount = rawData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const categories: { code: string; name: string }[] = lookups?.categories ?? [];

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when page/search/filters change
  useEffect(() => { setSelectedIds(new Set()); }, [page, search, statusFilter, categoryFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  // Dialog state
  const [sendAssets, setSendAssets] = useState<Asset[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [cycles, setCycles] = useState<VerificationCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);

  // Derive employee info from selected assets for the dialog
  const dialogEmployeeInfo = useMemo(() => {
    if (sendAssets.length === 0) return null;
    const employeeIds = new Set(sendAssets.map((a) => a.assignedTo).filter(Boolean));
    if (employeeIds.size === 0) return { valid: false, reason: 'None of the selected assets have an assigned employee.' };
    if (employeeIds.size > 1) return { valid: false, reason: 'Selected assets belong to different employees. All assets in one request must belong to the same employee.' };
    const first = sendAssets.find((a) => a.assignedTo)!;
    return { valid: true, employeeId: first.assignedTo, employeeName: first.assignedToName };
  }, [sendAssets]);

  useEffect(() => {
    if (!sendRequestOpen) return;
    setCyclesLoading(true);
    fetchVerificationCycles()
      .then((data) => {
        setCycles(data);
        if (data.length === 1) setCycleId(data[0].id);
      })
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false));
  }, [sendRequestOpen]);

  const handleSendSingle = (asset: Asset) => {
    setSendAssets([asset]);
    setCycleId('');
    setCycles([]);
    setSendRequestOpen(true);
  };

  const handleSendSelected = () => {
    const selected = assets.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;
    setSendAssets(selected);
    setCycleId('');
    setCycles([]);
    setSendRequestOpen(true);
  };

  const confirmSendRequest = async () => {
    if (!dialogEmployeeInfo?.valid || sendAssets.length === 0) return;
    if (!cycleId) {
      toast({ title: 'Cycle Required', description: 'Please select a verification cycle.', variant: 'destructive' });
      return;
    }
    setSendLoading(true);
    try {
      await sendSelectedAssetsVerification({
        cycle_id: cycleId,
        employee_id: dialogEmployeeInfo.employeeId!,
        asset_ids: sendAssets.map((a) => a.id),
      });
      const assetLabel = sendAssets.length === 1
        ? `asset ${sendAssets[0].assetId}`
        : `${sendAssets.length} assets`;
      toast({
        title: 'Verification Request Sent',
        description: `Request initiated for ${dialogEmployeeInfo.employeeName} regarding ${assetLabel}.`,
      });
      setSendRequestOpen(false);
      setSendAssets([]);
      setSelectedIds(new Set());
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to create verification request.';
      toast({ title: 'Request Failed', description: detail, variant: 'destructive' });
    }
    setSendLoading(false);
  };

  const activeColumnDefs = ASSET_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Assets</h1>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <Button size="sm" variant="default" className="gap-1.5" onClick={handleSendSelected}>
              <Send className="h-3.5 w-3.5" /> Send Verification ({selectedIds.size})
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{totalCount.toLocaleString()} assets</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, ID, serial..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><Filter className="mr-1 h-3 w-3" /><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ColumnSelector visibleColumns={visibleColumns} onChange={setVisibleColumns} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : isMobile ? (
        <div className="space-y-2">
          {assets.map((asset) => (
            <Card key={asset.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/assets/${asset.id}`)}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {isAdmin && (
                    <Checkbox
                      checked={selectedIds.has(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.assetId} · {asset.serialNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{asset.entity || '—'} · {asset.locationName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status] ?? ''}`}>{asset.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${reconColors[asset.reconciliationStatus] ?? ''}`}>{asset.reconciliationStatus}</Badge>
                  </div>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="mt-2 w-full h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleSendSingle(asset); }}>
                    <Send className="mr-1 h-3 w-3" /> Send Verification
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={assets.length > 0 && selectedIds.size === assets.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  {activeColumnDefs.map((col) => <TableHead key={col.key} className="whitespace-nowrap text-xs">{col.label}</TableHead>)}
                  {isAdmin && <TableHead className="text-xs">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/assets/${asset.id}`)}>
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(asset.id)}
                          onCheckedChange={() => toggleSelect(asset.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    {activeColumnDefs.map((col) => (
                      <TableCell key={col.key} className="text-xs whitespace-nowrap">
                        {col.key === 'status' ? (
                          <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status] ?? ''}`}>{asset.status.replace(/_/g, ' ')}</Badge>
                        ) : col.key === 'reconciliationStatus' ? (
                          <Badge variant="outline" className={`text-[10px] ${reconColors[asset.reconciliationStatus] ?? ''}`}>{asset.reconciliationStatus}</Badge>
                        ) : getCellValue(asset, col.key)}
                      </TableCell>
                    ))}
                    {isAdmin && (
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-accent hover:text-accent" onClick={(e) => { e.stopPropagation(); handleSendSingle(asset); }}>
                          <Send className="h-3 w-3" /> Request
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog open={sendRequestOpen} onOpenChange={(open) => { setSendRequestOpen(open); if (!open) setSendAssets([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-accent" /> Send Verification Request</DialogTitle>
          </DialogHeader>
          {sendAssets.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm space-y-1.5 bg-muted rounded-lg p-3">
                {sendAssets.length === 1 ? (
                  <p><span className="text-muted-foreground">Asset:</span> {sendAssets[0].assetId} — {sendAssets[0].name}</p>
                ) : (
                  <p><span className="text-muted-foreground">Assets:</span> {sendAssets.length} selected</p>
                )}
                {dialogEmployeeInfo?.valid ? (
                  <p><span className="text-muted-foreground">Employee:</span> {dialogEmployeeInfo.employeeName}</p>
                ) : (
                  <p className="text-destructive text-xs">{dialogEmployeeInfo?.reason}</p>
                )}
                <p><span className="text-muted-foreground">Location:</span> {sendAssets[0].locationName}</p>
              </div>

              {sendAssets.length > 1 && (
                <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs space-y-1">
                  {sendAssets.map((a) => (
                    <div key={a.id} className="flex justify-between">
                      <span className="font-mono">{a.assetId}</span>
                      <span className="text-muted-foreground truncate ml-2">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Verification Cycle *</Label>
                {cyclesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading cycles...
                  </div>
                ) : cycles.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-destructive py-2">
                    <AlertCircle className="h-4 w-4" /> No active verification cycles available.
                  </div>
                ) : (
                  <Select value={cycleId} onValueChange={setCycleId}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select active cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {cycles.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-sm">
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This will send a verification email for the selected asset{sendAssets.length > 1 ? 's' : ''} only.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmSendRequest}
              disabled={sendLoading || !dialogEmployeeInfo?.valid || !cycleId || cycles.length === 0}
              className="gap-1.5"
            >
              {sendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Request{sendAssets.length > 1 ? ` (${sendAssets.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
