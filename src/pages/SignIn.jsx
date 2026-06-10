import { useState } from "react";
import { Trophy } from "lucide-react";
import { signInWithGoogle, signInWithPin } from "../context/AuthContext";
import CountdownBanner from "../components/CountdownBanner";
import { GROUP_LOCK_AT } from "../data/schedule";

function mapError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "That PIN isn't valid — ask Thiago for your PIN.";
    case "auth/too-many-requests":
      return "Too many tries — wait a minute and try again.";
    case "auth/operation-not-allowed":
      return "PIN sign-in isn't switched on yet — tell Thiago.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google popup — allow popups or use a PIN below.";
    default:
      return "Something went wrong. Try again.";
  }
}

export default function SignIn() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapError(err?.code));
    } finally {
      setBusy(false);
    }
  }

  async function pinSubmit(e) {
    e.preventDefault();
    if (pin.trim().length < 4) return setError("Enter your 4-digit PIN.");
    setBusy(true);
    setError(null);
    try {
      await signInWithPin(pin, name);
    } catch (err) {
      setError(mapError(err?.code));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-ink placeholder:text-dim/60";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 py-[env(safe-area-inset-top)] text-center">
      <Trophy size={52} className="text-gold" strokeWidth={1.5} />
      <div>
        <h1 className="font-display font-bold text-5xl leading-none tracking-wide">
          WC<span className="text-gold">26</span> POOL
        </h1>
        <p className="mt-2 text-dim">Family &amp; friends World Cup predictions.</p>
      </div>

      <CountdownBanner lockAt={GROUP_LOCK_AT} label="Group picks lock in" />

      <button
        onClick={google}
        disabled={busy}
        className="flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-gold px-6 py-3 font-bold text-pitch active:bg-golddark disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#013d23" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
        </svg>
        Sign in with Google
      </button>

      <div className="flex w-full max-w-xs items-center gap-3 text-xs text-dim">
        <span className="h-px flex-1 bg-line" />
        or use your PIN
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={pinSubmit} className="flex w-full max-w-xs flex-col gap-2.5">
        <input
          className={field}
          placeholder="Your name (shown on leaderboard)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          className={`${field} text-center tracking-[0.5em] nums`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="• • • •"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl border border-gold bg-gold/10 px-6 py-2.5 font-bold text-gold active:bg-gold/20 disabled:opacity-60"
        >
          {busy ? "…" : "Join with PIN"}
        </button>
      </form>

      {error && <p className="max-w-xs text-sm text-bad">{error}</p>}

      <p className="max-w-xs text-xs text-dim/70">
        No email needed for a PIN — Thiago gives you one. Your picks save automatically.
      </p>
    </div>
  );
}
