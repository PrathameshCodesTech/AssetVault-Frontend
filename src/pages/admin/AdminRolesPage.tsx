import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAdminRoles, createAdminRole, updateAdminRole,
  fetchAdminRole, assignPermissionToRole, removePermissionFromRole,
  fetchAdminPermissions, fetchPermissionTemplates, applyTemplateToRole,
  Role, RoleDetail, RoleCreate, RoleUpdate, Permission, PermissionTemplate,
} from '@/services/adminService';
import { Plus, Edit, Settings, X, ShieldCheck } from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Roles Section
// ---------------------------------------------------------------------------

function RolesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RoleCreate>({ code: '', name: '', description: '', template_id: '' });

  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editForm, setEditForm] = useState<RoleUpdate & { is_active: boolean }>({ name: '', description: '', is_active: true });

  const [manageOpen, setManageOpen] = useState(false);
  const [manageRoleId, setManageRoleId] = useState<string | null>(null);
  const [addPermId, setAddPermId] = useState('');
  const [applyTemplateId, setApplyTemplateId] = useState('');

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: fetchAdminRoles,
  });

  const { data: roleDetail } = useQuery({
    queryKey: ['admin', 'role', manageRoleId],
    queryFn: () => fetchAdminRole(manageRoleId!),
    enabled: !!manageRoleId,
  });

  const { data: allPerms = [] } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => fetchAdminPermissions(),
    enabled: manageOpen,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['admin', 'permission-templates'],
    queryFn: fetchPermissionTemplates,
    enabled: createOpen || manageOpen,
  });

  const createMutation = useMutation({
    mutationFn: (p: RoleCreate) => createAdminRole(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast({ title: 'Role created' });
      setCreateOpen(false);
      setCreateForm({ code: '', name: '', description: '', template_id: '' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RoleUpdate }) => updateAdminRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast({ title: 'Role updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const assignPermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) => assignPermissionToRole(roleId, permId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', manageRoleId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast({ title: 'Permission assigned' });
      setAddPermId('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const removePermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) => removePermissionFromRole(roleId, permId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', manageRoleId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast({ title: 'Permission removed' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: ({ roleId, templateId }: { roleId: string; templateId: string }) =>
      applyTemplateToRole(roleId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', manageRoleId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast({ title: 'Template applied — permissions replaced' });
      setApplyTemplateId('');
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  function openEdit(r: Role) {
    setEditRole(r);
    setEditForm({ name: r.name, description: r.description ?? '', is_active: r.is_active });
    setEditOpen(true);
  }

  function openManage(r: Role) {
    setManageRoleId(r.id);
    setManageOpen(true);
  }

  const currentPermIds = new Set((roleDetail as RoleDetail | undefined)?.permissions?.map((p) => p.id) ?? []);
  const availablePerms = (allPerms as Permission[]).filter((p) => !currentPermIds.has(p.id));

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New Role
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (roles as Role[]).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No roles found</TableCell></TableRow>
            ) : (roles as Role[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.permission_count}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? 'default' : 'secondary'} className={r.is_active ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      <Edit className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openManage(r)}>
                      <Settings className="h-3 w-3 mr-1" />Permissions
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm({ code: '', name: '', description: '', template_id: '' }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. location_admin" />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={createForm.description ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Start from Template <span className="text-muted-foreground text-xs">(optional — seeds initial permissions)</span></Label>
              <Select value={createForm.template_id ?? ''} onValueChange={(v) => setCreateForm((f) => ({ ...f, template_id: v || undefined }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No template — start empty" />
                </SelectTrigger>
                <SelectContent>
                  {(templates as PermissionTemplate[]).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} <span className="text-muted-foreground text-xs">({t.permissions.length} perms)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ ...createForm, template_id: createForm.template_id || undefined })}
              disabled={createMutation.isPending || !createForm.code || !createForm.name}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditRole(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Role — {editRole?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editRole && updateMutation.mutate({ id: editRole.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={manageOpen} onOpenChange={(v) => { setManageOpen(v); if (!v) { setManageRoleId(null); setAddPermId(''); setApplyTemplateId(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage Permissions</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Current permissions */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Current Permissions</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                {(roleDetail as RoleDetail | undefined)?.permissions?.length === 0 && (
                  <span className="text-sm text-muted-foreground">No permissions assigned</span>
                )}
                {(roleDetail as RoleDetail | undefined)?.permissions?.map((p) => (
                  <Badge key={p.id} variant="secondary" className="flex items-center gap-1">
                    {p.code}
                    <button
                      onClick={() => manageRoleId && removePermMutation.mutate({ roleId: manageRoleId, permId: p.id })}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Add individual permission */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Add Permission</Label>
              <div className="flex gap-2">
                <Select value={addPermId} onValueChange={setAddPermId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select permission..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePerms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => manageRoleId && addPermId && assignPermMutation.mutate({ roleId: manageRoleId, permId: addPermId })}
                  disabled={!addPermId || assignPermMutation.isPending}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Apply template (bulk-replace) */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm font-medium flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                Apply Template <span className="text-muted-foreground text-xs font-normal">(replaces all current permissions)</span>
              </Label>
              <div className="flex gap-2">
                <Select value={applyTemplateId} onValueChange={setApplyTemplateId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates as PermissionTemplate[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.permissions.length} perms)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => manageRoleId && applyTemplateId && applyTemplateMutation.mutate({ roleId: manageRoleId, templateId: applyTemplateId })}
                  disabled={!applyTemplateId || applyTemplateMutation.isPending}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Permissions Catalog Section (read-only, grouped by module)
// ---------------------------------------------------------------------------

function PermissionsCatalogSection() {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => fetchAdminPermissions(),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'permission-templates'],
    queryFn: fetchPermissionTemplates,
  });

  // Group permissions by module
  const byModule: Record<string, Permission[]> = {};
  for (const p of permissions as Permission[]) {
    if (!byModule[p.module]) byModule[p.module] = [];
    byModule[p.module].push(p);
  }

  return (
    <div className="space-y-6">
      {/* Permission templates */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Permission Templates</h3>
        {templatesLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(templates as PermissionTemplate[]).map((t) => (
              <div key={t.id} className="border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline" className="text-xs">{t.permissions.length} perms</Badge>
                </div>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                <div className="flex flex-wrap gap-1 pt-1">
                  {t.permissions.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-xs font-mono">{p.code}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full permission catalog */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Full Permission Catalog</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byModule).sort(([a], [b]) => a.localeCompare(b)).map(([module, perms]) => (
              <div key={module}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{module}</p>
                <div className="rounded-md border">
                  <Table>
                    <TableBody>
                      {perms.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-sm w-48">{p.code}</TableCell>
                          <TableCell className="text-sm">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant={p.is_active ? 'default' : 'secondary'} className={p.is_active ? 'bg-green-100 text-green-800 border-green-200 text-xs' : 'text-xs'}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminRolesPage() {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Roles &amp; Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="roles">
            <TabsList className="mb-4">
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permission Catalog</TabsTrigger>
            </TabsList>
            <TabsContent value="roles">
              <RolesSection />
            </TabsContent>
            <TabsContent value="permissions">
              <PermissionsCatalogSection />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
