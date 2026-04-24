import { useState } from "react";
import { ClimberAvatar } from "./ClimberAvatar";
import { MiniMountain } from "./MiniMountain";

interface Friend {
  id: number;
  name: string;
  currentTask: string | null;
  focusedTimeToday: number;
  altitude: number;
  status: 'climbing' | 'summited' | 'idle';
  isUser?: boolean;
}

const friendsData: Friend[] = [
  {
    id: 1,
    name: 'You',
    currentTask: 'Deep Work: Design System',
    focusedTimeToday: 145,
    altitude: 68,
    status: 'climbing',
    isUser: true,
  },
  {
    id: 2,
    name: 'Sarah',
    currentTask: 'Writing Sprint',
    focusedTimeToday: 132,
    altitude: 82,
    status: 'climbing',
  },
  {
    id: 3,
    name: 'Mike',
    currentTask: 'Code Review Session',
    focusedTimeToday: 98,
    altitude: 55,
    status: 'climbing',
  },
  {
    id: 4,
    name: 'Alex',
    currentTask: null,
    focusedTimeToday: 180,
    altitude: 100,
    status: 'summited',
  },
  {
    id: 5,
    name: 'Jordan',
    currentTask: null,
    focusedTimeToday: 0,
    altitude: 0,
    status: 'idle',
  },
];

type TimeFilter = 'today' | 'week' | 'month';

export function FriendsScreen() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

  const sortedFriends = [...friendsData].sort((a, b) => {
    if (a.status === 'climbing' && b.status !== 'climbing') return -1;
    if (a.status !== 'climbing' && b.status === 'climbing') return 1;
    if (a.status === 'summited' && b.status === 'idle') return -1;
    if (a.status === 'idle' && b.status === 'summited') return 1;
    return b.altitude - a.altitude;
  });

  const topThree = sortedFriends.slice(0, 3);

  return (
    <div className="px-6 pt-12 pb-6">
      <h1 className="mb-8" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>
        Friends
      </h1>

      <div
        className="bg-card p-6 mb-6 border border-border"
        style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-end justify-around gap-4 mb-4">
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

      <div className="flex gap-2 mb-6">
        {(['today', 'week', 'month'] as TimeFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-2 transition-colors ${
              timeFilter === filter
                ? 'bg-terracotta text-snow'
                : 'bg-card text-warm-gray border border-border'
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
              friend.isUser ? 'bg-[#FBF2E4] border-l-4 border-l-terracotta' : 'bg-card'
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
