import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCategories, createCategory, updateCategory,
  fetchSubTypes, createSubType, updateSubType,
  fetchEntities, createEntity, updateEntity,
  fetchCostCenters, createCostCenter, updateCostCenter,
  fetchSuppliers, createSupplier, updateSupplier,
  LookupItem, SubType, Supplier,
} from '@/services/adminService';
import { Plus, Edit } from 'lucide-react';

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'default' : 'secondary'} className={active ? 'bg-green-100 text-green-800 border-green-200' : ''}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Generic Lookup Tab (for Categories, Entities, Cost Centers)
// ---------------------------------------------------------------------------

interface GenericTabProps {
  queryKey: string[];
  fetcher: () => Promise<LookupItem[]>;
  creator: (p: { code: string; name: string }) => Promise<LookupItem>;
  updater: (id: string, p: { name?: string; is_active?: boolean }) => Promise<LookupItem>;
  label: string;
}

function GenericLookupTab({ queryKey, fetcher, creator, updater, label }: GenericTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<LookupItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', is_active: true });

  const { data: items = [], isLoading } = useQuery({ queryKey, queryFn: fetcher });

  const createMutation = useMutation({
    mutationFn: creator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: `${label} created` });
      setCreateOpen(false);
      setCreateForm({ code: '', name: '' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; is_active?: boolean } }) => updater(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: `${label} updated` });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  function openEdit(item: LookupItem) {
    setEditItem(item);
    setEditForm({ name: item.name, is_active: item.is_active });
    setEditOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New {label}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (items as LookupItem[]).length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No {label.toLowerCase()}s found</TableCell></TableRow>
            ) : (items as LookupItem[]).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell><StatusBadge active={item.is_active} /></TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Edit className="h-3 w-3 mr-1" />Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm({ code: '', name: '' }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New {label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(createForm)} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {label} — {editItem?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editItem && updateMutation.mutate({ id: editItem.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// SubTypes Tab
// ---------------------------------------------------------------------------

function SubTypesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ category_id: '', code: '', name: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<SubType | null>(null);
  const [editForm, setEditForm] = useState({ name: '', is_active: true });

  const { data: subtypes = [], isLoading } = useQuery({
    queryKey: ['admin', 'subtypes'],
    queryFn: () => fetchSubTypes(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => fetchCategories(),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: () => createSubType({ category_id: createForm.category_id, code: createForm.code, name: createForm.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subtypes'] });
      toast({ title: 'Sub-Type created' });
      setCreateOpen(false);
      setCreateForm({ category_id: '', code: '', name: '' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; is_active?: boolean } }) => updateSubType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subtypes'] });
      toast({ title: 'Sub-Type updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  function openEdit(item: SubType) {
    setEditItem(item);
    setEditForm({ name: item.name, is_active: item.is_active });
    setEditOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New Sub-Type
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (subtypes as SubType[]).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sub-types found</TableCell></TableRow>
            ) : (subtypes as SubType[]).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell><Badge variant="outline">{item.category_name}</Badge></TableCell>
                <TableCell><StatusBadge active={item.is_active} /></TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Edit className="h-3 w-3 mr-1" />Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm({ category_id: '', code: '', name: '' }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Sub-Type</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={createForm.category_id} onValueChange={(v) => setCreateForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {(categories as LookupItem[]).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.category_id}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Sub-Type — {editItem?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editItem && updateMutation.mutate({ id: editItem.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Suppliers Tab
// ---------------------------------------------------------------------------

function SuppliersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', email: '', phone: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', is_active: true });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['admin', 'suppliers'],
    queryFn: () => fetchSuppliers(),
  });

  const createMutation = useMutation({
    mutationFn: () => createSupplier({ code: createForm.code, name: createForm.name, email: createForm.email || undefined, phone: createForm.phone || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'suppliers'] });
      toast({ title: 'Supplier created' });
      setCreateOpen(false);
      setCreateForm({ code: '', name: '', email: '', phone: '' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; email?: string; phone?: string; is_active?: boolean } }) => updateSupplier(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'suppliers'] });
      toast({ title: 'Supplier updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  function openEdit(item: Supplier) {
    setEditItem(item);
    setEditForm({ name: item.name, email: item.email ?? '', phone: item.phone ?? '', is_active: item.is_active });
    setEditOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New Supplier
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (suppliers as Supplier[]).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
            ) : (suppliers as Supplier[]).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.email || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.phone || '—'}</TableCell>
                <TableCell><StatusBadge active={item.is_active} /></TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Edit className="h-3 w-3 mr-1" />Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm({ code: '', name: '', email: '', phone: '' }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(['code', 'name', 'email', 'phone'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="capitalize">{field}{['code', 'name'].includes(field) ? ' *' : ''}</Label>
                <Input value={createForm[field]} onChange={(e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Supplier — {editItem?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(['name', 'email', 'phone'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="capitalize">{field}</Label>
                <Input value={editForm[field]} onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editItem && updateMutation.mutate({ id: editItem.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminLookupsPage() {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lookups Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="categories">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="subtypes">Sub-Types</TabsTrigger>
              <TabsTrigger value="entities">Business Entities</TabsTrigger>
              <TabsTrigger value="costcenters">Cost Centers</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="categories">
              <GenericLookupTab
                queryKey={['admin', 'categories']}
                fetcher={fetchCategories}
                creator={createCategory}
                updater={updateCategory}
                label="Category"
              />
            </TabsContent>

            <TabsContent value="subtypes">
              <SubTypesTab />
            </TabsContent>

            <TabsContent value="entities">
              <GenericLookupTab
                queryKey={['admin', 'entities']}
                fetcher={fetchEntities}
                creator={createEntity}
                updater={updateEntity}
                label="Business Entity"
              />
            </TabsContent>

            <TabsContent value="costcenters">
              <GenericLookupTab
                queryKey={['admin', 'costcenters']}
                fetcher={fetchCostCenters}
                creator={createCostCenter}
                updater={updateCostCenter}
                label="Cost Center"
              />
            </TabsContent>

            <TabsContent value="suppliers">
              <SuppliersTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
