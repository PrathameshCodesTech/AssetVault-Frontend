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
import { useToast } from '@/hooks/use-toast';
import {
  fetchAdminUsers, createAdminUser, updateAdminUser,
  fetchAdminAssignments, createAdminAssignment, updateAdminAssignment,
  fetchAdminRoles, fetchLocations,
  AdminUser, AdminUserCreate, AdminUserUpdate, Assignment, AssignmentCreate, Role, Location,
} from '@/services/adminService';
import { Search, Plus, Edit, Users } from 'lucide-react';

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

const EMPTY_USER_FORM: AdminUserCreate = { email: '', first_name: '', last_name: '', employee_code: '', phone: '' };
const EMPTY_EDIT_FORM: AdminUserUpdate & { is_active: boolean } = { first_name: '', last_name: '', employee_code: '', phone: '', is_active: true };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AdminUserCreate>(EMPTY_USER_FORM);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<AdminUserUpdate & { is_active: boolean }>(EMPTY_EDIT_FORM);

  // Assignments dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<AdminUser | null>(null);

  // Add assignment dialog
  const [addAssignOpen, setAddAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ role_id: string; location_id: string; is_primary: boolean }>({
    role_id: '', location_id: '', is_primary: false,
  });
  const [editAssignOpen, setEditAssignOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [editAssignForm, setEditAssignForm] = useState<{ location_id: string; is_primary: boolean; is_active: boolean }>({
    location_id: '',
    is_primary: false,
    is_active: true,
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users', search, showActiveOnly],
    queryFn: () => fetchAdminUsers({ search: search || undefined, is_active: showActiveOnly ? true : undefined }),
  });

  const { data: userAssignments = [] } = useQuery({
    queryKey: ['admin', 'assignments', 'user', assignUser?.id],
    queryFn: () => fetchAdminAssignments({ user_id: assignUser!.id }),
    enabled: !!assignUser,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => fetchAdminRoles(),
    enabled: addAssignOpen,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: () => fetchLocations(),
    enabled: addAssignOpen || editAssignOpen,
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: AdminUserCreate) => createAdminUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'User created successfully' });
      setCreateOpen(false);
      setCreateForm(EMPTY_USER_FORM);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUserUpdate }) => updateAdminUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'User updated successfully' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const addAssignMutation = useMutation({
    mutationFn: (payload: AssignmentCreate) => createAdminAssignment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'assignments', 'user', assignUser?.id] });
      toast({ title: 'Assignment added' });
      setAddAssignOpen(false);
      setAssignForm({ role_id: '', location_id: '', is_primary: false });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const deactivateAssignMutation = useMutation({
    mutationFn: (id: string) => updateAdminAssignment(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'assignments', 'user', assignUser?.id] });
      toast({ title: 'Assignment deactivated' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const editAssignMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { location_id?: string | null; is_primary?: boolean; is_active?: boolean } }) =>
      updateAdminAssignment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'assignments', 'user', assignUser?.id] });
      toast({ title: 'Assignment updated' });
      setEditAssignOpen(false);
      setEditAssignment(null);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, employee_code: u.employee_code, phone: u.phone, is_active: u.is_active });
    setEditOpen(true);
  }

  function openAssignments(u: AdminUser) {
    setAssignUser(u);
    setAssignOpen(true);
  }

  function openEditAssignment(a: Assignment) {
    setEditAssignment(a);
    setEditAssignForm({
      location_id: a.location_id ?? '',
      is_primary: a.is_primary,
      is_active: a.is_active,
    });
    setEditAssignOpen(true);
  }

  function handleSearch() {
    setSearch(searchInput);
  }

  function handleAddAssignment() {
    if (!assignUser || !assignForm.role_id) return;
    const payload: AssignmentCreate = {
      user_id: assignUser.id,
      role_id: assignForm.role_id,
      location_id: assignForm.location_id || null,
      is_primary: assignForm.is_primary,
    };
    addAssignMutation.mutate(payload);
  }

  function handleEditAssignment() {
    if (!editAssignment) return;
    editAssignMutation.mutate({
      id: editAssignment.id,
      payload: {
        location_id: editAssignForm.location_id || null,
        is_primary: editAssignForm.is_primary,
        is_active: editAssignForm.is_active,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Search by email or name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox checked={showActiveOnly} onCheckedChange={(v) => setShowActiveOnly(!!v)} />
                Active only
              </label>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New User
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.first_name} {u.last_name}</TableCell>
                    <TableCell>{u.employee_code || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'secondary'} className={u.is_active ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.role_summary.map((r) => r.role_name).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAssignments(u)}>
                          <Users className="h-3 w-3 mr-1" />Assignments
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm(EMPTY_USER_FORM); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(['email', 'first_name', 'last_name', 'employee_code', 'phone'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={field} className="capitalize">{field.replace('_', ' ')}{['email', 'first_name', 'last_name'].includes(field) ? ' *' : ''}</Label>
                <Input
                  id={field}
                  value={createForm[field] ?? ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
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
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(['first_name', 'last_name', 'employee_code', 'phone'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`edit-${field}`} className="capitalize">{field.replace('_', ' ')}</Label>
                <Input
                  id={`edit-${field}`}
                  value={editForm[field] ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                />
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
              onClick={() => editUser && updateMutation.mutate({ id: editUser.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Dialog */}
      <Dialog open={assignOpen} onOpenChange={(v) => { setAssignOpen(v); if (!v) setAssignUser(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>Assignments — {assignUser?.email}</DialogTitle>
              <Button size="sm" onClick={() => setAddAssignOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            </div>
          </DialogHeader>
          <div className="rounded-md border max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Primary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAssignments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No assignments</TableCell></TableRow>
                ) : userAssignments.map((a: Assignment) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.role_name}</TableCell>
                    <TableCell>{a.location_name || '—'}</TableCell>
                    <TableCell>{a.is_primary && <Badge className="bg-blue-100 text-blue-800">Primary</Badge>}</TableCell>
                    <TableCell>
                      <Badge variant={a.is_active ? 'default' : 'secondary'} className={a.is_active ? 'bg-green-100 text-green-800' : ''}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEditAssignment(a)}>
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                        {a.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deactivateAssignMutation.mutate(a.id)}
                            disabled={deactivateAssignMutation.isPending}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Assignment Dialog */}
      <Dialog open={addAssignOpen} onOpenChange={(v) => { setAddAssignOpen(v); if (!v) setAssignForm({ role_id: '', location_id: '', is_primary: false }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={assignForm.role_id} onValueChange={(v) => setAssignForm((f) => ({ ...f, role_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                <SelectContent>
                  {(roles as Role[]).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location (optional)</Label>
              <Select
                value={assignForm.location_id || '__none__'}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, location_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific location</SelectItem>
                  {(locations as Location[]).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.location_type_name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={assignForm.is_primary} onCheckedChange={(v) => setAssignForm((f) => ({ ...f, is_primary: !!v }))} />
              <span className="text-sm">Primary assignment</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAssignment} disabled={addAssignMutation.isPending || !assignForm.role_id}>
              {addAssignMutation.isPending ? 'Adding...' : 'Add Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={editAssignOpen} onOpenChange={(v) => { setEditAssignOpen(v); if (!v) setEditAssignment(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Role</Label>
              <Input value={editAssignment?.role_name ?? ''} disabled />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Select
                value={editAssignForm.location_id || '__none__'}
                onValueChange={(v) => setEditAssignForm((f) => ({ ...f, location_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific location</SelectItem>
                  {(locations as Location[]).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.location_type_name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editAssignForm.is_primary} onCheckedChange={(v) => setEditAssignForm((f) => ({ ...f, is_primary: !!v }))} />
              <span className="text-sm">Primary assignment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editAssignForm.is_active} onCheckedChange={(v) => setEditAssignForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleEditAssignment} disabled={editAssignMutation.isPending}>
              {editAssignMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
