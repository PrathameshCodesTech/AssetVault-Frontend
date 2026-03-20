import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchAssets, fetchLookups, fetchUsers, assignAsset, UserOption } from '@/services/assetService';
import { mapBackendAsset } from '@/services/mappers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, AlertTriangle, User, X, UserPlus, Truck } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ASSET_COLUMNS, Asset } from '@/types';
import ColumnSelector from '@/components/ColumnSelector';
import { Label } from '@/components/ui/label';
import { sendSelectedAssetsVerification, fetchVerificationCycles, VerificationCycle } from '@/services/verificationService';
import { fetchVendors, createVendorRequest, VendorOrganization } from '@/services/vendorService';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  in_transit: 'bg-accent/10 text-accent border-accent/20',
  pending_verification: 'bg-warning/10 text-warning border-warning/20',
  missing: 'bg-destructive/10 text-destructive border-destructive/20',
  disposed: 'bg-muted text-muted-foreground',
};

const vendorReservationColors: Record<string, string> = {
  draft: 'bg-amber-50/60',
  sent: 'bg-green-50/70',
  in_progress: 'bg-sky-50/70',
  submitted: 'bg-indigo-50/70',
  correction_requested: 'bg-orange-50/70',
};

const vendorRequestStatusBadgeColors: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-300',
  sent: 'bg-green-100 text-green-800 border-green-300',
  in_progress: 'bg-sky-100 text-sky-800 border-sky-300',
  submitted: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  correction_requested: 'bg-orange-100 text-orange-800 border-orange-300',
};

const reconColors: Record<string, string> = {
  verified: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  discrepancy: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Workflow status badge colors — keyed by workflowStatus value
const workflowColors: Record<string, string> = {
  available:             'bg-gray-100 text-gray-500 border-gray-200',
  sent:                  'bg-blue-100 text-blue-800 border-blue-300',
  opened:                'bg-sky-100 text-sky-800 border-sky-300',
  in_progress:           'bg-sky-100 text-sky-800 border-sky-300',
  under_review:          'bg-indigo-100 text-indigo-800 border-indigo-300',
  draft:                 'bg-amber-100 text-amber-800 border-amber-300',
  correction_requested:  'bg-orange-100 text-orange-800 border-orange-300',
  approved:              'bg-green-100 text-green-800 border-green-300',
};

function WorkflowCell({ asset }: { asset: Asset }) {
  const status = asset.workflowStatus ?? 'available';
  const display = asset.workflowDisplay ?? 'Available';
  const ref = asset.workflowReference;
  const type = asset.workflowType;
  const colorClass = workflowColors[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const icon = type === 'employee'
    ? <User className="h-2.5 w-2.5 flex-shrink-0" />
    : type === 'vendor'
    ? <Truck className="h-2.5 w-2.5 flex-shrink-0" />
    : null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <Badge variant="outline" className={`text-[10px] gap-1 w-fit ${colorClass}`}>
        {icon}{display}
      </Badge>
      {ref && <span className="text-[10px] font-mono text-muted-foreground truncate">{ref}</span>}
    </div>
  );
}

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
    case 'assignedToName': return asset.assignedToName || '';
    case 'purchaseDate': return asset.purchaseDate;
    case 'purchaseValue': return asset.purchaseValue ? `₹${asset.purchaseValue.toLocaleString()}` : '—';
    case 'costCenter': return asset.assetDetails?.costCenter || '—';
    case 'supplier': return asset.assetDetails?.supplier || '—';
    case 'currency': return asset.assetDetails?.currency || '—';
    default: return '—';
  }
}

