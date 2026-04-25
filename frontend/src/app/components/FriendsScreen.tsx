import { useEffect, useState } from "react";
import { ClimberAvatar } from "./ClimberAvatar";
import { MiniMountain } from "./MiniMountain";
import { getSessionOutcomes } from "../../lib/compcal-state";

type TimeFilter = 'today' | 'week' | 'month';

interface Friend {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_event: string | null;
  last_summit: string | null;
  is_active: boolean;
}

const demoFriends: Friend[] = [
  {
    user_id: "zachary-demo",
    name: "Zachary",
    avatar_url: null,
    last_event_title: "Deep Work: Systems Design",
    last_session_started_at: new Date().toISOString(),
    is_active: true,
  },
  {
    user_id: "candy-demo",
    name: "Candy",
    avatar_url: null,
    last_event_title: "EEG Analysis Block",
    last_session_started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    user_id: "andy-demo",
    name: "Andy",
    avatar_url: null,
    last_event_title: "Pair Study — Algorithms",
    last_session_started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    is_active: false,
  },
  {
    user_id: "travis-demo",
    name: "Travis",
    avatar_url: null,
    last_event_title: "Reading Sprint",
    last_session_started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    is_active: false,
  },
];

export function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const latestBuddyCompletion = getSessionOutcomes().find((s) => Boolean(s.buddyName));

  useEffect(() => {
    fetch('/api/friends/list')
      .then(async (r) => {
        if (r.status === 401) { setNeedsAuth(true); setLoading(false); return; }
        if (!r.ok) throw new Error(`friends_list_${r.status}`);
        const data = await r.json();
        setFriends(data.friends ?? []);
        setApiUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        setApiUnavailable(true);
        setLoading(false);
      });
  }, []);

  async function handleInvite() {
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch('/api/friends/invite', { method: 'POST' });
      const data = await res.json();
      if (data.error === 'reauth_required') {
        window.location.href = '/api/auth/login';
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate invite');
      setInviteLink(data.link);
    } catch (err) {
      console.error('[invite]', err);
      setInviteError('Invite API unavailable right now. Demo friends remain visible.');
    } finally {
      setInviting(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  const shouldUseDemoFriends = !loading && !needsAuth && friends.length === 0;
  const visibleFriends = shouldUseDemoFriends ? demoFriends : friends;
  const activeFriends = visibleFriends.filter((f) => f.is_active);
  const topThree = visibleFriends.slice(0, 3);

  return (
    <div className="px-6 pt-12 pb-6">
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>Friends</h1>
        <button
          type="button"
          onClick={handleInvite}
          disabled={inviting}
          className="rounded-full bg-primary px-5 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontWeight: 600, fontSize: '14px' }}
        >
          {inviting ? 'Generating…' : '+ Invite'}
        </button>
      </div>

      {inviteLink && (
        <div
          className="bg-card border border-border p-4 mb-6 flex items-center gap-3"
          style={{ borderRadius: '16px' }}
        >
          <span
            className="flex-1 truncate text-warm-gray"
            style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          >
            {inviteLink}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full bg-moss px-4 py-1.5 text-white transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {copying ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}

      {inviteError && (
        <div
          className="mb-4 border border-coral/40 bg-coral/10 px-4 py-3"
          style={{ borderRadius: '12px' }}
        >
          <p className="text-[12px] text-coral">{inviteError}</p>
        </div>
      )}

      {latestBuddyCompletion && (
        <div
          className="mb-4 border border-moss/50 bg-moss/10 px-4 py-3"
          style={{ borderRadius: '12px' }}
        >
          <p className="text-[12px] text-moss">
            Buddy check-in complete: you and {latestBuddyCompletion.buddyName} finished{' '}
            {latestBuddyCompletion.eventTitle}.
          </p>
        </div>
      )}

      {topThree.length > 0 && (
        <div
          className="bg-card p-6 mb-6 border border-border"
          style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-warm-gray mb-4" style={{ fontSize: '13px' }}>
            At a glance — who&apos;s on the trail right now
          </p>
          <div className="flex items-end justify-around gap-4 mb-2">
            {topThree.map((friend) => (
              <div key={friend.user_id} className="flex flex-col items-center gap-2">
                <MiniMountain progress={friend.is_active ? 50 : 0} />
                <span className="text-ink" style={{ fontSize: '13px' }}>
                  {friend.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsAuth ? (
        <div className="text-center py-16">
          <p className="text-warm-gray mb-6" style={{ fontSize: '15px' }}>Sign in to see your friends.</p>
          <a
            href="/api/auth/login"
            className="rounded-full bg-primary px-8 py-3 text-primary-foreground transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, fontSize: '15px' }}
          >
            Sign in with Google
          </a>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-card border border-border animate-pulse"
              style={{ borderRadius: '16px' }}
            />
          ))}
        </div>
      ) : (
        <>
          {shouldUseDemoFriends && (
            <div
              className="mb-4 border border-border bg-card/60 px-4 py-3"
              style={{ borderRadius: '12px' }}
            >
              <p className="text-warm-gray" style={{ fontSize: '13px' }}>
                Showing demo friends. {apiUnavailable ? 'Live friends API is unavailable right now.' : 'Use + Invite to connect real friends.'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {(['today', 'week', 'month'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 border transition-colors ${
                  timeFilter === filter
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-warm-gray'
                }`}
                style={{ borderRadius: '999px', fontSize: '14px', fontWeight: 600 }}
              >
                {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visibleFriends.map((friend) => (
              <div
                key={friend.user_id}
                className="p-4 bg-card border border-border"
                style={{ borderRadius: '16px' }}
              >
                <div className="flex items-center gap-3">
                  <ClimberAvatar
                    name={friend.name}
                    size={40}
                    color={friend.is_active ? '#5C7A3E' : '#D99A8F'}
                    isActive={friend.is_active}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-ink font-semibold">{friend.name}</span>
                      {friend.last_event && (
                        <span
                          className="text-warm-gray italic truncate"
                          style={{ fontSize: '13px' }}
                        >
                          {friend.last_event}
                        </span>
                      )}
                    </div>
                    <span className="text-warm-gray" style={{ fontSize: '13px' }}>
                      {friend.is_active
                        ? 'Climbing now'
                        : friend.last_summit
                        ? `Last climbed ${new Date(friend.last_summit).toLocaleDateString()}`
                        : 'Never climbed yet'}
                    </span>
                  </div>
                  {friend.is_active && (
                    <div className="w-2 h-2 bg-moss rounded-full animate-pulse" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {activeFriends.length > 0 && (
            <p className="mt-6 text-center text-warm-gray" style={{ fontSize: '13px' }}>
              {activeFriends.length} friend{activeFriends.length !== 1 ? 's' : ''} climbing right now
            </p>
          )}
        </>
      )}
    </div>
  );
}
