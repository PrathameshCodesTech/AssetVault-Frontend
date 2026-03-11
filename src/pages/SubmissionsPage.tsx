import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchMySubmissions } from '@/services/submissionService';
import { mapBackendSubmission } from '@/services/mappers';
import { Clock, CheckCircle2, XCircle, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ThirdPartySubmission } from '@/types';

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-warning/10 text-warning border-warning/20', icon: Clock, label: 'Pending' },
  approved: { color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2, label: 'Approved' },
  rejected: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Rejected' },
  correction_requested: { color: 'bg-accent/10 text-accent border-accent/20', icon: AlertCircle, label: 'Correction Needed' },
};

export default function SubmissionsPage() {
  const [filter, setFilter] = useState('all');

  const params: Record<string, any> = { page_size: 50 };
  if (filter !== 'all') params.status = filter;

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['mySubmissions', params],
    queryFn: () => fetchMySubmissions(params),
  });

  const submissions = (rawData?.results ?? []).map(mapBackendSubmission);

  const renderSubmission = (sub: ThirdPartySubmission) => {
    const cfg = statusConfig[sub.status] ?? statusConfig.pending;
    const StatusIcon = cfg.icon;
    return (
      <Card key={sub.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">
                {sub.type === 'verification' ? `Verification: ${sub.assetId}` : `New Asset: ${sub.assetName || 'Unnamed'}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {sub.tempRefId && <span className="font-mono">Ref: {sub.tempRefId} · </span>}
                {sub.submittedAt ? formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true }) : ''}
              </p>
            </div>
            <Badge variant="outline" className={`text-xs ${cfg.color}`}><StatusIcon className="mr-1 h-3 w-3" />{cfg.label}</Badge>
          </div>

          <div className="text-xs space-y-1">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-muted-foreground leading-relaxed">{sub.locationBreadcrumb}</span>
            </div>
            {sub.remarks && <p className="text-muted-foreground">Notes: {sub.remarks}</p>}
          </div>

          {sub.status === 'correction_requested' && sub.reviewNotes && (
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-2 text-xs">
              <p className="font-medium text-accent">Admin feedback:</p>
              <p className="text-muted-foreground">{sub.reviewNotes}</p>
            </div>
          )}

          {sub.reviewedByName && (
            <p className="text-[11px] text-muted-foreground">
              Reviewed by {sub.reviewedByName}{sub.reviewedAt ? ` · ${formatDistanceToNow(new Date(sub.reviewedAt), { addSuffix: true })}` : ''}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">My Submissions</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
          <TabsTrigger value="correction_requested" className="text-xs">Corrections</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {submissions.length === 0 && (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No submissions found.</CardContent></Card>
          )}
          {submissions.map(renderSubmission)}
        </div>
      )}
    </div>
  );
}
