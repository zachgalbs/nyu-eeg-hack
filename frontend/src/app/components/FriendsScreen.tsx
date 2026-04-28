import { useEffect, useState } from "react";
import { ClimberAvatar } from "./ClimberAvatar";
import { MiniMountain } from "./MiniMountain";
import { getSessionOutcomes } from "../../lib/compcal-state";

type TimeFilter = 'today' | 'week' | 'month';

interface Friend {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_activity: string | null;   // safe label (subject) or null — never raw event title
  last_score: number | null;
  last_summit: string | null;
  is_active: boolean;
}

interface IncomingRequest {
  id: number;
  claimedAt: string;
  claimer: { userId: string; name: string; avatarUrl: string | null };
}

interface OutgoingInvite {
  id: number;
  token: string;
  status: 'pending' | 'claimed';
  expiresAt: string | null;
  claimer: { userId: string; name: string; avatarUrl: string | null } | null;
}

type TtlChoice = 1 | 7 | 30 | null;
const TTL_OPTIONS: { value: TtlChoice; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: null, label: 'never' },
];

function formatExpiresIn(iso: string | null): string {
  if (!iso) return 'never expires';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86400_000);
  if (days >= 1) return `expires in ${days}d`;
  const hours = Math.floor(ms / 3600_000);
  if (hours >= 1) return `expires in ${hours}h`;
  return `expires in <1h`;
}

