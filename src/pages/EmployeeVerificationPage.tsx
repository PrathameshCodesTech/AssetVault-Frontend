import { useState, useRef, useEffect } from 'react';
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
import {
  ShieldCheck, Package, Check, AlertCircle, Mail, Shield, Clock, Info, ChevronRight,
  Loader2, ArrowLeft, XCircle, Camera
} from 'lucide-react';
import * as verificationService from '@/services/verificationService';
import type { AssetResponse, VerificationAssetPhoto } from '@/services/verificationService';

type VerifyStep = 'loading' | 'email' | 'otp' | 'assets' | 'consent' | 'complete' | 'error';

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
}

const STEPS = [
  { num: '1', label: 'Identify' },
  { num: '2', label: 'Verify OTP' },
  { num: '3', label: 'Review Assets' },
  { num: '4', label: 'Consent' },
  { num: '✓', label: 'Done' },
];

const stepIndexMap: Record<VerifyStep, number> = {
  loading: -1, error: -1, email: 0, otp: 1, assets: 2, consent: 3, complete: 4,
};

export default function EmployeeVerificationPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [step, setStep] = useState<VerifyStep>('loading');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [challengeId, setChallengeId] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [assets, setAssets] = useState<VerificationAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

      if (status === 'submitted' || status === 'completed') {
        setStep('complete');
        return;
      }
      if (status === 'expired' || status === 'cancelled') {
        setStep('error');
        setErrorMsg(`This verification request has been ${status}.`);
        return;
      }

      const rawAssets = requestData.assets || requestData.request_assets || [];
      setAssets(rawAssets.map((a: any) => ({
        id: a.id || a.request_asset_id,
        assetId: a.assetId || a.asset_id || '',
        name: a.name || a.assetName || a.asset_name || '',
        serialNumber: a.serialNumber || a.serial_number || '',
        categoryName: a.categoryName || a.category_name || '',
        locationName: a.locationName || a.location_name || '',
        status: (a.response?.response === 'verified' ? 'verified' : a.response?.response === 'issue_reported' ? 'issue' : 'pending') as 'pending' | 'verified' | 'issue',
        note: a.response?.remarks || '',
        issueType: a.response?.issue?.issue_type || '',
        photos: Array.isArray(a.photos) ? a.photos : [],
        photoUploading: false,
      })));

      if (status === 'otp_verified' || status === 'OTP_VERIFIED') {
        setStep('assets');
      } else {
        setStep('email');
      }
    }
  }, [requestData, fetchError]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!publicToken) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const resp = await verificationService.sendPublicOtp(publicToken);
      setChallengeId(resp.challenge_id);
      if (resp.debug_otp) setDebugOtp(resp.debug_otp);
      setCountdown(60);
      setStep('otp');
      toast({ title: 'OTP Sent', description: `Code sent to ${email}` });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to send OTP.');
    }
    setIsLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    if (!publicToken) return;
    const code = otp.join('');
    if (code.length < 6) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      await verificationService.verifyPublicOtp(publicToken, challengeId, code);
      setStep('assets');
      toast({ title: 'OTP Verified', description: 'You can now review your assets.' });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Invalid OTP.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || !publicToken) return;
    setIsLoading(true);
    try {
      const resp = await verificationService.sendPublicOtp(publicToken);
      setChallengeId(resp.challenge_id);
      if (resp.debug_otp) setDebugOtp(resp.debug_otp);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      toast({ title: 'OTP Resent', description: 'A new code has been sent.' });
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  const handleAssetStatus = (id: string, status: 'verified' | 'issue') => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    if (status === 'issue') setSelectedAssetId(id);
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

  const allReviewed = assets.every((a) => a.status !== 'pending');
  const verifiedCount = assets.filter((a) => a.status === 'verified').length;
  const issueCount = assets.filter((a) => a.status === 'issue').length;

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!publicToken) throw new Error('No token');
      const responses: AssetResponse[] = assets.map((a) => ({
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

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

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
          {/* Email Step */}
          {step === 'email' && (
            <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <Mail className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="text-lg font-bold">Verify Your Identity</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {employeeName ? `Hello ${employeeName}, we` : 'We'} will send a verification code to your registered email.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        readOnly
                        className="pl-9 bg-muted"
                      />
                    </div>
                  </div>
                  {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
                  <Button onClick={handleSendOtp} disabled={isLoading} className="w-full h-12 text-base">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                    Send Verification Code
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="text-lg font-bold">Enter Verification Code</h2>
                    <p className="text-sm text-muted-foreground mt-1">Code sent to {email}</p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, i) => (
                      <Input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="h-14 w-12 text-center text-xl font-bold border-2 focus:border-primary"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  {errorMsg && <p className="text-center text-sm text-destructive">{errorMsg}</p>}
                  {debugOtp && <p className="text-center text-xs text-muted-foreground">Dev OTP: <span className="font-mono font-bold">{debugOtp}</span></p>}
                  <Button onClick={handleVerifyOtp} disabled={otp.join('').length < 6 || isLoading} className="w-full h-12 text-base">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Verify Code
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <button onClick={() => { setStep('email'); setErrorMsg(''); }} className="text-primary hover:underline font-semibold">
                      &larr; Change email
                    </button>
                    <button onClick={handleResendOtp} disabled={countdown > 0} className={`font-semibold ${countdown > 0 ? 'text-muted-foreground' : 'text-primary hover:underline'}`}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </button>
                  </div>
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

              <div className="flex items-center justify-between text-sm bg-muted rounded-lg p-3">
                <span>Reviewed: {verifiedCount + issueCount} / {assets.length}</span>
                {issueCount > 0 && <span className="text-destructive font-medium">{issueCount} issue(s)</span>}
              </div>

              <div className="space-y-2">
                {assets.map((asset) => (
                  <Card key={asset.id} className={`border-2 transition-colors ${asset.status === 'verified' ? 'border-success/40 bg-success/5' : asset.status === 'issue' ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{asset.assetId} · {asset.serialNumber}</p>
                          </div>
                        </div>
                        {asset.status !== 'pending' && (
                          <div className={`text-xs font-medium px-2 py-1 rounded ${asset.status === 'verified' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {asset.status === 'verified' ? 'Verified' : 'Issue'}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {asset.categoryName && <span className="mr-3">{asset.categoryName}</span>}
                        {asset.locationName && <span>{asset.locationName}</span>}
                      </div>
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
                          <Input
                            placeholder="Issue type (e.g., missing, damaged, wrong location)"
                            value={asset.issueType}
                            onChange={(e) => handleIssueType(asset.id, e.target.value)}
                            className="text-sm"
                          />
                          <Textarea
                            placeholder="Describe the issue..."
                            value={asset.note}
                            onChange={(e) => handleIssueNote(asset.id, e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
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
                              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={p.url}
                                  alt="asset photo"
                                  className="h-16 w-16 rounded object-cover border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {asset.photos.length < 3 && (
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
                ))}
              </div>

              <Button onClick={() => setStep('consent')} disabled={!allReviewed} className="w-full h-12 text-base">
                Continue to Declaration <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* Consent Step */}
          {step === 'consent' && (
            <motion.div key="consent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
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
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
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
                    {requestStatus === 'submitted' || requestStatus === 'completed'
                      ? 'This verification has already been submitted.'
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
    </div>
  );
}
