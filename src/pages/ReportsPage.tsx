import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { fetchReconciliationReport, fetchDiscrepancyReport, fetchAuditReport, getReconciliationCsvUrl, getDiscrepancyCsvUrl, getAuditCsvUrl } from '@/services/reportService';
import { fetchLocationTree } from '@/services/locationService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function ReportsPage() {
  const { toast } = useToast();
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const reportParams: Record<string, string> = {};
  if (locationFilter !== 'all') reportParams.location_id = locationFilter;
  if (dateFrom) reportParams.date_from = dateFrom;
  if (dateTo) reportParams.date_to = dateTo;

  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ['report-reconciliation', reportParams],
    queryFn: () => fetchReconciliationReport(reportParams),
  });

  const { data: discrepancyData, isLoading: discrepancyLoading } = useQuery({
    queryKey: ['report-discrepancy', reportParams],
    queryFn: () => fetchDiscrepancyReport(reportParams),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['report-audit', reportParams],
    queryFn: () => fetchAuditReport(reportParams),
  });

  const { data: locationTree } = useQuery({
    queryKey: ['locationTree'],
    queryFn: fetchLocationTree,
    staleTime: 5 * 60 * 1000,
  });

  const flatLocations = (nodes: any[]): { id: string; name: string }[] => {
    const result: { id: string; name: string }[] = [];
    const walk = (list: any[]) => { for (const n of list) { result.push({ id: n.id, name: n.name }); if (n.children) walk(n.children); } };
    walk(nodes || []);
    return result;
  };
  const locations = flatLocations(locationTree || []);

  const reconRows = Array.isArray(reconData) ? reconData : reconData?.results ?? reconData?.data ?? [];
  const discrepancyRows = Array.isArray(discrepancyData) ? discrepancyData : discrepancyData?.results ?? discrepancyData?.data ?? [];
  const auditRows = Array.isArray(auditData) ? auditData : auditData?.results ?? auditData?.data ?? [];

  const handleExportCsv = (type: 'reconciliation' | 'discrepancy' | 'audit') => {
    const urlFn = { reconciliation: getReconciliationCsvUrl, discrepancy: getDiscrepancyCsvUrl, audit: getAuditCsvUrl }[type];
    const url = urlFn(reportParams);
    window.open(url, '_blank');
    toast({ title: 'Export Started', description: 'CSV download initiated.' });
  };

  const filterBar = (
    <div className="flex flex-wrap gap-2 mb-4">
      <Select value={locationFilter} onValueChange={setLocationFilter}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Location" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" className="w-[160px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      <Input type="date" className="w-[160px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
    </div>
  );

  const loadingBlock = <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Reports</h1>

      <Tabs defaultValue="reconciliation">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="reconciliation"><ClipboardList className="mr-1 h-4 w-4 hidden md:inline" /> Reconciliation</TabsTrigger>
          <TabsTrigger value="discrepancy"><AlertTriangle className="mr-1 h-4 w-4 hidden md:inline" /> Discrepancy</TabsTrigger>
          <TabsTrigger value="audit"><FileText className="mr-1 h-4 w-4 hidden md:inline" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Reconciliation Report</CardTitle>
              <Button size="sm" onClick={() => handleExportCsv('reconciliation')}><Download className="mr-1 h-3 w-3" /> Export CSV</Button>
            </CardHeader>
            <CardContent>
              {filterBar}
              {reconLoading ? loadingBlock : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconRows.map((r: any, i: number) => (
                        <TableRow key={r.id ?? i}>
                          <TableCell className="font-medium">{r.locationName ?? r.location_name ?? '—'}</TableCell>
                          <TableCell>{r.total ?? r.totalAssets ?? 0}</TableCell>
                          <TableCell className="text-success">{r.verified ?? r.verifiedAssets ?? 0}</TableCell>
                          <TableCell className="text-warning">{(r.total ?? r.totalAssets ?? 0) - (r.verified ?? r.verifiedAssets ?? 0)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {r.total ? Math.round(((r.verified ?? r.verifiedAssets ?? 0) / r.total) * 100) : 0}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reconRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No data available.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancy" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Asset Discrepancy Report</CardTitle>
              <Button size="sm" onClick={() => handleExportCsv('discrepancy')}><Download className="mr-1 h-3 w-3" /> Export</Button>
            </CardHeader>
            <CardContent>
              {filterBar}
              {discrepancyLoading ? loadingBlock : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discrepancyRows.map((a: any, i: number) => (
                        <TableRow key={a.id ?? i}>
                          <TableCell className="font-mono text-xs">{a.assetId ?? a.asset_id ?? '—'}</TableCell>
                          <TableCell>{a.name ?? a.assetName ?? '—'}</TableCell>
                          <TableCell>{a.locationName ?? a.location_name ?? '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Discrepancy</Badge></TableCell>
                        </TableRow>
                      ))}
                      {discrepancyRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No discrepancies found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Movement Audit Log</CardTitle>
              <Button size="sm" onClick={() => handleExportCsv('audit')}><Download className="mr-1 h-3 w-3" /> Export</Button>
            </CardHeader>
            <CardContent>
              {filterBar}
              {auditLoading ? loadingBlock : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditRows.map((e: any, i: number) => (
                        <TableRow key={e.id ?? i}>
                          <TableCell className="text-xs">{e.timestamp ?? e.date ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{e.assetId ?? e.asset_id ?? '—'}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{e.action ?? e.event_type ?? '—'}</Badge></TableCell>
                          <TableCell className="text-sm">{e.performedByName ?? e.performed_by_name ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.description ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                      {auditRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No audit logs found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
