import { useNavigate } from "react-router";

const todayEvents = [
  { id: 1, name: "Deep Work: Design System", time: "9:00 AM - 11:00 AM", status: "upcoming" },
  { id: 2, name: "Team Standup", time: "11:30 AM - 12:00 PM", status: "upcoming" },
  { id: 3, name: "Focus Block: Code Review", time: "2:00 PM - 4:00 PM", status: "upcoming" },
];

export function TodayScreen() {
  const navigate = useNavigate();

  return (
    <div className="px-6 pt-12 pb-6">
      <div className="mb-8">
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>
          April 24
        </h1>
        <p className="text-warm-gray" style={{ fontSize: '13px' }}>
          ready to climb?
        </p>
      </div>

      <div className="space-y-4">
        {todayEvents.length > 0 ? (
          todayEvents.map((event) => (
            <div
              key={event.id}
              className="bg-card p-6 border border-border"
              style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
            >
              <h2 className="mb-2" style={{ fontSize: '20px', fontWeight: 600 }}>
                {event.name}
              </h2>
              <p
                className="text-warm-gray mb-4"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
              >
                {event.time}
              </p>
              <button
                onClick={() => navigate(`/mountain/${event.id}`)}
                className="w-full py-3 px-6 bg-terracotta text-snow transition-opacity hover:opacity-90"
                style={{ borderRadius: '999px', fontWeight: 600 }}
              >
                Check In
              </button>
            </div>
          ))
        ) : (
          <div
            className="bg-card p-8 border border-border text-center"
            style={{ borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}
          >
            <p className="text-warm-gray">
              add an event to your calendar to start climbing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