export function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [ttlChoice, setTtlChoice] = useState<TtlChoice>(7);
  const [copying, setCopying] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const latestBuddyCompletion = getSessionOutcomes().find((s) => Boolean(s.buddyName));

  async function refresh() {
    setLoading(true);
    try {
      const [friendsRes, incomingRes] = await Promise.all([
        fetch('/api/friends/list', { credentials: 'same-origin' }),
        fetch('/api/friends/incoming', { credentials: 'same-origin' }),
      ]);
      if (friendsRes.status === 401 || incomingRes.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends ?? []);
      }
      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
      }
      setApiUnavailable(false);
    } catch {
      setApiUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleInvite() {
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ttlDays: ttlChoice }),
      });
      const data = await res.json();
      if (data.error === 'reauth_required') {
        window.location.href = '/api/auth/login';
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate invite');
      setInviteLink(data.link);
      setInviteExpiresAt(data.expiresAt ?? null);
      refresh(); // pick up the new pending invite in outgoing list
    } catch (err) {
      console.error('[invite]', err);
      setInviteError('Invite API unavailable right now.');
    } finally {
      setInviting(false);
    }
  }

  async function handleShare() {
    if (!inviteLink) return;
    // Web Share API where supported (mobile native sheet -> Messages, Mail,
    // WhatsApp, etc). Falls back to clipboard.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Climb together',
          text: 'Join me on CompCal — we can keep each other accountable.',
          url: inviteLink,
        });
        return;
      } catch {
        // user canceled or permission denied — fall through to copy
      }
    }
    await navigator.clipboard.writeText(inviteLink);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  async function respondToRequest(id: number, action: 'accept' | 'decline') {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ friendshipId: id, action }),
      });
      if (!res.ok) throw new Error(`respond_${res.status}`);
      refresh();
    } catch (err) {
      console.error('[respond]', err);
    }
  }

  async function revokeInvite(id: number) {
    if (!window.confirm('Revoke this invite link?')) return;
    try {
      const res = await fetch('/api/friends/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ friendshipId: id }),
      });
      if (!res.ok) throw new Error(`revoke_${res.status}`);
      refresh();
    } catch (err) {
      console.error('[revoke]', err);
    }
  }

  async function unfriend(friendUserId: string, name: string) {
    if (!window.confirm(`Unfriend ${name}? They will no longer see your activity.`)) return;
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ friendUserId }),
      });
      if (!res.ok) throw new Error(`remove_${res.status}`);
      refresh();
    } catch (err) {
      console.error('[unfriend]', err);
    }
  }

  const activeFriends = friends.filter((f) => f.is_active);
  const topThree = friends.slice(0, 3);

  return (
    <div className="px-6 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>Friends</h1>
        <div className="flex items-center gap-2">
          <select
            value={ttlChoice === null ? 'never' : String(ttlChoice)}
            onChange={(e) => {
              const v = e.target.value;
              setTtlChoice(v === 'never' ? null : (Number(v) as TtlChoice));
            }}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-warm-gray"
            style={{ fontSize: '12px', fontWeight: 600 }}
            aria-label="Invite link expiry"
          >
            {TTL_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value === null ? 'never' : String(opt.value)}>
                Expires {opt.label}
              </option>
            ))}
          </select>
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
      </div>

      {inviteLink && (
        <div
          className="bg-card border border-border p-4 mb-4"
          style={{ borderRadius: '16px' }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-ink" style={{ fontSize: '13px', fontWeight: 600 }}>
              Share this link with a friend
            </p>
            <span className="text-warm-gray" style={{ fontSize: '11px' }}>
              {formatExpiresIn(inviteExpiresAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex-1 truncate text-warm-gray"
              style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
            >
              {inviteLink}
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="rounded-full bg-moss px-4 py-1.5 text-white transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {copying ? 'Copied!' : 'Share'}
            </button>
          </div>
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

      {/* Incoming friend requests — inviter must approve */}
      {incoming.length > 0 && (
        <section className="mb-6 border border-moss/40 bg-moss/5 p-4" style={{ borderRadius: '16px' }}>
          <p className="mb-3 text-moss" style={{ fontSize: '13px', fontWeight: 600 }}>
            {incoming.length} friend request{incoming.length === 1 ? '' : 's'} waiting on you
          </p>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 bg-card px-3 py-2"
                style={{ borderRadius: '12px' }}
              >
                <ClimberAvatar name={r.claimer.name} size={32} />
                <span className="flex-1 text-ink" style={{ fontSize: '14px' }}>
                  {r.claimer.name}
                </span>
                <button
                  type="button"
                  onClick={() => respondToRequest(r.id, 'accept')}
                  className="rounded-full bg-moss px-3 py-1 text-white"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respondToRequest(r.id, 'decline')}
                  className="rounded-full border border-border bg-card px-3 py-1 text-warm-gray"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Outgoing pending invites — let user revoke */}
      {outgoing.length > 0 && (
        <section className="mb-6 border border-border bg-card/60 p-4" style={{ borderRadius: '16px' }}>
          <p className="mb-3 text-warm-gray" style={{ fontSize: '13px', fontWeight: 600 }}>
            Pending invites you sent
          </p>
          <ul className="space-y-2">
            {outgoing.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 bg-card px-3 py-2"
                style={{ borderRadius: '12px' }}
              >
                <span className="flex-1 truncate text-ink" style={{ fontSize: '13px' }}>
                  {o.claimer
                    ? `${o.claimer.name} claimed your invite — confirm above`
                    : 'Unclaimed link'}
                </span>
                <span className="text-warm-gray" style={{ fontSize: '11px' }}>
                  {formatExpiresIn(o.expiresAt)}
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(o.id)}
                  className="rounded-full border border-coral/40 bg-coral/5 px-3 py-1 text-coral"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
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
            friends&apos; progress
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
      ) : friends.length === 0 ? (
        // FS-10: share-first empty state. No demo friends — they confused
        // real users into thinking "Andy" was someone they actually knew.
        <div
          className="border border-border bg-card p-8 text-center"
          style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
        >
          <h2 className="mb-2 text-ink" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px' }}>
            Climb with someone
          </h2>
          <p className="mb-6 text-warm-gray" style={{ fontSize: '14px' }}>
            CompCal is better with friends who keep you honest. Send an invite link.
          </p>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting}
            className="rounded-full bg-primary px-8 py-3 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ fontWeight: 600, fontSize: '15px' }}
          >
            {inviting ? 'Generating…' : 'Generate invite link'}
          </button>
          {apiUnavailable && (
            <p className="mt-4 text-warm-gray" style={{ fontSize: '12px' }}>
              Live friends API is unavailable right now.
            </p>
          )}
        </div>
      ) : (
        <>
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
            {friends.map((friend) => (
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
                      {friend.last_activity && (
                        <span
                          className="text-warm-gray italic truncate"
                          style={{ fontSize: '13px' }}
                        >
                          {friend.last_activity}
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
                  <button
                    type="button"
                    onClick={() => unfriend(friend.user_id, friend.name)}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-warm-gray hover:border-coral/40 hover:bg-coral/5 hover:text-coral"
                    style={{ fontSize: '11px', fontWeight: 600 }}
                    aria-label={`Unfriend ${friend.name}`}
                  >
                    Unfriend
                  </button>
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
