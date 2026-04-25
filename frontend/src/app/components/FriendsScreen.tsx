import { useState } from "react";
import { ClimberAvatar } from "./ClimberAvatar";
import { MiniMountain } from "./MiniMountain";
import { getSessionOutcomes } from "../../lib/compcal-state";
import { getSortedFriendPresence } from "../../lib/friends-presence";

type TimeFilter = 'today' | 'week' | 'month';

export function FriendsScreen() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const latestBuddyCompletion = getSessionOutcomes().find((s) => Boolean(s.buddyName));

  const sortedFriends = getSortedFriendPresence();

  const topThree = sortedFriends.slice(0, 3);

  return (
    <div className="px-6 pt-12 pb-6">
      <h1 className="mb-8" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>
        Friends
      </h1>

      {latestBuddyCompletion ? (
        <div
          className="mb-4 border border-moss/50 bg-moss/10 px-4 py-3"
          style={{ borderRadius: '12px' }}
        >
          <p className="text-[12px] text-moss">
            Buddy check-in complete: you and {latestBuddyCompletion.buddyName} finished{' '}
            {latestBuddyCompletion.eventTitle}.
          </p>
        </div>
      ) : null}

      <div
        className="bg-card p-6 mb-6 border border-border"
        style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
      >
        <p className="text-warm-gray mb-4" style={{ fontSize: '13px' }}>
          At a glance — who&apos;s on the trail right now
        </p>
        <div className="flex items-end justify-around gap-4 mb-2">
          {topThree.map((friend) => (
            <div key={friend.id} className="flex flex-col items-center gap-2">
              <MiniMountain progress={friend.altitude} />
              <span className="text-ink" style={{ fontSize: '13px' }}>
                {friend.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
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
        {sortedFriends.map((friend) => (
          <div
            key={friend.id}
            className={`p-4 border ${
              friend.isUser ? 'border-l-4 border-l-terracotta bg-background-solid' : 'bg-card'
            } border-border`}
            style={{ borderRadius: '16px' }}
          >
            <div className="flex items-center gap-3">
              <ClimberAvatar
                name={friend.name}
                size={40}
                color={friend.isUser ? '#C66B52' : '#D99A8F'}
                isActive={friend.status === 'climbing'}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-ink font-semibold">{friend.name}</span>
                  {friend.currentTask && (
                    <span
                      className="text-warm-gray italic truncate"
                      style={{ fontSize: '13px' }}
                    >
                      {friend.currentTask}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className="text-ink"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
                  >
                    {Math.floor(friend.focusedTimeToday / 60)}h{' '}
                    {friend.focusedTimeToday % 60}m
                  </span>
                  <span
                    className="text-warm-gray"
                    style={{ fontSize: '13px' }}
                  >
                    {friend.altitude}% altitude
                  </span>
                </div>
              </div>

              {friend.status === 'climbing' && (
                <div className="w-2 h-2 bg-moss rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
