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
  fetchLocationTypes, fetchLocations, createLocation, updateLocation,
  LocationType, Location, LocationCreate, LocationUpdate,
} from '@/services/adminService';
import { Search, Plus, Edit } from 'lucide-react';

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
// Page
// ---------------------------------------------------------------------------

const EMPTY_CREATE: LocationCreate = { location_type_id: '', parent_id: null, code: '', name: '' };
const EMPTY_EDIT: LocationUpdate & { is_active: boolean } = { name: '', is_active: true };

export default function AdminLocationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LocationCreate & { parent_id_str: string; location_type_id_str: string }>({
    ...EMPTY_CREATE,
    parent_id_str: '',
    location_type_id_str: '',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState<LocationUpdate & { is_active: boolean }>(EMPTY_EDIT);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: locationTypes = [] } = useQuery({
    queryKey: ['admin', 'location-types'],
    queryFn: fetchLocationTypes,
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['admin', 'locations', search, typeFilter],
    queryFn: () => fetchLocations({
      search: search || undefined,
      location_type: typeFilter || undefined,
    }),
  });

  const { data: allLocations = [] } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: () => fetchLocations(),
    enabled: createOpen,
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: LocationCreate) => createLocation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] });
      toast({ title: 'Location created' });
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_CREATE, parent_id_str: '', location_type_id_str: '' });
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LocationUpdate }) => updateLocation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] });
      toast({ title: 'Location updated' });
      setEditOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: getErrMsg(err), variant: 'destructive' }),
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSearch() {
    setSearch(searchInput);
  }

  function openEdit(loc: Location) {
    setEditLocation(loc);
    setEditForm({ name: loc.name, is_active: loc.is_active });
    setEditOpen(true);
  }

  function handleCreate() {
    const payload: LocationCreate = {
      location_type_id: createForm.location_type_id_str,
      parent_id: createForm.parent_id_str || null,
      code: createForm.code,
      name: createForm.name,
    };
    createMutation.mutate(payload);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Location Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Search locations..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-56"
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
              <Select
                value={typeFilter || '__all__'}
                onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All types..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {(locationTypes as LocationType[]).map((lt) => (
                    <SelectItem key={lt.id} value={lt.code}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New Location
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (locations as Location[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No locations found</TableCell></TableRow>
                ) : (locations as Location[]).map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{loc.name}</span>
                        {loc.path && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={loc.path}>{loc.path}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{loc.code}</TableCell>
                    <TableCell><Badge variant="outline">{loc.location_type_name}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{loc.parent_name || '—'}</TableCell>
                    <TableCell className="text-sm">{loc.depth}</TableCell>
                    <TableCell>
                      <Badge variant={loc.is_active ? 'default' : 'secondary'} className={loc.is_active ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEdit(loc)}>
                        <Edit className="h-3 w-3 mr-1" />Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateForm({ ...EMPTY_CREATE, parent_id_str: '', location_type_id_str: '' }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Location Type *</Label>
              <Select
                value={createForm.location_type_id_str}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, location_type_id_str: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {(locationTypes as LocationType[]).map((lt) => (
                    <SelectItem key={lt.id} value={String(lt.id)}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Parent Location (optional)</Label>
              <Select
                value={createForm.parent_id_str || '__none__'}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, parent_id_str: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="No parent (root)..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent (root)</SelectItem>
                  {(allLocations as Location[]).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} [{l.location_type_name}]
                    </SelectItem>
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
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createForm.location_type_id_str || !createForm.code || !createForm.name}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditLocation(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Location — {editLocation?.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={editForm.is_active} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: !!v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editLocation && updateMutation.mutate({ id: editLocation.id, payload: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
