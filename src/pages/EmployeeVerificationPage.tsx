import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck, Package, Check, AlertCircle, Mail, ChevronRight,
  Loader2, XCircle, Camera, Plus, Trash2
} from 'lucide-react';
import * as verificationService from '@/services/verificationService';
import type { AssetResponse, VerificationAssetPhoto, EmployeeAssetReport } from '@/services/verificationService';

// Employee access is link-based — unique public_token is the access credential (no OTP required).
type VerifyStep = 'loading' | 'welcome' | 'assets' | 'consent' | 'complete' | 'error';

interface VerificationAsset {
  id: string;
  assetId: string;
  name: string;
  serialNumber: string;
  categoryName: string;
  locationName: string;
  status: 'pending' | 'verified' | 'issue';
  note: string;
  issueType: string;
  photos: VerificationAssetPhoto[];
  photoUploading: boolean;
  photoRemoving: string | null; // photo id being deleted, or null
  adminReviewStatus: 'pending_review' | 'approved' | 'correction_required' | 'missing';
  adminReviewNote: string | null;
  /** null = not in correction context; true = needs action; false = locked/superseded */
  isActionable: boolean | null;
}

const STEPS = [
  { num: '1', label: 'Open Link' },
  { num: '2', label: 'Review Assets' },
  { num: '3', label: 'Consent' },
  { num: '✓', label: 'Done' },
];

const stepIndexMap: Record<VerifyStep, number> = {
  loading: -1, error: -1, welcome: 0, assets: 1, consent: 2, complete: 3,
};

