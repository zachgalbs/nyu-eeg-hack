import { useEffect, useState } from "react";
import { ClimberAvatar } from "./ClimberAvatar";
import { MiniMountain } from "./MiniMountain";
import { getUserName } from "../../lib/auth";

interface Friend {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_event_title: string | null;
  last_session_started_at: string | null;
  is_active: boolean;
}

export function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [inviting, setInviting] = useState(false);

  const myName = getUserName() ?? 'You';

  useEffect(() => {
    fetch('/api/friends/list')
      .then((r) => r.json())
      .then((data) => {
        setFriends(data.friends ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setInviting(true);
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

  const activeFriends = friends.filter((f) => f.is_active);
  const topThree = friends.slice(0, 3);

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

      {loading ? (
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
        <div className="text-center py-16">
          <p className="text-warm-gray mb-2" style={{ fontSize: '16px' }}>No friends yet.</p>
          <p className="text-warm-gray" style={{ fontSize: '14px' }}>
            Tap "+ Invite" to share a link and bring someone on the mountain.
          </p>
        </div>
      ) : (
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
                    {friend.last_event_title && (
                      <span
                        className="text-warm-gray italic truncate"
                        style={{ fontSize: '13px' }}
                      >
                        {friend.last_event_title}
                      </span>
                    )}
                  </div>
                  <span className="text-warm-gray" style={{ fontSize: '13px' }}>
                    {friend.is_active
                      ? 'Climbing now'
                      : friend.last_session_started_at
                      ? `Last seen ${new Date(friend.last_session_started_at).toLocaleDateString()}`
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
      )}

      {activeFriends.length > 0 && (
        <p className="mt-6 text-center text-warm-gray" style={{ fontSize: '13px' }}>
          {activeFriends.length} friend{activeFriends.length !== 1 ? 's' : ''} climbing right now
        </p>
      )}
    </div>
  );
}
