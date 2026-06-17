import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function LogiconSsoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithLogiconToken } = useAuth();
  const startedRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = searchParams.get('token')?.trim();
    if (!token) {
      setError('Logicon handoff token is missing.');
      return;
    }

    void (async () => {
      const result = await loginWithLogiconToken(token);
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error ?? 'Unable to open Asset Vault from Logicon.');
      }
    })();
  }, [loginWithLogiconToken, navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {error ? <TriangleAlert className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <CardTitle className="text-xl font-display">
            {error ? 'Unable to open Asset Vault' : 'Opening Asset Vault'}
          </CardTitle>
          <CardDescription className="font-body">
            {error
              ? 'The Logicon handoff could not be completed.'
              : 'Validating your Logicon session and preparing your Asset Vault access.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {error ? (
            <>
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
                Go to Asset Vault login
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
