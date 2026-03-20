import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCycles, createCycle, updateCycle, activateCycle, closeCycle,
  VerificationCycle, CycleCreate, CycleUpdate,
} from '@/services/adminService';
import { Plus, Edit, Play, X } from 'lucide-react';

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

const STATUS_FILTERS = ['all', 'draft', 'active', 'closed'];

function statusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'closed': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

const EMPTY_CREATE: CycleCreate = { name: '', code: '', description: '', start_date: '', end_date: '' };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCyclesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CycleCreate>(EMPTY_CREATE);

  const [editOpen, setEditOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<VerificationCycle | null>(null);
  const [editForm, setEditForm] = useState<CycleUpdate>({ name: '', description: '', start_date: '', end_date: '' });

  const [confirmAction, setConfirmAction] = useState<{ type: 'activate' | 'close'; cycle: VerificationCycle } | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['admin', 'cycles', statusFilter],
    queryFn: () => fetchCycles({ status: statusFilter === 'all' ? undefined : statusFilter }),
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (p: CycleCreate) => createCycle(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cycles'] });
      toast({ title: 'Cycle created' });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CycleUpdate }) => updateCycle(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cycles'] });
      toast({ title: 'Cycle updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cycles'] });
      toast({ title: 'Cycle activated' });
      setConfirmAction(null);
    },
    onError: (err) => { toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }); setConfirmAction(null); },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cycles'] });
      toast({ title: 'Cycle closed' });
      setConfirmAction(null);
    },
    onError: (err) => { toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }); setConfirmAction(null); },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function openEdit(c: VerificationCycle) {
    setEditCycle(c);
    setEditForm({ name: c.name, description: c.description ?? '', start_date: c.start_date, end_date: c.end_date });
    setEditOpen(true);
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === 'activate') activateMutation.mutate(confirmAction.cycle.id);
    else closeMutation.mutate(confirmAction.cycle.id);
  }

  const isPending = activateMutation.isPending || closeMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Verification Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1">
              {STATUS_FILTERS.map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New Cycle
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (cycles as VerificationCycle[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No cycles found</TableCell></TableRow>
                ) : (cycles as VerificationCycle[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.start_date}</TableCell>
                    <TableCell className="text-sm">{c.end_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(c.status)}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.request_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(c.status === 'draft' || c.status === 'active') && (
                          <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                            <Edit className="h-3 w-3 mr-1" />Edit
                          </Button>
                        )}
                        {c.status === 'draft' && (
                          <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => setConfirmAction({ type: 'activate', cycle: c })}>
                            <Play className="h-3 w-3 mr-1" />Activate
                          </Button>
                        )}
                        {c.status === 'active' && (
                          <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => setConfirmAction({ type: 'close', cycle: c })}>
                            <X className="h-3 w-3 mr-1" />Close
                          </Button>
                        )}
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
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm(EMPTY_CREATE); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Verification Cycle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. CYCLE-2024-Q1" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={createForm.description ?? ''} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input type="date" value={createForm.start_date} onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End Date *</Label>
                <Input type="date" value={createForm.end_date} onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.name || !createForm.code || !createForm.start_date || !createForm.end_date}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditCycle(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cycle — {editCycle?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={editForm.start_date ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={editForm.end_date ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editCycle && updateMutation.mutate({ id: editCycle.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(v) => { if (!v) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'activate' ? 'Activate Cycle' : 'Close Cycle'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.type === 'activate'
              ? `Are you sure you want to activate "${confirmAction.cycle.name}"? This will make it the active cycle.`
              : `Are you sure you want to close "${confirmAction?.cycle.name}"? This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className={confirmAction?.type === 'activate' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {isPending ? 'Processing...' : confirmAction?.type === 'activate' ? 'Activate' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
