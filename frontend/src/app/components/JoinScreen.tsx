import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { getGoogleToken } from '../../lib/auth';

export function JoinScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [status, setStatus] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoggedIn = !!getGoogleToken();

  useEffect(() => {
    if (!token || !isLoggedIn || status !== 'idle') return;
    setStatus('accepting');

    fetch('/api/friends/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to accept invite');
        }
        setStatus('done');
        setTimeout(() => navigate('/friends'), 1500);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus('error');
      });
  }, [token, isLoggedIn, status, navigate]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-warm-gray">Invalid invite link.</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-ink" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
          you've been invited
        </h1>
        <p className="mb-8 text-warm-gray" style={{ fontSize: '15px' }}>
          Sign in with Google to join your friend on the mountain.
        </p>
        <a
          href={`/api/auth/login?invite_token=${token}`}
          className="rounded-full bg-primary px-8 py-3 text-primary-foreground transition-opacity hover:opacity-90"
          style={{ fontWeight: 600, fontSize: '16px' }}
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {status === 'accepting' && (
        <>
          <h1 className="mb-3 text-ink" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            joining...
          </h1>
          <p className="text-warm-gray" style={{ fontSize: '15px' }}>Accepting your invite.</p>
        </>
      )}
      {status === 'done' && (
        <>
          <h1 className="mb-3 text-moss" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            you're in!
          </h1>
          <p className="text-warm-gray" style={{ fontSize: '15px' }}>Taking you to your friends...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="mb-3 text-coral" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            oops
          </h1>
          <p className="mb-6 text-warm-gray" style={{ fontSize: '15px' }}>{errorMsg}</p>
          <button
            type="button"
            onClick={() => navigate('/friends')}
            className="rounded-full bg-primary px-8 py-3 text-primary-foreground"
            style={{ fontWeight: 600 }}
          >
            Go to friends
          </button>
        </>
      )}
    </div>
  );
}
