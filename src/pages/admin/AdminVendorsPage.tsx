import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  fetchVendors, createVendor, updateVendor,
  fetchVendorUsers, addVendorUser, removeVendorUser,
  VendorOrganization, VendorOrganizationCreate, VendorUserAssignment,
} from '@/services/vendorService';
import { fetchAdminUsers } from '@/services/adminService';
import { Plus, Edit, Users, X } from 'lucide-react';

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

const EMPTY_FORM: VendorOrganizationCreate = { code: '', name: '', contact_email: '', contact_phone: '', notes: '' };

export default function AdminVendorsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<VendorOrganizationCreate>(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<VendorOrganization | null>(null);
  const [editForm, setEditForm] = useState<Partial<VendorOrganizationCreate & { is_active: boolean }>>({});

  const [usersOpen, setUsersOpen] = useState(false);
  const [usersVendor, setUsersVendor] = useState<VendorOrganization | null>(null);
  const [addUserId, setAddUserId] = useState('');

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['admin', 'vendors'],
    queryFn: () => fetchVendors(),
  });

  const { data: vendorUsers = [] } = useQuery({
    queryKey: ['admin', 'vendor-users', usersVendor?.id],
    queryFn: () => fetchVendorUsers(usersVendor!.id),
    enabled: !!usersVendor,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchAdminUsers(),
    enabled: usersOpen,
  });

  const createMutation = useMutation({
    mutationFn: (p: VendorOrganizationCreate) => createVendor(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast({ title: 'Vendor created' });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof editForm }) => updateVendor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast({ title: 'Vendor updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const addUserMutation = useMutation({
    mutationFn: ({ vendorId, userId }: { vendorId: string; userId: string }) => addVendorUser(vendorId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-users', usersVendor?.id] });
      toast({ title: 'User added to vendor' });
      setAddUserId('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const removeUserMutation = useMutation({
    mutationFn: ({ vendorId, assignmentId }: { vendorId: string; assignmentId: string }) =>
      removeVendorUser(vendorId, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendor-users', usersVendor?.id] });
      toast({ title: 'User removed from vendor' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  function openEdit(v: VendorOrganization) {
    setEditVendor(v);
    setEditForm({ name: v.name, contact_email: v.contact_email ?? '', contact_phone: v.contact_phone ?? '', notes: v.notes ?? '', is_active: v.is_active });
    setEditOpen(true);
  }

  function openUsers(v: VendorOrganization) {
    setUsersVendor(v);
    setUsersOpen(true);
  }

  // Users already assigned to this vendor
  const assignedUserIds = new Set((vendorUsers as VendorUserAssignment[]).map((a) => a.user_id));
  const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Organizations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New Vendor
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (vendors as VendorOrganization[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vendors found</TableCell></TableRow>
                ) : (vendors as VendorOrganization[]).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">{v.code}</TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.contact_email || '—'}</TableCell>
                    <TableCell>{v.user_count}</TableCell>
                    <TableCell>{v.request_count}</TableCell>
                    <TableCell>
                      <Badge variant={v.is_active ? 'default' : 'secondary'} className={v.is_active ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openUsers(v)}>
                          <Users className="h-3 w-3 mr-1" />Users
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Vendor Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm(EMPTY_FORM); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Vendor Organization</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. VENDOR-001" />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input type="email" value={createForm.contact_email ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, contact_email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input value={createForm.contact_phone ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, contact_phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={createForm.notes ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.code || !createForm.name}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditVendor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Vendor — {editVendor?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input type="email" value={editForm.contact_email ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input value={editForm.contact_phone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active ?? true} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editVendor && updateMutation.mutate({ id: editVendor.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Users Dialog */}
      <Dialog open={usersOpen} onOpenChange={(v) => { setUsersOpen(v); if (!v) { setUsersVendor(null); setAddUserId(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vendor Users — {usersVendor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Current users */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Assigned Users</Label>
              <div className="rounded-md border max-h-48 overflow-y-auto">
                <Table>
                  <TableBody>
                    {(vendorUsers as VendorUserAssignment[]).length === 0 ? (
                      <TableRow><TableCell className="text-center text-muted-foreground text-sm py-4">No users assigned</TableCell></TableRow>
                    ) : (vendorUsers as VendorUserAssignment[]).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.user_email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.user_name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => usersVendor && removeUserMutation.mutate({ vendorId: usersVendor.id, assignmentId: a.id })}
                            disabled={removeUserMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Add user */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Add User</Label>
              <div className="flex gap-2">
                <Select value={addUserId || '__none__'} onValueChange={(v) => setAddUserId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select user...</SelectItem>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.email} — {u.first_name} {u.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => usersVendor && addUserId && addUserMutation.mutate({ vendorId: usersVendor.id, userId: addUserId })}
                  disabled={!addUserId || addUserMutation.isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
