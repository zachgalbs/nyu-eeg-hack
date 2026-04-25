import { useNavigate } from "react-router";
import { format } from "date-fns";

const todayEvents = [
  { id: 1, name: "Deep Work: Design System", time: "9:00 AM - 11:00 AM", status: "upcoming" as const },
  { id: 2, name: "Team Standup", time: "11:30 AM - 12:00 PM", status: "upcoming" as const },
  { id: 3, name: "Focus Block: Code Review", time: "2:00 PM - 4:00 PM", status: "upcoming" as const },
];

export function TodayScreen() {
  const navigate = useNavigate();
  const now = new Date();
  const dateTitle = format(now, "MMMM d");
  const weekdayLine = format(now, "EEEE");

  return (
    <div className="px-6 pt-12 pb-6">
      <div
        className="mb-6 h-px w-16 rounded-full bg-mountain/25"
        aria-hidden
      />

      <div className="mb-8">
        <h1 className="mb-1" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>
          {dateTitle}
        </h1>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>
          {weekdayLine} · ready to climb?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {todayEvents.length > 0 ? (
          todayEvents.map((event) => (
            <div
              key={event.id}
              className="border border-border bg-card p-6"
              style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
            >
              <h2 className="mb-1" style={{ fontSize: '20px', fontWeight: 600 }}>
                {event.name}
              </h2>
              <p className="text-warm-gray mb-1" style={{ fontSize: '13px' }}>
                {event.status === 'upcoming' ? 'Upcoming' : 'In progress'}
              </p>
              <p
                className="text-warm-gray mb-4"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
              >
                {event.time}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/mountain/${event.id}`)}
                className="w-full py-3 px-6 bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                style={{ borderRadius: '999px', fontWeight: 600 }}
              >
                Check In
              </button>
            </div>
          ))
        ) : (
          <div
            className="border border-border bg-card p-8 text-center md:col-span-2"
            style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
          >
            <p className="text-warm-gray" style={{ fontSize: '16px' }}>
              add an event to your calendar to start climbing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
