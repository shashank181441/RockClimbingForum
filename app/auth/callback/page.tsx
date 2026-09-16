'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api/client';
import { LoadingState } from '@/components/states';
import { Suspense } from 'react';

function AuthCallbackInner() {
  const router = useRouter();
  const [message, setMessage] = useState('Checking session...');

  useEffect(() => {
    const token = getToken();
    if (token) {
      setMessage('You are signed in.');
      router.replace('/');
    } else {
      setMessage('Redirecting to sign in...');
      router.replace('/login');
    }
  }, [router]);

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
