import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ClipboardCheck, CheckCircle2, ScanLine, Clock } from 'lucide-react';
import { DashboardSummary } from '@/types';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const actionIcons: Record<string, string> = {
  verified: '✅', moved: '🔄', registered: '📦', updated: '✏️', reassigned: '👤', disposed: '🗑️',
};

interface Props {
  summary: DashboardSummary;
}

export default function EmployeeDashboard({ summary }: Props) {
  const navigate = useNavigate();

  const stats = [
    { label: 'Total Assets', value: summary.totalAssets, icon: Package, color: 'text-accent' },
    { label: 'Pending', value: summary.pendingReconciliation, icon: ClipboardCheck, color: 'text-warning' },
    { label: 'Verified', value: summary.verifiedAssets, icon: CheckCircle2, color: 'text-success' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="flex flex-col items-center p-3 text-center">
                <s.icon className={`h-6 w-6 mb-1 ${s.color}`} />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
        <Button onClick={() => navigate('/scan')} className="w-full h-16 text-lg bg-accent hover:bg-accent/90 text-accent-foreground" size="lg">
          <ScanLine className="mr-3 h-6 w-6" />
          Quick Scan
        </Button>
      </motion.div>

      <div>
        <h3 className="mb-2 text-sm font-semibold flex items-center gap-1">
          <Clock className="h-4 w-4" /> Recent Activity
        </h3>
        <div className="space-y-2">
          {summary.recentActivity.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No recent activity.</CardContent></Card>
          )}
          {summary.recentActivity.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/assets/${a.assetId}`)}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-lg">{actionIcons[a.action] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{a.performedByName} · {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : ''}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