export default function EmployeeVerificationPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [step, setStep] = useState<VerifyStep>('loading');
  const [email, setEmail] = useState('');
  const [assets, setAssets] = useState<VerificationAsset[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [employeeName, setEmployeeName] = useState('');

  const [requestStatus, setRequestStatus] = useState('');
  // Backend-derived actionability flags (from PublicVerificationRequestSerializer)
  const [isSuperseded, setIsSuperseded] = useState(false);
  const [employeeActionRequired, setEmployeeActionRequired] = useState(true);

  // Admin review data
  const [reviewNotes, setReviewNotes] = useState('');

  const [existingReports, setExistingReports] = useState<EmployeeAssetReport[]>([]);

  // Report missing asset dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    report_type: 'missing' as 'missing' | 'misplaced' | 'unlisted',
    asset_name: '',
    asset_id_if_known: '',
    serial_number: '',
    category_name: '',
    location_description: '',
    expected_location: '',
    remarks: '',
  });
  const [reportPhotos, setReportPhotos] = useState<File[]>([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const { data: requestData, error: fetchError } = useQuery({
    queryKey: ['publicVerification', publicToken],
    queryFn: () => verificationService.fetchPublicRequest(publicToken!),
    enabled: !!publicToken,
  });

  useEffect(() => {
    if (fetchError) {
      setStep('error');
      setErrorMsg('Verification request not found or has expired.');
      return;
    }
    if (requestData) {
      setEmployeeName(requestData.employeeName || requestData.employee_name || '');
      setEmail(requestData.employeeEmail || requestData.employee_email || '');
const status = requestData.status || '';
      setRequestStatus(status);

      if (status === 'submitted' || status === 'completed' || status === 'approved') {
        setStep('complete');
        return;
      }
      if (status === 'expired' || status === 'cancelled') {
        setStep('error');
        setErrorMsg(`This verification request has been ${status}.`);
        return;
      }

      setReviewNotes(requestData.review_notes || '');
      setExistingReports(requestData.employee_reports || []);
      // Backend-derived actionability (fall back to true so non-correction requests work as before)
      setIsSuperseded(requestData.is_superseded ?? false);
      setEmployeeActionRequired(requestData.employee_action_required ?? true);

      const rawAssets = requestData.assets || requestData.request_assets || [];
      const isCorrection = status === 'correction_requested';
      setAssets(rawAssets.map((a: any) => {
        const adminReviewStatus: 'pending_review' | 'approved' | 'correction_required' | 'missing' =
          a.response?.admin_review_status || 'pending_review';
        // In correction mode: reset correction_required assets to pending so employee re-reviews them
        // Missing assets are locked and stay with their existing response status
        const resolvedStatus = isCorrection && adminReviewStatus === 'correction_required'
          ? 'pending'
          : (a.response?.response === 'verified' ? 'verified' : a.response?.response === 'issue_reported' ? 'issue' : 'pending') as 'pending' | 'verified' | 'issue';
        return {
          id: a.id || a.request_asset_id,
          assetId: a.assetId || a.asset_id || '',
          name: a.name || a.assetName || a.asset_name || '',
          serialNumber: a.serialNumber || a.serial_number || '',
          categoryName: a.categoryName || a.category_name || '',
          locationName: a.locationName || a.location_name || '',
          status: resolvedStatus,
          note: a.response?.remarks || '',
          issueType: a.response?.issue?.issue_type || '',
          photos: Array.isArray(a.photos) ? a.photos : [],
          photoUploading: false,
          photoRemoving: null,
          adminReviewStatus,
          adminReviewNote: a.response?.admin_review_note || null,
          isActionable: a.is_actionable !== undefined ? (a.is_actionable as boolean | null) : null,
        };
      }));

      // Link-based access: go directly to welcome screen regardless of status
      setStep('welcome');
    }
  }, [requestData, fetchError]);

  const handleAssetStatus = (id: string, status: 'verified' | 'issue') => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  };

  const handleIssueNote = (id: string, note: string) => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, note } : a));
  };

  const handleIssueType = (id: string, issueType: string) => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, issueType } : a));
  };

  const handlePhotoUpload = async (id: string, file: File) => {
    if (!publicToken) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Photo must be under 10 MB. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: 'destructive',
      });
      return;
    }
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, photoUploading: true } : a));
    try {
      const photo = await verificationService.uploadAssetPhoto(publicToken, id, file);
      setAssets((prev) =>
        prev.map((a) => a.id === id ? { ...a, photos: [...a.photos, photo], photoUploading: false } : a)
      );
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err?.response?.data?.detail || 'Could not upload photo.',
        variant: 'destructive',
      });
      setAssets((prev) => prev.map((a) => a.id === id ? { ...a, photoUploading: false } : a));
    }
  };

  const handlePhotoRemove = async (assetId: string, photoId: string) => {
    if (!publicToken) return;
    setAssets((prev) => prev.map((a) => a.id === assetId ? { ...a, photoRemoving: photoId } : a));
    try {
      await verificationService.deleteAssetPhoto(publicToken, photoId);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, photos: a.photos.filter((p) => p.id !== photoId), photoRemoving: null }
            : a
        )
      );
    } catch (err: any) {
      toast({
        title: 'Remove Failed',
        description: err?.response?.data?.detail || 'Could not remove photo.',
        variant: 'destructive',
      });
      setAssets((prev) => prev.map((a) => a.id === assetId ? { ...a, photoRemoving: null } : a));
    }
  };

  const handleReportSubmit = async () => {
    if (!publicToken || !reportForm.asset_name.trim()) return;
    setReportSubmitting(true);
    try {
      const result = await verificationService.reportMissingAsset(publicToken, reportForm, reportPhotos);
      setExistingReports((prev) => [result, ...prev]);
      setReportDialogOpen(false);
      setReportForm({ report_type: 'missing', asset_name: '', asset_id_if_known: '', serial_number: '', category_name: '', location_description: '', expected_location: '', remarks: '' });
      setReportPhotos([]);
      toast({ title: 'Report Submitted', description: `"${result.asset_name}" has been reported.` });
    } catch (err: any) {
      toast({ title: 'Report Failed', description: err?.response?.data?.detail || 'Could not submit report.', variant: 'destructive' });
    }
    setReportSubmitting(false);
  };

  const isCorrection = requestStatus === 'correction_requested';
  const correctionRequiredCount = assets.filter((a) => a.adminReviewStatus === 'correction_required').length;
  // Backend-authoritative: employee_action_required covers both "no correction_required assets"
  // AND "correction_required assets superseded by newer requests for the same assets".
  // Falls back to local count when backend flag is unavailable (defensive).
  const hasActionableCorrections = isCorrection
    ? (employeeActionRequired && !isSuperseded)
    : correctionRequiredCount > 0;
  // In correction mode only correction_required assets need to be reviewed
  // Missing and approved assets are locked and excluded
  const editableAssets = isCorrection
    ? assets.filter((a) => a.adminReviewStatus === 'correction_required')
    : assets;
  const allReviewed = editableAssets.every((a) => a.status !== 'pending');
  const verifiedCount = assets.filter((a) => a.status === 'verified').length;
  const issueCount = assets.filter((a) => a.status === 'issue').length;
  const approvedCount = assets.filter((a) => a.adminReviewStatus === 'approved').length;
  const missingCount = assets.filter((a) => a.adminReviewStatus === 'missing').length;
  // All assets with status=issue must have an issue type selected before continuing
  const allIssueTyped = assets.every((a) => a.status !== 'issue' || !!a.issueType);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!publicToken) throw new Error('No token');
      // In correction mode only send responses for correction_required assets;
      // approved and missing assets are locked server-side and should not be resubmitted.
      const assetsToSubmit = isCorrection
        ? assets.filter((a) => a.adminReviewStatus === 'correction_required')
        : assets.filter((a) => a.adminReviewStatus !== 'missing');
      const responses: AssetResponse[] = assetsToSubmit.map((a) => ({
        request_asset_id: a.id,
        response: a.status === 'verified' ? 'verified' : 'issue_reported',
        remarks: a.note || undefined,
        issue_type: a.issueType || undefined,
        issue_description: a.note || undefined,
      }));
      return verificationService.submitPublicVerification(publicToken, {
        responses,
        declared_by_name: employeeName,
        declared_by_email: email,
      });
    },
    onSuccess: () => {
      setStep('complete');
      toast({ title: 'Verification Submitted', description: 'Thank you for verifying your assets.' });
    },
    onError: (err: any) => {
      toast({ title: 'Submission Failed', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    },
  });

  const handleSubmit = () => submitMutation.mutate();

  const currentStepIndex = stepIndexMap[step] ?? -1;

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Verification Unavailable</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-md bg-primary-foreground/20 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-display">Asset Vault</h1>
        </div>
        <p className="text-sm opacity-80 font-body">Employee Asset Verification</p>
      </div>

      {/* Progress */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-center gap-0.5 mb-1">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${i < currentStepIndex ? 'bg-success text-success-foreground' : i === currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i < currentStepIndex ? '✓' : s.num}
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < currentStepIndex ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-muted-foreground">{STEPS[Math.max(currentStepIndex, 0)]?.label}</div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* Welcome Step — link-based access, no OTP required */}
          {step === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="text-lg font-bold">
                      {isCorrection && !hasActionableCorrections
                        ? 'No Employee Action Pending'
                        : isCorrection
                          ? 'Action Required'
                          : 'Asset Verification'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {employeeName ? `Hello ${employeeName}` : 'Hello'} — please review and confirm your assigned assets below.
                    </p>
                  </div>
                  {isCorrection && hasActionableCorrections && (
                    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm space-y-1">
                      <p className="font-medium text-warning flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Some assets require your action</p>
                      {(approvedCount > 0 || correctionRequiredCount > 0) && (
                        <p className="text-muted-foreground text-xs">
                          {approvedCount > 0 && `${approvedCount} approved · `}{correctionRequiredCount > 0 && `${correctionRequiredCount} need your action`}
                        </p>
                      )}
                      {reviewNotes && <p className="text-muted-foreground text-xs">{reviewNotes}</p>}
                    </div>
                  )}
                  {isCorrection && !hasActionableCorrections && (
                    <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm space-y-1">
                      <p className="text-muted-foreground">
                        {approvedCount > 0 && missingCount > 0
                          ? `${approvedCount} approved · ${missingCount} missing`
                          : approvedCount > 0
                            ? `${approvedCount} asset(s) approved`
                            : missingCount > 0
                              ? `${missingCount} asset(s) missing`
                              : 'All assets have been reviewed.'}
                      </p>
                      <p className="text-xs text-muted-foreground">Approved assets are locked. Missing assets remain part of the historical review record.</p>
                    </div>
                  )}
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{email}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{assets.length} asset(s) to review</p>
                  </div>
                  {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
                  <Button onClick={() => setStep('assets')} className="w-full h-12 text-base">
                    Start Verification <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Assets Step */}
          {step === 'assets' && (
            <motion.div key="assets" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold">Review Your Assets</h2>
                <p className="text-sm text-muted-foreground">{employeeName ? `${employeeName}, please` : 'Please'} confirm each asset below.</p>
              </div>

              {requestStatus === 'rejected' && (
                <Card className="border-warning/40 bg-warning/5">
                  <CardContent className="p-3 text-sm space-y-1">
                    <p className="font-medium text-warning flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Action Required</p>
                    {reviewNotes && <p className="text-muted-foreground">{reviewNotes}</p>}
                  </CardContent>
                </Card>
              )}
              {isCorrection && hasActionableCorrections && (
                <Card className="border-warning/40 bg-warning/5">
                  <CardContent className="p-3 text-sm space-y-1">
                    <p className="font-medium text-warning flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Action Required</p>
                    {(approvedCount > 0 || correctionRequiredCount > 0) && (
                      <p className="text-muted-foreground text-xs">
                        {approvedCount > 0 && `${approvedCount} asset(s) approved · `}
                        {correctionRequiredCount > 0 && `${correctionRequiredCount} asset(s) require correction`}
                      </p>
                    )}
                    {reviewNotes && <p className="text-muted-foreground">{reviewNotes}</p>}
                  </CardContent>
                </Card>
              )}
              {isCorrection && !hasActionableCorrections && (
                <Card className="border-muted bg-muted/20">
                  <CardContent className="p-3 text-sm space-y-1">
                    <p className="font-medium text-muted-foreground">No Employee Action Pending</p>
                    <p className="text-xs text-muted-foreground">
                      {approvedCount > 0 && missingCount > 0
                        ? `${approvedCount} approved · ${missingCount} missing`
                        : approvedCount > 0
                          ? `${approvedCount} asset(s) approved`
                          : missingCount > 0
                            ? `${missingCount} asset(s) missing`
                            : 'All assets have been reviewed.'}
                    </p>
                    <p className="text-xs text-muted-foreground">Approved assets are locked. Missing assets remain part of the historical review record.</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-between text-sm bg-muted rounded-lg p-3">
                {isCorrection && !hasActionableCorrections
                  ? <span className="text-muted-foreground">No assets require action</span>
                  : isCorrection
                    ? <span>Corrected: {editableAssets.filter((a) => a.status !== 'pending').length} / {correctionRequiredCount}</span>
                    : <span>Reviewed: {verifiedCount + issueCount} / {assets.length}</span>
                }
                {issueCount > 0 && <span className="text-destructive font-medium">{issueCount} issue(s)</span>}
              </div>

              <div className="space-y-2">
                {assets.map((asset) => {
                  const isApproved = isCorrection && asset.adminReviewStatus === 'approved';
                  const isMissing = asset.adminReviewStatus === 'missing';
                  // Superseded: was correction_required but has been resolved in a newer request
                  const isSupersededAsset = isCorrection
                    && asset.adminReviewStatus === 'correction_required'
                    && asset.isActionable === false;
                  const needsCorrection = isCorrection
                    && asset.adminReviewStatus === 'correction_required'
                    && !isSupersededAsset;
                  // Treat superseded correction assets like locked/read-only
                  const isLocked = isApproved || isMissing || isSupersededAsset;
                  return (
                  <Card key={asset.id} className={`border-2 transition-colors ${isMissing ? 'border-destructive/40 bg-destructive/5 opacity-80' : isApproved ? 'border-success/40 bg-success/5 opacity-80' : isSupersededAsset ? 'border-border bg-muted/20 opacity-75' : asset.status === 'verified' ? 'border-success/40 bg-success/5' : asset.status === 'issue' ? 'border-destructive/40 bg-destructive/5' : needsCorrection ? 'border-warning/40 bg-warning/5' : 'border-border'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{asset.assetId} · {asset.serialNumber}</p>
                          </div>
                        </div>
                        {isMissing ? (
                          <div className="text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Missing
                          </div>
                        ) : isApproved ? (
                          <div className="text-xs font-medium px-2 py-1 rounded bg-success/10 text-success flex items-center gap-1">
                            <Check className="h-3 w-3" /> Approved
                          </div>
                        ) : isSupersededAsset ? (
                          <div className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground flex items-center gap-1">
                            <Check className="h-3 w-3" /> Resolved
                          </div>
                        ) : needsCorrection && asset.status === 'pending' ? (
                          <div className="text-xs font-medium px-2 py-1 rounded bg-warning/10 text-warning flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Needs Correction
                          </div>
                        ) : asset.status !== 'pending' ? (
                          <div className={`text-xs font-medium px-2 py-1 rounded ${asset.status === 'verified' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {asset.status === 'verified' ? 'Verified' : 'Issue'}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {asset.categoryName && <span className="mr-3">{asset.categoryName}</span>}
                        {asset.locationName && <span>{asset.locationName}</span>}
                      </div>
                      {/* Admin correction note */}
                      {needsCorrection && asset.adminReviewNote && (
                        <div className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 rounded p-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span><span className="font-medium">Admin note:</span> {asset.adminReviewNote}</span>
                        </div>
                      )}
                      {/* Read-only lock labels */}
                      {isMissing ? (
                        <p className="text-xs text-destructive/70 italic">This asset has been marked as missing by admin and is locked for resubmission.</p>
                      ) : isApproved ? (
                        <p className="text-xs text-muted-foreground italic">This asset has been approved and is locked.</p>
                      ) : isSupersededAsset ? (
                        <p className="text-xs text-muted-foreground italic">This asset has been resolved in a newer verification request and is part of the historical record.</p>
                      ) : (
                      <>
                      <div className="flex gap-2">
                        <Button
                          variant={asset.status === 'verified' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => handleAssetStatus(asset.id, 'verified')}
                        >
                          <Check className="mr-1 h-3 w-3" /> Verified
                        </Button>
                        <Button
                          variant={asset.status === 'issue' ? 'destructive' : 'outline'}
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => handleAssetStatus(asset.id, 'issue')}
                        >
                          <AlertCircle className="mr-1 h-3 w-3" /> Report Issue
                        </Button>
                      </div>
                      {asset.status === 'issue' && (
                        <div className="space-y-2 mt-2">
                          <Select
                            value={asset.issueType || ''}
                            onValueChange={(v) => handleIssueType(asset.id, v)}
                          >
                            <SelectTrigger className={`text-sm ${!asset.issueType ? 'text-muted-foreground' : ''}`}>
                              <SelectValue placeholder="Select issue type *" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="missing">Missing</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="wrong_serial">Wrong Serial Number</SelectItem>
                              <SelectItem value="not_in_possession">Not In Possession</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea
                            placeholder="Describe the issue..."
                            value={asset.note}
                            onChange={(e) => handleIssueNote(asset.id, e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      )}
                      </>
                      )}

                      {/* Photo upload — up to 3 photos per asset */}
                      <div className="space-y-1.5 mt-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Camera className="h-3 w-3" />
                            Photos ({asset.photos.length}/3)
                          </span>
                          {asset.photoUploading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                        {asset.photos.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {asset.photos.map((p) => (
                              <div key={p.id} className="relative group h-16 w-16 shrink-0">
                                <a href={p.url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={p.url}
                                    alt="asset photo"
                                    className="h-16 w-16 rounded object-cover border hover:opacity-80 transition-opacity"
                                  />
                                </a>
                                {!isLocked && (
                                  <button
                                    type="button"
                                    title="Remove photo"
                                    disabled={asset.photoRemoving === p.id}
                                    onClick={(e) => { e.preventDefault(); handlePhotoRemove(asset.id, p.id); }}
                                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                  >
                                    {asset.photoRemoving === p.id
                                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                      : <Trash2 className="h-2.5 w-2.5" />
                                    }
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {asset.photos.length < 3 && !isLocked && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              {...(isMobile ? { capture: 'environment' as const } : {})}
                              className="sr-only"
                              disabled={asset.photoUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(asset.id, file);
                                e.target.value = '';
                              }}
                            />
                            <span className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors">
                              <Camera className="h-3 w-3" />
                              {asset.photos.length === 0 ? 'Add Photo' : 'Add Another'}
                            </span>
                          </label>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              {/* Existing reports */}
              {existingReports.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Reported Assets ({existingReports.length})</p>
                  {existingReports.map((r) => (
                    <Card key={r.id} className="border border-warning/30 bg-warning/5">
                      <CardContent className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{r.asset_name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{r.report_type}</Badge>
                        </div>
                        {r.remarks && <p className="text-xs text-muted-foreground mt-1">{r.remarks}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Report missing / misplaced button */}
              <Button variant="outline" onClick={() => setReportDialogOpen(true)} className="w-full h-10 text-sm gap-1.5 border-dashed">
                <Plus className="h-4 w-4" /> Report Missing / Misplaced Asset
              </Button>

              {isCorrection && !hasActionableCorrections ? (
                <Button onClick={() => setStep('complete')} variant="outline" className="w-full h-12 text-base">
                  Done
                </Button>
              ) : (
                <Button onClick={() => setStep('consent')} disabled={!allReviewed || !allIssueTyped} className="w-full h-12 text-base">
                  Continue to Declaration <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}

          {/* Consent Step */}
          {step === 'consent' && (
            <motion.div key="consent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="text-lg font-bold">Declaration & Consent</h2>
                  </div>

                  <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                    <p className="font-medium">Summary:</p>
                    <p>Assets verified: <span className="font-bold text-success">{verifiedCount}</span></p>
                    <p>Issues reported: <span className="font-bold text-destructive">{issueCount}</span></p>
                    <p>Total assets reviewed: <span className="font-bold">{assets.length}</span></p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground leading-relaxed">
                    I, {employeeName || email}, hereby declare that I have physically verified the assets listed above. The information provided is true and accurate to the best of my knowledge.
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
                    <label htmlFor="agree" className="text-sm cursor-pointer leading-tight">
                      I agree to the above declaration and confirm the accuracy of my responses.
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('assets')} className="flex-1">
                      <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={!agreed || submitMutation.isPending} className="flex-1">
                      {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Submit Verification
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <Card>
                <CardContent className="p-8 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                    <Check className="h-8 w-8 text-success" />
                  </div>
                  <h2 className="text-xl font-bold">Verification Complete</h2>
                  <p className="text-sm text-muted-foreground">
                    {requestStatus === 'approved'
                      ? 'This verification has been approved by your administrator.'
                      : requestStatus === 'submitted' || requestStatus === 'completed'
                      ? 'This verification has already been submitted and is awaiting review.'
                      : 'Your asset verification has been submitted successfully. You may close this page.'}
                  </p>
                  {assets.length > 0 && (
                    <div className="text-sm space-y-1">
                      <p>Assets verified: <span className="font-bold text-success">{verifiedCount}</span></p>
                      {issueCount > 0 && <p>Issues reported: <span className="font-bold text-destructive">{issueCount}</span></p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Report missing/misplaced asset dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-warning" /> Report Missing / Misplaced Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Report Type *</Label>
              <Select value={reportForm.report_type} onValueChange={(v: any) => setReportForm((p) => ({ ...p, report_type: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">Missing Asset</SelectItem>
                  <SelectItem value="misplaced">Misplaced Asset</SelectItem>
                  <SelectItem value="unlisted">Unlisted / Extra Asset Found</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Asset Name *</Label>
              <Input placeholder="e.g. Dell Latitude Laptop" value={reportForm.asset_name} onChange={(e) => setReportForm((p) => ({ ...p, asset_name: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Asset ID (if known)</Label>
                <Input placeholder="e.g. AST-12345" value={reportForm.asset_id_if_known} onChange={(e) => setReportForm((p) => ({ ...p, asset_id_if_known: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Serial Number</Label>
                <Input placeholder="e.g. SN123456" value={reportForm.serial_number} onChange={(e) => setReportForm((p) => ({ ...p, serial_number: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Category / Type</Label>
              <Input placeholder="e.g. Laptop, Furniture, Monitor" value={reportForm.category_name} onChange={(e) => setReportForm((p) => ({ ...p, category_name: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Where Found</Label>
                <Input placeholder="Current location" value={reportForm.location_description} onChange={(e) => setReportForm((p) => ({ ...p, location_description: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Expected Location</Label>
                <Input placeholder="Where it should be" value={reportForm.expected_location} onChange={(e) => setReportForm((p) => ({ ...p, expected_location: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Remarks</Label>
              <Textarea placeholder="Any additional details..." value={reportForm.remarks} onChange={(e) => setReportForm((p) => ({ ...p, remarks: e.target.value }))} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Photos (up to 5)</Label>
              <div className="flex gap-1.5 flex-wrap">
                {reportPhotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded object-cover border" />
                    <button onClick={() => setReportPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
              {reportPhotos.length < 5 && (
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setReportPhotos((p) => [...p, f]); e.target.value = ''; }} />
                  <span className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors">
                    <Camera className="h-3 w-3" /> Add Photo
                  </span>
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReportSubmit} disabled={reportSubmitting || !reportForm.asset_name.trim()} className="gap-1.5">
              {reportSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
