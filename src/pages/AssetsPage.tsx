import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchAssets, fetchLookups, fetchUsers, fetchLocationNodes, fetchLocationAdmins, assignAsset, bulkAssignAssets, markAssetFound, UserOption, LocationOption, LocationAdminOption } from '@/services/assetService';
import { mapBackendAsset } from '@/services/mappers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, AlertTriangle, User, X, UserPlus, Truck, Check, ChevronsUpDown } from 'lucide-react';
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
  missing:               'bg-red-100 text-red-700 border-red-200',
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
  const isMappedFilter = (searchParams.get('mapped') ?? 'all') as 'all' | 'employee' | 'unmapped';
  const employeeSubview = (searchParams.get('emp_sub') ?? 'assigned') as 'assigned' | 'available';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const locationIdFilter = searchParams.get('loc_id') ?? '';
  const locationAdminIdFilter = searchParams.get('loc_admin_id') ?? '';

  // Reconstruct location + location-admin filter labels from URL params
  const locationFilterName = searchParams.get('loc_name') ?? '';
  const locationAdminFilterName = searchParams.get('loc_admin_name') ?? '';

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

  // ── Mark Found ─────────────────────────────────────────────────────────
  const markFoundMutation = useMutation({
    mutationFn: (assetId: string) => markAssetFound(assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Asset restored to active', description: 'You can now send a fresh verification request if needed.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.detail || 'Could not restore asset.', variant: 'destructive' }),
  });

  // ── Employee filter for verification workflow ──────────────────────────
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<UserOption[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeComboOpen, setEmployeeComboOpen] = useState(false);
  const [vendorComboOpen, setVendorComboOpen] = useState(false);

  // ── Location filter ────────────────────────────────────────────────────
  const [locationComboOpen, setLocationComboOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (!locationComboOpen) return;
    setLocationLoading(true);
    fetchLocationNodes(locationSearch.length >= 1 ? locationSearch : undefined)
      .then((nodes) => setLocationOptions(nodes.slice(0, 50)))
      .catch(() => setLocationOptions([]))
      .finally(() => setLocationLoading(false));
  }, [locationSearch, locationComboOpen]);

  const selectLocation = (loc: LocationOption) => {
    setParam({ loc_id: loc.id, loc_name: loc.name });
    setLocationComboOpen(false);
    setLocationSearch('');
  };

  const clearLocation = () => setParam({ loc_id: null, loc_name: null });

  // ── Location Admin filter (super_admin only) ───────────────────────────
  const isSuperAdmin = user?.role === 'super_admin';
  const [locAdminComboOpen, setLocAdminComboOpen] = useState(false);
  const [locAdminSearch, setLocAdminSearch] = useState('');
  const [locAdminOptions, setLocAdminOptions] = useState<LocationAdminOption[]>([]);
  const [locAdminLoading, setLocAdminLoading] = useState(false);

  useEffect(() => {
    if (!locAdminComboOpen || !isSuperAdmin) return;
    setLocAdminLoading(true);
    fetchLocationAdmins(locAdminSearch.length >= 1 ? locAdminSearch : undefined)
      .then((admins) => setLocAdminOptions(admins))
      .catch(() => setLocAdminOptions([]))
      .finally(() => setLocAdminLoading(false));
  }, [locAdminSearch, locAdminComboOpen, isSuperAdmin]);

  const selectLocAdmin = (admin: LocationAdminOption) => {
    setParam({ loc_admin_id: admin.id, loc_admin_name: admin.name });
    setLocAdminComboOpen(false);
    setLocAdminSearch('');
  };

  const clearLocAdmin = () => setParam({ loc_admin_id: null, loc_admin_name: null });

  // Reconstruct selectedEmployee from URL so it survives navigation
  const selectedEmployee: UserOption | null = (() => {
    const id = searchParams.get('emp_id');
    const name = searchParams.get('emp_name');
    const email = searchParams.get('emp_email') ?? '';
    return id && name ? { id, name, email } : null;
  })();

  useEffect(() => {
    if (!employeeComboOpen) return;
    const delay = employeeSearch.length === 0 ? 0 : 300;
    const timer = setTimeout(() => {
      setEmployeeLoading(true);
      fetchUsers(employeeSearch || undefined, 'employee')
        .then((users) => setEmployeeOptions(users))
        .catch(() => setEmployeeOptions([]))
        .finally(() => setEmployeeLoading(false));
    }, delay);
    return () => clearTimeout(timer);
  }, [employeeSearch, employeeComboOpen]);

  const selectEmployee = (emp: UserOption) => {
    setParam({ mapped: 'employee', emp_id: emp.id, emp_name: emp.name, emp_email: emp.email, emp_sub: 'assigned' });
    setEmployeeSearch('');
    setSelectedIds(new Set());
  };

  const clearEmployee = () => {
    setParam({ emp_id: null, emp_name: null, emp_email: null, emp_sub: null });
    setEmployeeSearch('');
    setSelectedIds(new Set());
  };

  const switchEmployeeSubview = (subview: 'assigned' | 'available') => {
    setParam({ emp_sub: subview });
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
  if (locationIdFilter) queryParams.location_id = locationIdFilter;
  if (locationAdminIdFilter) queryParams.location_admin_id = locationAdminIdFilter;

  if (isMappedFilter === 'employee') {
    if (employeeSubview === 'available') {
      queryParams.is_mapped = 'false';
      queryParams.vendor_linked = 'false';
    } else {
      // assigned subview
      if (selectedEmployee) {
        queryParams.assigned_to = selectedEmployee.id;
      } else {
        queryParams.is_mapped = 'true';
      }
    }
  } else if (isMappedFilter === 'unmapped') {
    queryParams.is_mapped = 'false';
  }

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

  useEffect(() => { setSelectedIds(new Set()); }, [page, search, statusFilter, categoryFilter, isMappedFilter, employeeSubview]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableOnPage.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableOnPage.map((a) => a.id)));
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
      if (locationIdFilter) baseParams.location_id = locationIdFilter;
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
      fetchUsers(mapSearch, 'employee')
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

  // ── Bulk map employee dialog ──────────────────────────────────────────
  const [bulkMapOpen, setBulkMapOpen] = useState(false);
  const [bulkMapEmployee, setBulkMapEmployee] = useState<UserOption | null>(null);
  const [bulkMapSearch, setBulkMapSearch] = useState('');
  const [bulkMapOptions, setBulkMapOptions] = useState<UserOption[]>([]);
  const [bulkMapSearchLoading, setBulkMapSearchLoading] = useState(false);
  const [bulkMapLoading, setBulkMapLoading] = useState(false);
  const [bulkMapComboOpen, setBulkMapComboOpen] = useState(false);
  const [bulkMapConflict, setBulkMapConflict] = useState<{
    conflicts: { asset_id: string; request_reference: string; employee_name: string }[];
  } | null>(null);

  useEffect(() => {
    if (bulkMapSearch.length < 2) { setBulkMapOptions([]); return; }
    const timer = setTimeout(() => {
      setBulkMapSearchLoading(true);
      fetchUsers(bulkMapSearch, 'employee')
        .then((users) => setBulkMapOptions(users))
        .catch(() => setBulkMapOptions([]))
        .finally(() => setBulkMapSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [bulkMapSearch]);

  const canBulkMap = isAdmin && isMappedFilter === 'employee' && employeeSubview === 'available' && selectedIds.size > 0;

  const confirmBulkMap = async (forceReassign = false) => {
    if (!bulkMapEmployee || selectedIds.size === 0) return;
    setBulkMapLoading(true);
    try {
      const result = await bulkAssignAssets({
        user_id: bulkMapEmployee.id,
        asset_ids: Array.from(selectedIds),
        force_reassign: forceReassign,
      });
      toast({ title: `${result.assigned_count} asset(s) mapped`, description: `Assigned to ${bulkMapEmployee.name}.` });
      setBulkMapOpen(false);
      setBulkMapEmployee(null);
      setBulkMapSearch('');
      setBulkMapConflict(null);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    } catch (err: any) {
      const d = err?.response?.data;
      const conflictType = d?.conflict_type;
      if (conflictType === 'active_vendor_request') {
        toast({ title: 'Vendor Request Conflict', description: d?.detail || 'Some assets are in active vendor requests.', variant: 'destructive' });
      } else if (conflictType === 'active_employee_request') {
        setBulkMapConflict({ conflicts: d?.conflicts ?? [] });
      } else {
        toast({ title: 'Error', description: d?.detail || 'Failed to assign assets.', variant: 'destructive' });
      }
    }
    setBulkMapLoading(false);
  };

  const activeColumnDefs = ASSET_COLUMNS.filter((c) => visibleColumns.includes(c.key));
  const displayColumnDefs = activeColumnDefs.map((col) =>
    col.key === 'assignedToName' && isMappedFilter === 'unmapped'
      ? { ...col, label: 'Vendor' }
      : col
  );
  const canSendVerification = isAdmin && isMappedFilter === 'employee' && employeeSubview === 'assigned' && !!selectedEmployee;
  const canBulkMapSelect = isAdmin && isMappedFilter === 'employee' && employeeSubview === 'available';
  const selectableOnPage = canSendVerification
    ? assets.filter((a) => a.assignedTo)
    : canBulkMapSelect
    ? assets.filter((a) => !a.vendorRequestStatus)
    : assets.filter((a) => !a.assignedTo && !a.vendorRequestStatus);
  const showCheckboxes = canSendVerification || canSendVendor || canBulkMapSelect;
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
          {canBulkMap && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setBulkMapOpen(true); setBulkMapConflict(null); setBulkMapEmployee(selectedEmployee ?? null); setBulkMapSearch(''); }}>
              <UserPlus className="h-3.5 w-3.5" /> Map Selected ({selectedIds.size})
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{totalCount.toLocaleString()} assets</span>
        </div>
      </div>

      {/* Employee selected strip — shown in employee mode when employee is selected */}
      {isAdmin && isMappedFilter === 'employee' && selectedEmployee && (
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-500 to-primary flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-medium truncate bg-gradient-to-r from-orange-500 to-primary bg-clip-text text-transparent">{selectedEmployee.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">{selectedEmployee.email}</span>
          </div>
          <div className="flex items-center rounded-md bg-muted p-0.5 gap-0.5 shrink-0">
            <button
              onClick={() => switchEmployeeSubview('assigned')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${employeeSubview === 'assigned' ? 'bg-gradient-to-r from-orange-500 to-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >Assigned</button>
            <button
              onClick={() => switchEmployeeSubview('available')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${employeeSubview === 'available' ? 'bg-gradient-to-r from-orange-500 to-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >Available</button>
          </div>
          {selectedIds.size > 0 && (
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{selectedIds.size} selected</span>
          )}
          <Button variant="ghost" size="sm" onClick={clearEmployee} className="h-7 w-7 p-0 shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Vendor strip — admin only, unmapped filter active */}
      {showVendorPanel && selectedVendor && (
        <div className="border border-blue-200 bg-blue-50/50 rounded-lg px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Truck className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium truncate">{selectedVendor.name}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{selectedVendor.code}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
          <div className="flex gap-1">
            <button
              onClick={() => switchVendorSubview('available')}
              className={`flex-1 text-xs py-1 rounded-md border transition-colors ${vendorSubview === 'available' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-muted-foreground border-muted hover:bg-muted'}`}
            >Available</button>
            <button
              onClick={() => switchVendorSubview('reserved')}
              className={`flex-1 text-xs py-1 rounded-md border transition-colors ${vendorSubview === 'reserved' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-muted-foreground border-muted hover:bg-muted'}`}
            >Reserved</button>
          </div>
          <p className="text-xs text-muted-foreground">
            {vendorSubview === 'available'
              ? (selectedIds.size > 0 ? `${selectedIds.size} asset(s) selected. ` : '') + 'Available assets are unmapped and not yet assigned to any vendor request.'
              : `Showing assets currently reserved for ${selectedVendor.name}.`}
          </p>
        </div>
      )}

      {/* Filter bar — row 1: Search · Category · Mode · Employee/Vendor selector */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, ID, serial..." value={search} onChange={(e) => setParam({ q: e.target.value || null })} className="pl-9" />
          </div>

          {/* Category */}
          <Select value={categoryFilter} onValueChange={(v) => setParam({ category: v })}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Mode */}
          <Select value={isMappedFilter} onValueChange={(v) => {
            const next = v as 'all' | 'employee' | 'unmapped';
            if (next === 'unmapped') {
              setParam({ mapped: next, emp_id: null, emp_name: null, emp_email: null, emp_sub: null });
              setEmployeeSearch('');
            } else if (next === 'employee') {
              setParam({ mapped: next, emp_sub: 'assigned' });
              setSelectedVendor(null);
              setVendorSearch('');
            } else {
              setParam({ mapped: next, emp_id: null, emp_name: null, emp_email: null, emp_sub: null });
              setSelectedVendor(null);
              setVendorSearch('');
            }
            setSelectedIds(new Set());
          }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="unmapped">Vendor Pool</SelectItem>
            </SelectContent>
          </Select>

          {/* Employee combobox — visible only in employee mode */}
          {isAdmin && isMappedFilter === 'employee' && (
            <Popover open={employeeComboOpen} onOpenChange={(open) => { setEmployeeComboOpen(open); if (!open) setEmployeeSearch(''); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[180px] justify-between font-normal">
                  <span className={selectedEmployee ? '' : 'text-muted-foreground'}>
                    {selectedEmployee ? selectedEmployee.name : 'Select employee'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search by name or email..." value={employeeSearch} onValueChange={setEmployeeSearch} />
                  <CommandList>
                    {employeeLoading && (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                      </div>
                    )}
                    {!employeeLoading && employeeOptions.length === 0 && <CommandEmpty>No employees found.</CommandEmpty>}
                    {employeeOptions.length > 0 && (
                      <CommandGroup>
                        {employeeOptions.map((emp) => (
                          <CommandItem key={emp.id} value={emp.id} onSelect={() => { selectEmployee(emp); setEmployeeComboOpen(false); }}>
                            <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedEmployee?.id === emp.id ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{emp.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {/* Vendor combobox — visible only in vendor/unmapped mode */}
          {isAdmin && isMappedFilter === 'unmapped' && (
            <Popover open={vendorComboOpen} onOpenChange={(open) => { setVendorComboOpen(open); if (!open) setVendorSearch(''); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[180px] justify-between font-normal">
                  <span className={selectedVendor ? '' : 'text-muted-foreground'}>
                    {selectedVendor ? selectedVendor.name : 'Select vendor'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search by name or code..." value={vendorSearch} onValueChange={setVendorSearch} />
                  <CommandList>
                    {filteredVendors.length === 0 && <CommandEmpty>{vendorSearch.length === 0 ? 'No vendors available.' : 'No vendors found.'}</CommandEmpty>}
                    {filteredVendors.length > 0 && (
                      <CommandGroup>
                        {filteredVendors.map((v) => (
                          <CommandItem key={v.id} value={v.id} onSelect={() => { setSelectedVendor(v); setVendorSearch(''); setVendorComboOpen(false); }}>
                            <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedVendor?.id === v.id ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{v.name}</p>
                              <p className="text-xs text-muted-foreground">{v.code}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Row 2: Status · Location · Loc. Admin · Columns */}
        <div className="flex flex-wrap gap-2">
          {/* Status */}
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

          {/* Location */}
          <Popover open={locationComboOpen} onOpenChange={(open) => { setLocationComboOpen(open); if (!open) setLocationSearch(''); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-[160px] justify-between font-normal">
                <span className={locationIdFilter ? '' : 'text-muted-foreground'}>
                  {locationIdFilter ? locationFilterName || 'Location' : 'Location'}
                </span>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {locationIdFilter && (
                    <span role="button" tabIndex={0} className="rounded-full hover:bg-muted p-0.5"
                      onClick={(e) => { e.stopPropagation(); clearLocation(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearLocation(); } }}>
                      <X className="h-3 w-3" />
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search location..." value={locationSearch} onValueChange={setLocationSearch} />
                <CommandList>
                  {locationLoading && <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>}
                  {!locationLoading && locationOptions.length === 0 && <CommandEmpty>No locations found.</CommandEmpty>}
                  {locationOptions.length > 0 && (
                    <CommandGroup>
                      {locationOptions.map((loc) => (
                        <CommandItem key={loc.id} value={loc.id} onSelect={() => selectLocation(loc)}>
                          <Check className={`mr-2 h-4 w-4 shrink-0 ${locationIdFilter === loc.id ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="min-w-0">
                            <p className="text-sm">{loc.name}</p>
                            {loc.location_type && <p className="text-xs text-muted-foreground">{loc.location_type.name}</p>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Location Admin — super_admin only */}
          {isSuperAdmin && (
            <Popover open={locAdminComboOpen} onOpenChange={(open) => { setLocAdminComboOpen(open); if (!open) setLocAdminSearch(''); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[160px] justify-between font-normal">
                  <span className={locationAdminIdFilter ? '' : 'text-muted-foreground'}>
                    {locationAdminIdFilter ? locationAdminFilterName || 'Loc. Admin' : 'Loc. Admin'}
                  </span>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {locationAdminIdFilter && (
                      <span role="button" tabIndex={0} className="rounded-full hover:bg-muted p-0.5"
                        onClick={(e) => { e.stopPropagation(); clearLocAdmin(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearLocAdmin(); } }}>
                        <X className="h-3 w-3" />
                      </span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search location admin..." value={locAdminSearch} onValueChange={setLocAdminSearch} />
                  <CommandList>
                    {locAdminLoading && <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>}
                    {!locAdminLoading && locAdminOptions.length === 0 && <CommandEmpty>No location admins found.</CommandEmpty>}
                    {locAdminOptions.length > 0 && (
                      <CommandGroup>
                        {locAdminOptions.map((admin) => (
                          <CommandItem key={admin.id} value={admin.id} onSelect={() => selectLocAdmin(admin)}>
                            <Check className={`mr-2 h-4 w-4 shrink-0 ${locationAdminIdFilter === admin.id ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{admin.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {admin.locations.map((l) => l.name).join(', ') || admin.email}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

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
                  {(canSendVerification && asset.assignedTo || canSendVendor && !asset.assignedTo && !asset.vendorRequestStatus || canBulkMapSelect && !asset.vendorRequestStatus) && (
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
                  {isAdmin && asset.status === 'missing' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                      disabled={markFoundMutation.isPending}
                      onClick={(e) => { e.stopPropagation(); markFoundMutation.mutate(asset.id); }}
                    >
                      <Check className="h-3 w-3" /> Mark Found
                    </Button>
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
                        aria-label="Select all"
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
                        {(canSendVerification && asset.assignedTo || canSendVendor && !asset.assignedTo && !asset.vendorRequestStatus || canBulkMapSelect && !asset.vendorRequestStatus) && (
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
                    {isAdmin && asset.status === 'missing' && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-green-700 hover:text-green-800 hover:bg-green-50"
                          disabled={markFoundMutation.isPending}
                          onClick={() => markFoundMutation.mutate(asset.id)}
                        >
                          <Check className="h-3 w-3" /> Mark Found
                        </Button>
                      </TableCell>
                    )}
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

      {/* Bulk map employee dialog */}
      <Dialog open={bulkMapOpen} onOpenChange={(open) => { if (!open) { setBulkMapOpen(false); setBulkMapConflict(null); setBulkMapEmployee(null); setBulkMapSearch(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Map Assets to Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedIds.size} asset(s)</span> will be assigned to the chosen employee.
              Assets in active employee verification requests may require explicit reassignment.
            </p>

            <Popover open={bulkMapComboOpen} onOpenChange={(open) => { setBulkMapComboOpen(open); if (!open) setBulkMapSearch(''); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className={bulkMapEmployee ? '' : 'text-muted-foreground'}>
                    {bulkMapEmployee ? bulkMapEmployee.name : 'Select employee...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search by name or email..." value={bulkMapSearch} onValueChange={setBulkMapSearch} />
                  <CommandList>
                    {bulkMapSearchLoading && (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                      </div>
                    )}
                    {!bulkMapSearchLoading && bulkMapSearch.length < 2 && <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>}
                    {!bulkMapSearchLoading && bulkMapSearch.length >= 2 && bulkMapOptions.length === 0 && <CommandEmpty>No employees found.</CommandEmpty>}
                    {bulkMapOptions.length > 0 && (
                      <CommandGroup>
                        {bulkMapOptions.map((emp) => (
                          <CommandItem key={emp.id} value={emp.id} onSelect={() => { setBulkMapEmployee(emp); setBulkMapComboOpen(false); setBulkMapSearch(''); setBulkMapConflict(null); }}>
                            <Check className={`mr-2 h-4 w-4 shrink-0 ${bulkMapEmployee?.id === emp.id ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{emp.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {bulkMapEmployee && (
              <p className="text-xs text-muted-foreground">
                Assigning to: <span className="font-medium text-foreground">{bulkMapEmployee.name}</span> · {bulkMapEmployee.email}
              </p>
            )}

            {bulkMapConflict && (
              <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">{bulkMapConflict.conflicts.length} asset(s) in active verification requests</p>
                    <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                      {bulkMapConflict.conflicts.slice(0, 5).map((c) => (
                        <li key={c.asset_id}><span className="font-mono">{c.asset_id}</span> — {c.request_reference} ({c.employee_name})</li>
                      ))}
                      {bulkMapConflict.conflicts.length > 5 && <li>…and {bulkMapConflict.conflicts.length - 5} more</li>}
                    </ul>
                    <p className="text-xs mt-1.5">Reassigning will interrupt those verification requests.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setBulkMapConflict(null)}>Cancel</Button>
                  <Button size="sm" variant="destructive" disabled={bulkMapLoading} onClick={() => confirmBulkMap(true)}>
                    {bulkMapLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Map Anyway
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!bulkMapConflict && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkMapOpen(false)}>Cancel</Button>
              <Button disabled={!bulkMapEmployee || bulkMapLoading} onClick={() => confirmBulkMap(false)}>
                {bulkMapLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Map {selectedIds.size} Asset{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
