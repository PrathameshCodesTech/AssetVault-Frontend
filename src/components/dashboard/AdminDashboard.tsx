import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Package, ClipboardCheck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { downloadAsExcel } from '@/lib/exportUtils';
import ChartDownloadBtn from './ChartDownloadBtn';
import { DashboardSummary } from '@/types';

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(215, 60%, 24%)', 'hsl(280, 60%, 50%)', 'hsl(160, 60%, 40%)', 'hsl(30, 80%, 55%)'];

interface Props {
  summary: DashboardSummary;
  extraData?: any;
}

export default function AdminDashboard({ summary, extraData }: Props) {
  const progress = summary.reconciliationProgress;
  const categoryBreakdown: { categoryName: string; count: number }[] = extraData?.categoryBreakdown ?? [];
  const categoryPieData = categoryBreakdown.map((c) => ({ name: c.categoryName, value: c.count }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Assets', value: summary.totalAssets, icon: Package, color: 'text-accent' },
          { label: 'Verified', value: summary.verifiedAssets, icon: CheckCircle2, color: 'text-success' },
          { label: 'Pending', value: summary.pendingReconciliation, icon: ClipboardCheck, color: 'text-warning' },
          { label: 'Discrepancies', value: summary.discrepancies, icon: AlertTriangle, color: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="text-2xl font-bold">{s.value.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Reconciliation Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{summary.verifiedAssets} of {summary.totalAssets} assets</span>
            <span className="font-bold text-accent">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assets by Location</CardTitle>
              <ChartDownloadBtn onClick={() => downloadAsExcel(
                summary.locationBreakdown.map((d) => ({ Location: d.locationName, Total: d.total, Verified: d.verified })),
                'branch-assets-by-location'
              )} />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={summary.locationBreakdown.map((l) => ({ name: l.locationName?.split(' - ')[0] ?? '', verified: l.verified, pending: l.total - l.verified }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="verified" stackId="a" fill="hsl(142, 71%, 45%)" />
                <Bar dataKey="pending" stackId="a" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {categoryPieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Category Distribution</CardTitle>
                <ChartDownloadBtn onClick={() => downloadAsExcel(
                  categoryPieData.map((d) => ({ Category: d.name, 'Asset Count': d.value })),
                  'branch-category-distribution'
                )} />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          {summary.recentActivity.map((a) => (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <div className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />
              <div>
                <p className="font-medium">{a.description}</p>
                <p className="text-xs text-muted-foreground">{a.performedByName} · {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : ''}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
