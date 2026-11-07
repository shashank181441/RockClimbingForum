'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken, setToken } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { LoadingState } from '@/components/states';
import { Suspense } from 'react';
import { toast } from 'sonner';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const [message, setMessage] = useState('Checking session...');

  useEffect(() => {
    (async () => {
      const error = searchParams.get('error');
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
        router.replace('/login');
        return;
      }

      const incomingToken = searchParams.get('token');
      if (incomingToken) {
        setToken(incomingToken);
        setMessage('Signing you in...');
        await refreshProfile();
        toast.success('Namaste! Welcome back.');
        router.replace('/');
        return;
      }

      const token = getToken();
      if (token) {
        setMessage('You are signed in.');
        router.replace('/');
      } else {
        setMessage('Redirecting to sign in...');
        router.replace('/login');
      }
    })();
  }, [router, searchParams, refreshProfile]);

  return <LoadingState text={message} />;
}

export default function AuthCallbackPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <Suspense fallback={<LoadingState text="Checking session..." />}>
        <AuthCallbackInner />
      </Suspense>
    </div>
  );
}
