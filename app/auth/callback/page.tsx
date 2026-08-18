'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { LoadingState } from '@/components/states';
import { toast } from 'sonner';
import { Suspense } from 'react';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const code = searchParams.get('code');
      const errorDescription = searchParams.get('error_description') || searchParams.get('error');

      if (errorDescription) {
        if (!cancelled) {
          setMessage('Confirmation failed.');
          toast.error(errorDescription);
          router.replace('/login');
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setMessage('Confirmation failed.');
          toast.error(error.message);
          router.replace('/login');
          return;
        }
        toast.success('Email confirmed. Welcome!');
        router.replace('/');
        return;
      }

      // Implicit / hash tokens — detectSessionInUrl on the client handles these
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        toast.success('Email confirmed. Welcome!');
        router.replace('/');
      } else {
        setMessage('No session found. You can sign in if confirmation already succeeded.');
        toast.message('You can sign in now.');
        router.replace('/login');
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <LoadingState text={message} />;
}

export default function AuthCallbackPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <Suspense fallback={<LoadingState text="Confirming your email..." />}>
        <AuthCallbackInner />
      </Suspense>
    </div>
  );
}
