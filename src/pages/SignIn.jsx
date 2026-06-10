import { useState } from "react";
import { Trophy } from "lucide-react";
import { signInWithGoogle } from "../context/AuthContext";
import CountdownBanner from "../components/CountdownBanner";
import { GROUP_LOCK_AT } from "../data/schedule";

export default function SignIn() {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError(
        err?.code === "auth/popup-blocked"
          ? "Your browser blocked the sign-in popup — allow popups and try again."
          : "Sign-in didn't go through. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 py-[env(safe-area-inset-top)] text-center">
      <Trophy size={56} className="text-gold" strokeWidth={1.5} />
      <div>
        <h1 className="font-display font-bold text-5xl leading-none tracking-wide">
          WC<span className="text-gold">26</span> POOL
        </h1>
        <p className="mt-2 text-dim">
          Family &amp; friends World Cup predictions.
          <br />
          Rank the groups. Pick the thirds. Fill the bracket.
        </p>
      </div>

      <CountdownBanner lockAt={GROUP_LOCK_AT} label="Group picks lock in" />

      <button
        onClick={go}
        disabled={busy}
        className="flex items-center gap-3 rounded-xl bg-gold px-6 py-3 font-bold text-pitch active:bg-golddark disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#013d23" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
        </svg>
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>

      {error && <p className="text-sm text-bad max-w-xs">{error}</p>}

      <p className="text-xs text-dim/70 max-w-xs">
        Sign in once and your picks save automatically as you make them.
      </p>
    </div>
  );
}
