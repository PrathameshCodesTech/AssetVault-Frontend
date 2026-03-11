import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { sendOtp, verifyOtp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!email) return;
    setError('');
    setIsLoading(true);
    const result = await sendOtp(email);
    setIsLoading(false);
    if (result.success && result.challengeId) {
      setChallengeId(result.challengeId);
      if (result.debugOtp) setDebugOtp(result.debugOtp);
      setStep('otp');
      setCountdown(60);
      toast({ title: 'OTP Sent', description: `Verification code sent to ${email}` });
    } else {
      setError(result.error || 'Failed to send OTP.');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setError('');
    setIsLoading(true);
    const result = await verifyOtp(email, code, challengeId);
    setIsLoading(false);
    if (result.success) {
      toast({ title: 'Welcome!', description: 'Authentication successful.' });
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Invalid OTP.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    const result = await sendOtp(email);
    setIsLoading(false);
    if (result.success && result.challengeId) {
      setChallengeId(result.challengeId);
      if (result.debugOtp) setDebugOtp(result.debugOtp);
    }
    setCountdown(60);
    setOtp(['', '', '', '', '', '']);
    toast({ title: 'OTP Resent', description: 'A new code has been sent.' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display text-foreground">Asset Vault</h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">Secure Asset Management & Reconciliation</p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-display">{step === 'email' ? 'Sign In' : 'Verify OTP'}</CardTitle>
            <CardDescription className="font-body">
              {step === 'email'
                ? 'Enter your authorized email to get started'
                : `Enter the 6-digit code sent to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === 'email' ? (
                <motion.div key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="your.name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      className="pl-10 h-12 font-body"
                      autoFocus
                    />
                  </div>
                   {error && <p className="text-sm text-destructive font-body">{error}</p>}
                   <Button onClick={handleSendOtp} disabled={!email || isLoading} className="w-full h-12 text-base font-body font-semibold">
                     {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                     Send OTP
                   </Button>
                </motion.div>
              ) : (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="flex justify-center gap-2.5">
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
                        className="h-14 w-12 text-center text-xl font-bold font-body border-2 focus:border-primary focus:ring-primary/20"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  {error && <p className="text-center text-sm text-destructive font-body">{error}</p>}
                  {debugOtp && (
                    <p className="text-center text-xs text-muted-foreground font-body">Dev OTP: <span className="font-mono font-bold">{debugOtp}</span></p>
                  )}
                  <Button onClick={handleVerify} disabled={otp.join('').length < 6 || isLoading} className="w-full h-12 text-base font-body font-semibold">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify & Sign In
                  </Button>
                  <div className="flex items-center justify-between text-sm font-body">
                    <button onClick={() => { setStep('email'); setError(''); setDebugOtp(''); }} className="text-primary hover:underline font-semibold">
                      &larr; Change email
                    </button>
                    <button onClick={handleResend} disabled={countdown > 0} className={`font-semibold ${countdown > 0 ? 'text-muted-foreground' : 'text-primary hover:underline'}`}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
