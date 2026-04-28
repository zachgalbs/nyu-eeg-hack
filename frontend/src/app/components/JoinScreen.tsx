import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { isSignedIn } from '../../lib/auth';

type Status =
  | 'idle'
  | 'claiming'
  | 'awaiting_confirmation'
  | 'expired'
  | 'already_used'
  | 'error';

export function JoinScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoggedIn = isSignedIn();

  useEffect(() => {
    if (!token || !isLoggedIn || status !== 'idle') return;
    setStatus('claiming');

    fetch('/api/friends/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('awaiting_confirmation');
          return;
        }
        if (res.status === 410 || data.error === 'expired_invite') {
          setStatus('expired');
          return;
        }
        if (res.status === 409 || data.error === 'already_used') {
          setStatus('already_used');
          return;
        }
        setErrorMsg(data.error ?? 'Could not claim invite');
        setStatus('error');
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus('error');
      });
  }, [token, isLoggedIn, status]);

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
          Sign in with Google to claim this invite. Your friend will get a confirmation prompt before
          you appear in each other's friend lists.
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
      {status === 'claiming' && (
        <>
          <h1 className="mb-3 text-ink" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            claiming…
          </h1>
          <p className="text-warm-gray" style={{ fontSize: '15px' }}>Sending the friend request.</p>
        </>
      )}
      {status === 'awaiting_confirmation' && (
        <>
          <h1 className="mb-3 text-moss" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            request sent
          </h1>
          <p className="mb-6 text-warm-gray" style={{ fontSize: '15px' }}>
            Your friend needs to confirm before you both show up in each other's friend lists. We'll
            let you know when it's accepted.
          </p>
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
      {status === 'expired' && (
        <>
          <h1 className="mb-3 text-coral" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            link expired
          </h1>
          <p className="mb-6 text-warm-gray" style={{ fontSize: '15px' }}>
            Ask your friend to send you a fresh invite.
          </p>
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
      {status === 'already_used' && (
        <>
          <h1 className="mb-3 text-coral" style={{ fontFamily: 'var(--font-pixel)', fontSize: '28px' }}>
            already used
          </h1>
          <p className="mb-6 text-warm-gray" style={{ fontSize: '15px' }}>
            This invite was already claimed by someone else.
          </p>
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
