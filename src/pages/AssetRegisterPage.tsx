import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { createAsset, fetchLookups, fetchUsers, UserOption } from '@/services/assetService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LocationHierarchySelector from '@/components/LocationHierarchySelector';
import { LocationPath, LOCATION_LEVELS } from '@/types';
import { ArrowLeft, ChevronDown, Download, Loader2, QrCode, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

const emptyForm = {
  // Core
  asset_id: '',
  name: '',
  assigned_to_id: '' as string,
  serial_number: '',
  sub_number: '',
  tag_number: '',
  asset_class: '',
  description: '',
  category_id: '',
  sub_type_id: '',
  business_entity_id: '',
  cost_center_id: '',
  internal_order: '',
  supplier_id: '',
  currency_code: 'INR',
  purchase_value: '',
  useful_life: '',
  useful_life_in_periods: '',
  capitalized_on: '',
  sub_location_text: '',
  is_wfh_asset: false as boolean,
  // APC
  apc_fy_start: '',
  acquisition_amount: '',
  retirement_amount: '',
  transfer_amount: '',
  post_capitalization_amount: '',
  current_apc_amount: '',
  // Depreciation
  dep_fy_start: '',
  dep_for_year: '',
  dep_retirement_amount: '',
  dep_transfer_amount: '',
  write_ups_amount: '',
  dep_post_cap_amount: '',
  accumulated_depreciation_amount: '',
  book_value_fy_start: '',
  current_book_value: '',
  deactivation_on: '',
  // WFH
  wfh_uid: '',
  user_name: '',
  user_email: '',
  wfh_location_text: '',
};

type FormState = typeof emptyForm;

interface QRSuccess {
  assetId: string;
  name: string;
  qrUid: string;
  qrPayload: string;
  createdId: string;
}

export default function AssetRegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [locationPath, setLocationPath] = useState<LocationPath>({});
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { data: userResults = [] } = useQuery({
    queryKey: ['userSearch', userSearch],
    queryFn: () => fetchUsers(userSearch),
    enabled: userSearch.length >= 2,
    staleTime: 10_000,
  });

  const handleSelectUser = useCallback((u: UserOption) => {
    setSelectedUser(u);
    setForm((f) => ({
      ...f,
      assigned_to_id: u.id,
      user_name: u.name || '',
      user_email: u.email || '',
    }));
    setUserSearch(u.name || u.email);
    setUserDropdownOpen(false);
  }, []);

  const handleClearUser = useCallback(() => {
    setSelectedUser(null);
    setForm((f) => ({ ...f, assigned_to_id: '', user_name: '', user_email: '' }));
    setUserSearch('');
  }, []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [qrSuccess, setQrSuccess] = useState<QRSuccess | null>(null);
  const [open, setOpen] = useState({
    info: true,
    location: true,
    image: false,
    financial: false,
    depreciation: false,
    wfh: false,
  });
  const toggle = (key: keyof typeof open) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  const { data: lookups } = useQuery({
    queryKey: ['assetLookups'],
    queryFn: fetchLookups,
    staleTime: 5 * 60 * 1000,
  });

  const categories: { id: string; code: string; name: string }[] = lookups?.categories ?? [];
  const subTypes: { id: string; name: string; categoryCode?: string }[] = lookups?.subTypes ?? [];
  const entities: { id: string; name: string }[] = lookups?.entities ?? [];
  const costCenters: { id: string; name: string; code?: string }[] = lookups?.costCenters ?? [];
  const suppliers: { id: string; name: string }[] = lookups?.suppliers ?? [];

  const selectedCategoryCode = categories.find((c) => c.id === form.category_id)?.code;
  const filteredSubTypes = selectedCategoryCode
    ? subTypes.filter((s) => !s.categoryCode || s.categoryCode === selectedCategoryCode)
    : subTypes;

  const mutation = useMutation({
    mutationFn: ({ payload, file }: { payload: Record<string, any>; file: File | null }) =>
      createAsset(payload, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      const qrCode = data.qrCode ?? {};
      setQrSuccess({
        assetId: data.assetId ?? data.asset_id ?? '',
        name: data.name ?? '',
        qrUid: data.qrUid ?? data.qr_uid ?? qrCode.qr_uid ?? '',
        qrPayload: JSON.stringify(qrCode),
        createdId: data.id ?? '',
      });
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      let msg = 'Failed to register asset.';
      if (d) {
        if (typeof d === 'string') msg = d;
        else if (d.detail) msg = d.detail;
        else {
          const firstKey = Object.keys(d)[0];
          if (firstKey) {
            const val = Array.isArray(d[firstKey]) ? d[firstKey][0] : d[firstKey];
            msg = `${firstKey}: ${val}`;
          }
        }
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const getLocationId = (): string | undefined => {
    const reversed = [...LOCATION_LEVELS].reverse();
    for (const lvl of reversed) {
      if (locationPath[lvl]) return locationPath[lvl];
    }
    return undefined;
  };

  const setStr = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setSel = (key: keyof FormState) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';

    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: 'File too large',
        description: `Image must be under 5 MB. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: 'destructive',
      });
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayload = (): Record<string, any> => {
    const locationId = getLocationId();
    const p: Record<string, any> = {
      asset_id: form.asset_id.trim(),
      name: form.name.trim(),
      category_id: form.category_id,
      current_location_id: locationId,
    };

    const optStr = (key: keyof FormState) => {
      const v = (form[key] as string).trim();
      if (v) p[key as string] = v;
    };
    const optDec = (key: keyof FormState) => {
      const v = (form[key] as string).trim();
      if (v) p[key as string] = parseFloat(v);
    };
    const optInt = (key: keyof FormState) => {
      const v = (form[key] as string).trim();
      if (v) p[key as string] = parseInt(v, 10);
    };

    optStr('serial_number');
    optStr('sub_number');
    optStr('tag_number');
    optStr('asset_class');
    optStr('description');
    optStr('sub_location_text');
    optStr('internal_order');
    optStr('currency_code');
    optStr('capitalized_on');
    optStr('deactivation_on');
    if (form.sub_type_id) p.sub_type_id = form.sub_type_id;
    if (form.assigned_to_id) p.assigned_to_id = form.assigned_to_id;
    if (form.business_entity_id) p.business_entity_id = form.business_entity_id;
    if (form.cost_center_id) p.cost_center_id = form.cost_center_id;
    if (form.supplier_id) p.supplier_id = form.supplier_id;
    optDec('purchase_value');
    optInt('useful_life');
    optInt('useful_life_in_periods');
    p.is_wfh_asset = form.is_wfh_asset;
    // APC
    optDec('apc_fy_start');
    optDec('acquisition_amount');
    optDec('retirement_amount');
    optDec('transfer_amount');
    optDec('post_capitalization_amount');
    optDec('current_apc_amount');
    // Depreciation
    optDec('dep_fy_start');
    optDec('dep_for_year');
    optDec('dep_retirement_amount');
    optDec('dep_transfer_amount');
    optDec('write_ups_amount');
    optDec('dep_post_cap_amount');
    optDec('accumulated_depreciation_amount');
    optDec('book_value_fy_start');
    optDec('current_book_value');
    // WFH
    if (form.is_wfh_asset) {
      optStr('wfh_uid');
      optStr('user_name');
      optStr('user_email');
      optStr('wfh_location_text');
    }
    return p;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const locationId = getLocationId();
    if (!locationId) {
      toast({ title: 'Location Required', description: 'Please select a location.', variant: 'destructive' });
      return;
    }
    if (!form.asset_id.trim()) {
      toast({ title: 'Asset ID Required', description: 'Please enter an asset ID.', variant: 'destructive' });
      return;
    }
    if (!form.category_id) {
      toast({ title: 'Category Required', description: 'Please select a category.', variant: 'destructive' });
      return;
    }
    mutation.mutate({ payload: buildPayload(), file: imageFile });
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-svg-export');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${qrSuccess?.assetId ?? 'asset'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const decField = (label: string, key: keyof FormState) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step="0.01" placeholder="0.00" value={form[key] as string} onChange={setStr(key)} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <h1 className="text-xl font-bold md:text-2xl mb-4">Register New Asset</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 1. Asset Information ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('info')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Asset Information</CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open.info ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {open.info && (
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Business Entity</Label>
                <Select value={form.business_entity_id} onValueChange={setSel('business_entity_id')}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>{entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asset ID *</Label>
                <Input required placeholder="e.g. FAR-2025-0001" value={form.asset_id} onChange={setStr('asset_id')} />
              </div>
              <div className="space-y-2">
                <Label>Asset Name *</Label>
                <Input required value={form.name} onChange={setStr('name')} />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serial_number} onChange={setStr('serial_number')} />
              </div>
              <div className="space-y-2">
                <Label>Sub Number</Label>
                <Input placeholder="e.g. 0" value={form.sub_number} onChange={setStr('sub_number')} />
              </div>
              <div className="space-y-2">
                <Label>Tag Number</Label>
                <Input value={form.tag_number} onChange={setStr('tag_number')} />
              </div>
              <div className="space-y-2">
                <Label>Asset Class</Label>
                <Input placeholder="e.g. Fixed Asset" value={form.asset_class} onChange={setStr('asset_class')} />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category_id} onValueChange={(v) => { setSel('category_id')(v); setForm((f) => ({ ...f, sub_type_id: '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub Asset Type</Label>
                <Select value={form.sub_type_id} onValueChange={setSel('sub_type_id')}>
                  <SelectTrigger><SelectValue placeholder="Select sub type" /></SelectTrigger>
                  <SelectContent>{filteredSubTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cost Center</Label>
                <Select value={form.cost_center_id} onValueChange={setSel('cost_center_id')}>
                  <SelectTrigger><SelectValue placeholder="Select cost center" /></SelectTrigger>
                  <SelectContent>{costCenters.map((c) => <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Internal Order</Label>
                <Input placeholder="e.g. IO-001" value={form.internal_order} onChange={setStr('internal_order')} />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={setSel('supplier_id')}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency_code} onValueChange={setSel('currency_code')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Purchase Value</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.purchase_value} onChange={setStr('purchase_value')} />
              </div>
              <div className="space-y-2">
                <Label>Useful Life (years)</Label>
                <Input type="number" placeholder="e.g. 5" value={form.useful_life} onChange={setStr('useful_life')} />
              </div>
              <div className="space-y-2">
                <Label>Useful Life in Periods</Label>
                <Input type="number" placeholder="e.g. 60" value={form.useful_life_in_periods} onChange={setStr('useful_life_in_periods')} />
              </div>
              <div className="space-y-2">
                <Label>Capitalized On</Label>
                <Input type="date" value={form.capitalized_on} onChange={setStr('capitalized_on')} />
              </div>
              {/* Assign To Employee */}
              <div className="space-y-2 md:col-span-2">
                <Label>Assign To Employee</Label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name or email (min 2 chars)…"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserDropdownOpen(true);
                        if (!e.target.value) handleClearUser();
                      }}
                      onFocus={() => userSearch.length >= 2 && setUserDropdownOpen(true)}
                      autoComplete="off"
                    />
                    {selectedUser && (
                      <Button type="button" variant="ghost" size="icon" onClick={handleClearUser}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {userDropdownOpen && userResults.length > 0 && !selectedUser && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={() => handleSelectUser(u)}
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUser && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned: <span className="font-medium">{selectedUser.name}</span> ({selectedUser.email})
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Asset Description</Label>
                <Textarea value={form.description} onChange={setStr('description')} rows={2} />
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── 2. Location ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('location')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Location *</CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open.location ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {open.location && (
            <CardContent className="space-y-4">
              <LocationHierarchySelector value={locationPath} onChange={setLocationPath} />
              <div className="space-y-2">
                <Label>Sub Location</Label>
                <Input placeholder="e.g. Rack 3, Shelf B" value={form.sub_location_text} onChange={setStr('sub_location_text')} />
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── 3. Asset Image ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('image')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Asset Image</CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open.image ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {open.image && (
            <CardContent className="space-y-3">
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
                  {imageFile ? 'Change Image' : 'Upload Image'}
                </Button>
                {imageFile && (
                  <span className="text-xs text-muted-foreground">
                    {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Max 5 MB. JPEG, PNG, WebP or GIF.</p>
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="mt-2 max-h-48 rounded border object-contain" />
              )}
            </CardContent>
          )}
        </Card>

        {/* ── 4. Financial Details (APC) ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('financial')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Financial Details (APC)</CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open.financial ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {open.financial && (
            <CardContent className="grid gap-4 md:grid-cols-3">
              {decField('APC FY Start', 'apc_fy_start')}
              {decField('Acquisition', 'acquisition_amount')}
              {decField('Retirement', 'retirement_amount')}
              {decField('Transfer', 'transfer_amount')}
              {decField('Post-Capital.', 'post_capitalization_amount')}
              {decField('Current APC', 'current_apc_amount')}
            </CardContent>
          )}
        </Card>

        {/* ── 5. Depreciation Details ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('depreciation')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Depreciation Details</CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open.depreciation ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {open.depreciation && (
            <CardContent className="grid gap-4 md:grid-cols-3">
              {decField('Dep. FY Start', 'dep_fy_start')}
              {decField('Dep. for Year', 'dep_for_year')}
              {decField('Dep. Retirement', 'dep_retirement_amount')}
              {decField('Dep. Transfer', 'dep_transfer_amount')}
              {decField('Write-ups', 'write_ups_amount')}
              {decField('Dep. Post-Cap.', 'dep_post_cap_amount')}
              {decField('Accumulated Dep.', 'accumulated_depreciation_amount')}
              {decField('Bk. Val. FY Start', 'book_value_fy_start')}
              {decField('Current Book Value', 'current_book_value')}
              <div className="space-y-2">
                <Label>Deactivation On</Label>
                <Input type="date" value={form.deactivation_on} onChange={setStr('deactivation_on')} />
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── 6. WFH Details ── */}
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => toggle('wfh')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">WFH Details</CardTitle>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Label htmlFor="is_wfh_asset" className="text-sm font-normal">WFH Asset</Label>
                <Switch
                  id="is_wfh_asset"
                  checked={form.is_wfh_asset}
                  onCheckedChange={(v) => {
                    setForm((f) => ({ ...f, is_wfh_asset: v }));
                    if (v) setOpen((s) => ({ ...s, wfh: true }));
                  }}
                />
              </div>
            </div>
          </CardHeader>
          {open.wfh && (
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>WFH UID</Label>
                <Input value={form.wfh_uid} onChange={setStr('wfh_uid')} />
              </div>
              <div className="space-y-2">
                <Label>WFH User Name</Label>
                <Input value={form.user_name} onChange={setStr('user_name')} />
              </div>
              <div className="space-y-2">
                <Label>WFH User Email</Label>
                <Input type="email" value={form.user_email} onChange={setStr('user_email')} />
              </div>
              <div className="space-y-2">
                <Label>WFH Location</Label>
                <Input placeholder="e.g. Home - Mumbai" value={form.wfh_location_text} onChange={setStr('wfh_location_text')} />
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <QrCode className="h-4 w-4" />}
            Register Asset &amp; Generate QR Code
          </Button>
        </div>
      </form>

      {/* ── QR Success Dialog ── */}
      <Dialog open={!!qrSuccess} onOpenChange={(open) => { if (!open) { setQrSuccess(null); navigate('/assets'); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-green-600" />
              Asset Registered
            </DialogTitle>
          </DialogHeader>
          {qrSuccess && (
            <div className="space-y-4 text-center">
              <div>
                <p className="font-semibold text-lg">{qrSuccess.name}</p>
                <p className="text-sm text-muted-foreground">{qrSuccess.assetId}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{qrSuccess.qrUid}</p>
              </div>
              <div className="flex justify-center">
                <QRCodeSVG
                  id="qr-svg-export"
                  value={qrSuccess.qrPayload || qrSuccess.qrUid}
                  size={180}
                  marginSize={4}
                />
              </div>
              <p className="text-xs text-muted-foreground">Scan this QR code to identify the asset.</p>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={handleDownloadQR} className="gap-1">
              <Download className="h-3.5 w-3.5" /> Download QR
            </Button>
            <Button size="sm" onClick={() => { setQrSuccess(null); navigate('/assets'); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
