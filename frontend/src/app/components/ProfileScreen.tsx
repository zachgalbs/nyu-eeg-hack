import type { ReactNode } from "react";
import { ChevronRight, Bell, UserPen, HelpCircle, LogOut } from "lucide-react";
import { ClimberAvatar } from "./ClimberAvatar";

type RowProps = {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
};

function SettingsRow({ icon, label, hint, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-terracotta">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[15px] text-ink"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-warm-gray">{hint}</span>
        ) : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-warm-gray" aria-hidden />
    </button>
  );
}

export function ProfileScreen() {
  return (
    <div className="px-6 pt-10 pb-6">
      <h1
        className="mb-6 text-ink"
        style={{ fontFamily: "var(--font-serif)", fontSize: "32px" }}
      >
        Profile
      </h1>

      <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
          <div className="mb-4 shrink-0 sm:mb-0 sm:mr-6">
            <ClimberAvatar name="You" size={72} variant="pixelCat" isActive />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xl text-ink"
              style={{ fontFamily: "var(--font-pixel)", letterSpacing: "0.02em" }}
            >
              Mountain Cat
            </p>
            <p className="mt-1 text-sm text-warm-gray">@you · NYU CompCal</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-border bg-background-solid/60 px-3 py-1 text-xs text-ink">
                12-day streak
              </span>
              <span className="rounded-full border border-border bg-background-solid/60 px-3 py-1 text-xs text-ink">
                2h 25m today
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-3">
        <p
          className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-warm-gray"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Account
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <SettingsRow
            icon={<UserPen className="h-4 w-4" strokeWidth={2} />}
            label="Edit profile"
            hint="Name, avatar, school"
          />
          <div className="mx-3 h-px bg-border" />
          <SettingsRow
            icon={<Bell className="h-4 w-4" strokeWidth={2} />}
            label="Notifications"
            hint="Focus checks, friend activity"
          />
        </div>
      </section>

      <section>
        <p
          className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-warm-gray"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          CompCal
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <SettingsRow
            icon={<HelpCircle className="h-4 w-4" strokeWidth={2} />}
            label="Help & feedback"
          />
          <div className="mx-3 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-coral/10 active:bg-coral/15"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral/15 text-coral">
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </span>
            <span
              className="flex-1 text-[15px] text-coral"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Sign out
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-warm-gray" aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}