export default function AssetsPage() {
  // ── URL-persisted filters (survive navigation) ─────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const statusFilter = searchParams.get('status') ?? 'all';
  const categoryFilter = searchParams.get('category') ?? 'all';
  const isMappedFilter = (searchParams.get('mapped') ?? 'all') as 'all' | 'mapped' | 'unmapped';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  /** Patch one or more URL params; resets page to 1 unless `page` is in the patch. */
  function setParam(patch: Record<string, string | null | undefined>, keepPage = false) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === 'all' || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!keepPage && !('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
  }

  function setPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete('page'); else next.set('page', String(p));
      return next;
    }, { replace: true });
  }

  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ASSET_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
  );
  const [sendRequestOpen, setSendRequestOpen] = useState(false);

  const PAGE_SIZE = 20;
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'location_admin';

  // ── Employee filter for verification workflow ──────────────────────────
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<UserOption[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Reconstruct selectedEmployee from URL so it survives navigation
  const selectedEmployee: UserOption | null = (() => {
    const id = searchParams.get('emp_id');
    const name = searchParams.get('emp_name');
    const email = searchParams.get('emp_email') ?? '';
    return id && name ? { id, name, email } : null;
  })();

  const debouncedEmployeeSearch = useCallback(() => {
    if (employeeSearch.length < 2) { setEmployeeOptions([]); return; }
    setEmployeeLoading(true);
    fetchUsers(employeeSearch)
      .then((users) => setEmployeeOptions(users))
      .catch(() => setEmployeeOptions([]))
      .finally(() => setEmployeeLoading(false));
  }, [employeeSearch]);

  useEffect(() => {
    const timer = setTimeout(debouncedEmployeeSearch, 300);
    return () => clearTimeout(timer);
  }, [debouncedEmployeeSearch]);

  const selectEmployee = (emp: UserOption) => {
    setParam({ mapped: 'mapped', emp_id: emp.id, emp_name: emp.name, emp_email: emp.email });
    setEmployeeSearch('');
    setShowEmployeeDropdown(false);
    setSelectedIds(new Set());
  };

  const clearEmployee = () => {
    setParam({ emp_id: null, emp_name: null, emp_email: null });
    setEmployeeSearch('');
    setSelectedIds(new Set());
  };

  // ── Vendor state (needed before query params) ─────────────────────────
  const [selectedVendor, setSelectedVendor] = useState<VendorOrganization | null>(null);
  const [vendorSubview, setVendorSubview] = useState<'available' | 'reserved'>('available');

  // ── Query params ──────────────────────────────────────────────────────
  const queryParams: Record<string, any> = { page, page_size: PAGE_SIZE };
  if (search) queryParams.search = search;
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (categoryFilter !== 'all') queryParams.category = categoryFilter;
  if (isMappedFilter !== 'all') queryParams.is_mapped = isMappedFilter === 'mapped' ? 'true' : 'false';
  if (selectedEmployee) queryParams.assigned_to = selectedEmployee.id;
  // Vendor subview filters (only when in unmapped mode with a vendor selected)
  if (isMappedFilter === 'unmapped' && selectedVendor) {
    if (vendorSubview === 'available') {
      queryParams.vendor_linked = 'false';
    } else {
      // reserved: show assets in this vendor's active requests
      queryParams.vendor_id = selectedVendor.id;
      // Remove is_mapped when showing reserved (reserved assets are unmapped but query is by vendor_id)
      delete queryParams.is_mapped;
    }
  }

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

  // ── Multi-select ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setSelectedIds(new Set()); }, [page, search, statusFilter, categoryFilter, isMappedFilter]);

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
      // Only select assets that belong to the selected employee (have assignedTo)
      const selectable = assets.filter((a) => a.assignedTo);
      setSelectedIds(new Set(selectable.map((a) => a.id)));
    }
  };

  // ── Send verification dialog ─────────────────────────────────────────
  const [sendAssets, setSendAssets] = useState<Asset[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendAllLoading, setSendAllLoading] = useState(false);
  const [cycles, setCycles] = useState<VerificationCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [forceResendConflict, setForceResendConflict] = useState<{ assetId: string; cycleCode: string } | null>(null);

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
      .then((data) => { setCycles(data); if (data.length === 1) setCycleId(data[0].id); })
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false));
  }, [sendRequestOpen]);

  const handleSendSingle = (asset: Asset) => {
    if (!asset.assignedTo) {
      toast({ title: 'No employee assigned', description: 'Map an employee to this asset before sending verification.', variant: 'destructive' });
      return;
    }
    setSendAssets([asset]);
    setCycleId('');
    setCycles([]);
    setSendRequestOpen(true);
  };

  const handleSendSelected = () => {
    const selected = assets.filter((a) => selectedIds.has(a.id) && a.assignedTo);
    if (selected.length === 0) {
      toast({ title: 'No mapped assets selected', description: 'Only assets with an assigned employee can be sent for verification.', variant: 'destructive' });
      return;
    }
    setSendAssets(selected);
    setCycleId('');
    setCycles([]);
    setSendRequestOpen(true);
  };

  const handleSendAllFiltered = async () => {
    if (!selectedEmployee) return;
    setSendAllLoading(true);
    try {
      const baseParams: Record<string, any> = { page_size: 200 };
      if (search) baseParams.search = search;
      if (statusFilter !== 'all') baseParams.status = statusFilter;
      if (categoryFilter !== 'all') baseParams.category = categoryFilter;
      if (isMappedFilter !== 'all') baseParams.is_mapped = isMappedFilter === 'mapped' ? 'true' : 'false';
      baseParams.assigned_to = selectedEmployee.id;

      // Fetch all pages so the count is exact — no silent cap
      const collected: Asset[] = [];
      let pageNum = 1;
      while (true) {
        const data = await fetchAssets({ ...baseParams, page: pageNum });
        const batch = (data.results ?? []).map(mapBackendAsset).filter((a: Asset) => a.assignedTo);
        collected.push(...batch);
        if (!data.next) break;
        pageNum++;
      }

      if (collected.length === 0) {
        toast({ title: 'No assets', description: 'No mapped assets match the current filter.', variant: 'destructive' });
        return;
      }
      setSendAssets(collected);
      setCycleId('');
      setCycles([]);
      setSendRequestOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Could not fetch assets.', variant: 'destructive' });
    } finally {
      setSendAllLoading(false);
    }
  };

  const confirmSendRequest = async (forceResend = false) => {
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
        ...(forceResend ? { force_resend: true } : {}),
      });
      const assetLabel = sendAssets.length === 1 ? `asset ${sendAssets[0].assetId}` : `${sendAssets.length} assets`;
      toast({ title: 'Verification Request Sent', description: `Request initiated for ${dialogEmployeeInfo.employeeName} regarding ${assetLabel}.` });
      setSendRequestOpen(false);
      setSendAssets([]);
      setSelectedIds(new Set());
      setForceResendConflict(null);
    } catch (err: any) {
      const responseData = err?.response?.data;
      const conflictType = responseData?.conflict_type;

      if (conflictType === 'already_verified') {
        setForceResendConflict({
          assetId: responseData.asset_id,
          cycleCode: responseData.cycle_code,
        });
      } else if (conflictType === 'active_vendor_request') {
        toast({
          title: 'Asset in Active Vendor Request',
          description: `Asset is part of vendor request ${responseData.request_reference}. Close that request before sending for employee verification.`,
          variant: 'destructive',
        });
      } else if (conflictType === 'asset_in_active_request') {
        toast({
          title: 'Asset Already in Active Request',
          description: responseData?.detail || 'One or more assets are already part of another active verification request.',
          variant: 'destructive',
        });
      } else {
        const detail = responseData?.detail || 'Failed to create verification request.';
        toast({ title: 'Request Failed', description: detail, variant: 'destructive' });
      }
    }
    setSendLoading(false);
  };

  // ── Vendor send panel ────────────────────────────────────────────────
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSendLoading, setVendorSendLoading] = useState(false);
  const [vendorSendAllLoading, setVendorSendAllLoading] = useState(false);
  const [vendorSendOpen, setVendorSendOpen] = useState(false);
  const [vendorSendAssets, setVendorSendAssets] = useState<Asset[]>([]);

  const showVendorPanel = isAdmin && isMappedFilter === 'unmapped';
  const canSendVendor = isAdmin && isMappedFilter === 'unmapped';
  const selectableUnmappedOnPage = assets.filter((a) => !a.assignedTo && !a.vendorRequestStatus);

  const { data: vendorsList = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => fetchVendors(),
    enabled: showVendorPanel,
    staleTime: 60_000,
  });

  const filteredVendors = useMemo(() => {
    const active = (vendorsList as VendorOrganization[]).filter((v) => v.is_active);
    if (!vendorSearch.trim()) return active;
    const q = vendorSearch.toLowerCase();
    return active.filter((v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q));
  }, [vendorsList, vendorSearch]);

  function toggleSelectAllUnmapped() {
    if (selectedIds.size === selectableUnmappedOnPage.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUnmappedOnPage.map((a) => a.id)));
    }
  }

  const switchVendorSubview = (subview: 'available' | 'reserved') => {
    setVendorSubview(subview);
    setSelectedIds(new Set());
    setPage(1); // uses our local setPage which patches URL
  };

  function handleVendorSendSelected() {
    if (!selectedVendor) {
      toast({ title: 'Select a vendor first', description: 'Choose a vendor in the panel above before creating a request.', variant: 'destructive' });
      return;
    }
    const selected = assets.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) {
      toast({ title: 'No assets selected', variant: 'destructive' });
      return;
    }
    setVendorSendAssets(selected);
    setVendorSendOpen(true);
  }

  function handleVendorSendSingle(asset: Asset) {
    if (!selectedVendor) {
      toast({ title: 'Select a vendor first', description: 'Choose a vendor in the panel above before creating a request.', variant: 'destructive' });
      return;
    }
    setVendorSendAssets([asset]);
    setVendorSendOpen(true);
  }

  async function handleVendorSendAllFiltered() {
    if (!selectedVendor || vendorSubview !== 'available') return;
    setVendorSendAllLoading(true);
    try {
      const baseParams: Record<string, any> = { page_size: 200, is_mapped: 'false', vendor_linked: 'false' };
      if (search) baseParams.search = search;
      if (statusFilter !== 'all') baseParams.status = statusFilter;
      if (categoryFilter !== 'all') baseParams.category = categoryFilter;

      const collected: Asset[] = [];
      let pageNum = 1;
      while (true) {
        const data = await fetchAssets({ ...baseParams, page: pageNum });
        const batch = (data.results ?? []).map(mapBackendAsset).filter((a: Asset) => !a.assignedTo && !a.vendorRequestStatus);
        collected.push(...batch);
        if (!data.next) break;
        pageNum++;
      }
      if (collected.length === 0) {
        toast({ title: 'No unmapped assets', description: 'No unmapped assets match the current filter.', variant: 'destructive' });
        return;
      }
      setVendorSendAssets(collected);
      setVendorSendOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Could not fetch assets.', variant: 'destructive' });
    } finally {
      setVendorSendAllLoading(false);
    }
  }

  async function confirmVendorSend() {
    if (!selectedVendor || vendorSendAssets.length === 0) return;
    setVendorSendLoading(true);
    try {
      await createVendorRequest({
        vendor_id: selectedVendor.id,
        asset_ids: vendorSendAssets.map((a) => a.id),
      });
      toast({ title: 'Vendor request created', description: `${vendorSendAssets.length} asset(s) packaged for ${selectedVendor.name}.` });
      setVendorSendOpen(false);
      setVendorSendAssets([]);
      setSelectedIds(new Set());
      // Keep selectedVendor — admin likely wants to create more requests for same vendor
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.detail || 'Failed to create vendor request.', variant: 'destructive' });
    }
    setVendorSendLoading(false);
  }

  // ── Map / Re-map employee dialog ─────────────────────────────────────
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapTargetAsset, setMapTargetAsset] = useState<Asset | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapOptions, setMapOptions] = useState<UserOption[]>([]);
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapPendingEmp, setMapPendingEmp] = useState<UserOption | null>(null);
  const [mapConflict, setMapConflict] = useState<{
    conflictType: string;
    requestReference: string;
    employeeName: string;
    employeeEmail: string;
  } | null>(null);

  useEffect(() => {
    if (mapSearch.length < 2) { setMapOptions([]); return; }
    const timer = setTimeout(() => {
      setMapSearchLoading(true);
      fetchUsers(mapSearch)
        .then((users) => setMapOptions(users))
        .catch(() => setMapOptions([]))
        .finally(() => setMapSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [mapSearch]);

  const openMapDialog = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    setMapTargetAsset(asset);
    setMapSearch('');
    setMapOptions([]);
    setMapDialogOpen(true);
  };

  const confirmMapEmployee = async (emp: UserOption, forceReassign = false) => {
    if (!mapTargetAsset) return;
    setMapLoading(true);
    try {
      await assignAsset(mapTargetAsset.id, { user_id: emp.id, ...(forceReassign ? { force_reassign: true } : {}) });
      toast({ title: 'Employee mapped', description: `${mapTargetAsset.assetId} assigned to ${emp.name}.` });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setMapDialogOpen(false);
      setMapConflict(null);
      setMapPendingEmp(null);
    } catch (err: any) {
      const responseData = err?.response?.data;
      const conflictType = responseData?.conflict_type;
      if (conflictType === 'active_vendor_request') {
        toast({
          title: 'Asset in Active Vendor Request',
          description: `Asset is part of vendor request ${responseData.request_reference}. Close that request before reassigning.`,
          variant: 'destructive',
        });
      } else if (conflictType === 'active_employee_request') {
        setMapPendingEmp(emp);
        setMapConflict({
          conflictType,
          requestReference: responseData.request_reference,
          employeeName: responseData.employee_name,
          employeeEmail: responseData.employee_email,
        });
      } else {
        toast({ title: 'Error', description: responseData?.detail || 'Failed to assign.', variant: 'destructive' });
      }
    }
    setMapLoading(false);
  };

  const activeColumnDefs = ASSET_COLUMNS.filter((c) => visibleColumns.includes(c.key));
  const displayColumnDefs = activeColumnDefs.map((col) =>
    col.key === 'assignedToName' && isMappedFilter === 'unmapped'
      ? { ...col, label: 'Vendor' }
      : col
  );
  const canSendVerification = isAdmin && !!selectedEmployee;
  const selectableOnPage = assets.filter((a) => a.assignedTo);
  const showCheckboxes = canSendVerification || canSendVendor;
  const showEmployeeMapActions = isAdmin && isMappedFilter !== 'unmapped';

  const renderMappedDisplay = (asset: Asset) => {
    if (asset.assignedToName) {
      return <span>{asset.assignedToName}</span>;
    }
    if (asset.vendorName) {
      return <span>{asset.vendorName}</span>;
    }
    return (
      <span className="text-muted-foreground italic">
        {isMappedFilter === 'unmapped' ? 'Available' : 'Unassigned'}
      </span>
    );
  };

  const renderVendorStatusBadge = (status?: Asset['vendorRequestStatus']) => {
    if (!status) return null;
    return (
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1.5 text-[10px] ${vendorRequestStatusBadgeColors[status] ?? ''}`}
      >
        <Truck className="h-3 w-3" />
        <span>{status.replace(/_/g, ' ')}</span>
      </Badge>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Assets</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canSendVendor && selectedVendor && vendorSubview === 'available' && selectedIds.size > 0 && (
            <Button size="sm" variant="default" className="gap-1.5" onClick={handleVendorSendSelected}>
              <Truck className="h-3.5 w-3.5" /> Create Request ({selectedIds.size})
            </Button>
          )}
          {canSendVendor && selectedVendor && vendorSubview === 'available' && (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={totalCount === 0 || vendorSendAllLoading} onClick={handleVendorSendAllFiltered}>
              {vendorSendAllLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              Create All Filtered{totalCount > 0 ? ` (${totalCount})` : ''}
            </Button>
          )}
          {canSendVendor && !selectedVendor && (
            <span className="text-xs text-muted-foreground italic">Select a vendor to create a request</span>
          )}
          {canSendVerification && selectedIds.size > 0 && (
            <Button size="sm" variant="default" className="gap-1.5" onClick={handleSendSelected}>
              <Send className="h-3.5 w-3.5" /> Send Selected ({selectedIds.size})
            </Button>
          )}
          {canSendVerification && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={totalCount === 0 || sendAllLoading}
              onClick={handleSendAllFiltered}
            >
              {sendAllLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send All Filtered{totalCount > 0 ? ` (${totalCount})` : ''}
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{totalCount.toLocaleString()} assets</span>
        </div>
      </div>

      {/* Employee verification panel — admin only */}
      {isAdmin && isMappedFilter !== 'unmapped' && (
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Employee Verification</span>
            </div>
            {selectedEmployee ? (
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{selectedEmployee.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedEmployee.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearEmployee} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employee by name or email..."
                  value={employeeSearch}
                  onChange={(e) => { setEmployeeSearch(e.target.value); setShowEmployeeDropdown(true); }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  className="pl-9 h-9 text-sm"
                />
                {showEmployeeDropdown && employeeSearch.length >= 2 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {employeeLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                      </div>
                    ) : employeeOptions.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No employees found.</div>
                    ) : (
                      employeeOptions.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => selectEmployee(emp)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
                        >
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-muted-foreground ml-2">{emp.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {!selectedEmployee && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Select an employee to filter their assets and send verification requests.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendor send panel — admin only, unmapped filter active */}
      {showVendorPanel && (
        <Card className="border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Vendor Verification</span>
            </div>
            {selectedVendor ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{selectedVendor.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedVendor.code}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                    onClick={() => navigate(`/admin/vendor-requests?vendor_id=${selectedVendor.id}`)}
                  >
                    View Requests
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => { setSelectedVendor(null); setVendorSearch(''); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search vendor by name or code..."
                  value={vendorSearch}
                  onChange={(e) => { setVendorSearch(e.target.value); setShowVendorDropdown(true); }}
                  onFocus={() => setShowVendorDropdown(true)}
                  onBlur={() => setTimeout(() => setShowVendorDropdown(false), 150)}
                  className="pl-9 h-9 text-sm"
                />
                {showVendorDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredVendors.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        {vendorSearch.length === 0 ? 'Type to search vendors.' : 'No vendors found.'}
                      </div>
                    ) : (
                      filteredVendors.map((v) => (
                        <button
                          key={v.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedVendor(v); setVendorSearch(''); setShowVendorDropdown(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
                        >
                          <span className="font-medium">{v.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{v.code}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {selectedVendor && (
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => switchVendorSubview('available')}
                  className={`flex-1 text-xs py-1 rounded-md border transition-colors ${
                    vendorSubview === 'available'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-transparent text-muted-foreground border-muted hover:bg-muted'
                  }`}
                >
                  Available
                </button>
                <button
                  onClick={() => switchVendorSubview('reserved')}
                  className={`flex-1 text-xs py-1 rounded-md border transition-colors ${
                    vendorSubview === 'reserved'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-transparent text-muted-foreground border-muted hover:bg-muted'
                  }`}
                >
                  Reserved
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1.5">
              {selectedVendor
                ? vendorSubview === 'available'
                  ? (selectedIds.size > 0 ? `${selectedIds.size} asset(s) selected. ` : '') + 'Available assets are unmapped and not yet assigned to any vendor request.'
                  : `Showing assets currently reserved for ${selectedVendor.name}.`
                : 'Vendors are selected as the target for a verification request. Unmapped assets are not permanently assigned to a vendor.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, ID, serial..." value={search} onChange={(e) => setParam({ q: e.target.value || null })} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setParam({ status: v })}>
            <SelectTrigger className="w-[140px]"><Filter className="mr-1 h-3 w-3" /><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setParam({ category: v })}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={isMappedFilter} onValueChange={(v) => {
            const next = v as 'all' | 'mapped' | 'unmapped';
            if (next === 'unmapped') {
              setParam({ mapped: next, emp_id: null, emp_name: null, emp_email: null });
              setEmployeeSearch('');
              setShowEmployeeDropdown(false);
            } else {
              setParam({ mapped: next });
              setSelectedVendor(null);
              setVendorSearch('');
              setShowVendorDropdown(false);
            }
            setSelectedIds(new Set());
          }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mapping" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="mapped">Employee Assigned</SelectItem>
              <SelectItem value="unmapped">Vendor Pool</SelectItem>
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
                  {(canSendVerification && asset.assignedTo || canSendVendor && !asset.assignedTo && !asset.vendorRequestStatus) && (
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
                    <p className="text-xs mt-0.5 text-foreground">{renderMappedDisplay(asset)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status] ?? ''}`}>{asset.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${reconColors[asset.reconciliationStatus] ?? ''}`}>{asset.reconciliationStatus}</Badge>
                    <WorkflowCell asset={asset} />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {showEmployeeMapActions && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={(e) => openMapDialog(asset, e)}>
                      <UserPlus className="h-3 w-3" />
                      {asset.assignedTo ? 'Remap' : 'Map'}
                    </Button>
                  )}
                  {canSendVerification && asset.assignedTo && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleSendSingle(asset); }}>
                      <Send className="h-3 w-3" /> Send Verification
                    </Button>
                  )}
                  {canSendVendor && !asset.assignedTo && (
                    asset.vendorRequestStatus ? (
                      renderVendorStatusBadge(asset.vendorRequestStatus)
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleVendorSendSingle(asset); }}>
                        <Truck className="h-3 w-3" /> Send to Vendor
                      </Button>
                    )
                  )}
                </div>
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
                  {showCheckboxes && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          canSendVendor
                            ? selectableUnmappedOnPage.length > 0 && selectedIds.size === selectableUnmappedOnPage.length
                            : selectableOnPage.length > 0 && selectedIds.size === selectableOnPage.length
                        }
                        onCheckedChange={canSendVendor ? toggleSelectAllUnmapped : toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  {displayColumnDefs.map((col) => <TableHead key={col.key} className="whitespace-nowrap text-xs">{col.label}</TableHead>)}
                  {showEmployeeMapActions && <TableHead className="text-xs">Map</TableHead>}
                  {canSendVerification && <TableHead className="text-xs">Verify</TableHead>}
                  {canSendVendor && <TableHead className="text-xs">Vendor</TableHead>}
                  <TableHead className="text-xs whitespace-nowrap">Workflow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => {
                  const vendorRowBg = asset.vendorRequestStatus ? (vendorReservationColors[asset.vendorRequestStatus] ?? '') : '';
                  return (
                  <TableRow key={asset.id} className={`cursor-pointer hover:bg-muted/50 ${vendorRowBg}`} onClick={() => navigate(`/assets/${asset.id}`)}>
                    {showCheckboxes && (
                      <TableCell>
                        {(canSendVerification && asset.assignedTo || canSendVendor && !asset.assignedTo && !asset.vendorRequestStatus) && (
                          <Checkbox
                            checked={selectedIds.has(asset.id)}
                            onCheckedChange={() => toggleSelect(asset.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </TableCell>
                    )}
                    {displayColumnDefs.map((col) => (
                      <TableCell key={col.key} className="text-xs whitespace-nowrap">
                        {col.key === 'status' ? (
                          <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status] ?? ''}`}>{asset.status.replace(/_/g, ' ')}</Badge>
                        ) : col.key === 'reconciliationStatus' ? (
                          <Badge variant="outline" className={`text-[10px] ${reconColors[asset.reconciliationStatus] ?? ''}`}>{asset.reconciliationStatus}</Badge>
                        ) : col.key === 'assignedToName' ? (
                          renderMappedDisplay(asset)
                        ) : getCellValue(asset, col.key)}
                      </TableCell>
                    ))}
                    {showEmployeeMapActions && (
                      <TableCell>
                        {asset.vendorName ? (
                          <span className="text-xs text-muted-foreground italic">With Vendor</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => openMapDialog(asset, e)}
                          >
                            <UserPlus className="h-3 w-3" />
                            {asset.assignedTo ? 'Remap' : 'Map'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                    {canSendVerification && (
                      <TableCell>
                        {asset.assignedTo ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-accent hover:text-accent" onClick={(e) => { e.stopPropagation(); handleSendSingle(asset); }}>
                            <Send className="h-3 w-3" /> Send
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    )}
                    {canSendVendor && (
                      <TableCell>
                        {asset.vendorRequestStatus ? (
                          renderVendorStatusBadge(asset.vendorRequestStatus)
                        ) : !asset.assignedTo ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); handleVendorSendSingle(asset); }}>
                            <Truck className="h-3 w-3" /> Send
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                      <WorkflowCell asset={asset} />
                    </TableCell>
                  </TableRow>
                  );
                })}
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

      {/* Send verification dialog */}
      <Dialog open={sendRequestOpen} onOpenChange={(open) => { setSendRequestOpen(open); if (!open) { setSendAssets([]); setForceResendConflict(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-accent" /> Send Verification Request</DialogTitle>
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
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select active cycle" /></SelectTrigger>
                    <SelectContent>
                      {cycles.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-sm">{c.name} ({c.code})</SelectItem>
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
          {forceResendConflict && (
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Asset already verified in this cycle</p>
                  <p className="text-xs mt-0.5">
                    Asset <span className="font-mono font-medium">{forceResendConflict.assetId}</span> was already approved in cycle <span className="font-medium">{forceResendConflict.cycleCode}</span>.
                    Re-sending will create a duplicate verification record.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setForceResendConflict(null)}>Dismiss</Button>
                <Button size="sm" variant="destructive" onClick={() => confirmSendRequest(true)} disabled={sendLoading}>
                  {sendLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Send Anyway
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => confirmSendRequest()}
              disabled={sendLoading || !dialogEmployeeInfo?.valid || !cycleId || cycles.length === 0 || !!forceResendConflict}
              className="gap-1.5"
            >
              {sendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Request{sendAssets.length > 1 ? ` (${sendAssets.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor send dialog */}
      <Dialog open={vendorSendOpen} onOpenChange={(open) => { setVendorSendOpen(open); if (!open) setVendorSendAssets([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600" /> Create Vendor Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm bg-muted rounded-lg p-3 space-y-1.5">
              <p><span className="text-muted-foreground">Vendor:</span> {selectedVendor ? `${selectedVendor.name} (${selectedVendor.code})` : '—'}</p>
              <p><span className="text-muted-foreground">Assets:</span> {vendorSendAssets.length}</p>
            </div>
            {vendorSendAssets.length > 1 && (
              <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs space-y-1">
                {vendorSendAssets.map((a) => (
                  <div key={a.id} className="flex justify-between">
                    <span className="font-mono">{a.assetId}</span>
                    <span className="text-muted-foreground truncate ml-2">{a.name}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A vendor verification request will be created in draft. You can review and send it from Vendor Requests.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorSendOpen(false)}>Cancel</Button>
            <Button onClick={confirmVendorSend} disabled={vendorSendLoading || !selectedVendor} className="gap-1.5">
              {vendorSendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map / Re-map employee dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={(open) => { if (!open) { setMapDialogOpen(false); setMapConflict(null); setMapPendingEmp(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {mapTargetAsset?.assignedTo ? 'Re-map Employee' : 'Map Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mapTargetAsset && (
              <p className="text-sm text-muted-foreground">
                Asset: <span className="font-medium text-foreground">{mapTargetAsset.assetId} — {mapTargetAsset.name}</span>
              </p>
            )}
            {mapTargetAsset?.assignedToName && (
              <p className="text-xs text-muted-foreground">
                Currently mapped to: <span className="font-medium">{mapTargetAsset.assignedToName}</span>
              </p>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {mapSearchLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                </div>
              ) : mapSearch.length < 2 ? (
                <p className="p-3 text-sm text-muted-foreground">Type at least 2 characters to search.</p>
              ) : mapOptions.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No employees found.</p>
              ) : (
                mapOptions.map((emp) => (
                  <button
                    key={emp.id}
                    disabled={mapLoading}
                    onClick={() => confirmMapEmployee(emp)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm border-b last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                    {mapLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </button>
                ))
              )}
            </div>
          </div>
          {mapConflict && mapPendingEmp && (
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Asset in active verification request</p>
                  <p className="text-xs mt-0.5">
                    This asset is currently in request <span className="font-mono font-medium">{mapConflict.requestReference}</span> for{' '}
                    <span className="font-medium">{mapConflict.employeeName}</span> ({mapConflict.employeeEmail}).
                    Reassigning will interrupt that verification.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setMapConflict(null); setMapPendingEmp(null); }}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={() => confirmMapEmployee(mapPendingEmp, true)} disabled={mapLoading}>
                  {mapLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Reassign Anyway
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
