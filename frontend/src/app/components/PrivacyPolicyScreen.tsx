import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-background-solid px-4 py-6 text-ink sm:px-8 lg:px-10">
      <div className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground transition-colors hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </button>

        <div className="flex-1 overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[var(--shadow-card)]">
          <iframe
            title="Privacy Policy"
            src="/privacy.html"
            className="h-full w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}
