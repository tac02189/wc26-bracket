import { useEffect, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { getLeague, joinLeague } from "../lib/leagues";

// Reads ?join=CODE from the URL and offers to add the signed-in user to that
// league. Clears the param afterward so a refresh doesn't re-prompt.
export default function JoinBanner({ uid, onJoined }) {
  const [league, setLeague] = useState(null); // {code,name} | {code,missing} | null
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code) return;
    getLeague(code).then((l) => setLeague(l ?? { code, missing: true }));
  }, []);

  function clearParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState({}, "", url);
    setLeague(null);
  }

  if (!league) return null;

  if (league.missing) {
    return (
      <Frame onClose={clearParam} tone="bad">
        That invite link isn’t valid anymore.
      </Frame>
    );
  }

  async function join() {
    setStatus("joining");
    try {
      await joinLeague(uid, league.code, league.name);
      setStatus("done");
      onJoined?.(league.code);
      setTimeout(clearParam, 1200);
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <Frame onClose={clearParam} tone="live">
        <Check size={15} className="shrink-0" /> Joined <b>{league.name}</b>!
      </Frame>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
      <UserPlus size={16} className="shrink-0 text-gold" />
      <span className="flex-1">
        Join the <b>{league.name}</b> league?
      </span>
      <button
        onClick={join}
        disabled={status === "joining"}
        className="rounded-md bg-gold px-3 py-1 text-xs font-bold text-pitch disabled:opacity-60"
      >
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      <button onClick={clearParam} className="p-1 text-dim hover:text-ink" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

function Frame({ children, onClose, tone }) {
  const ring = tone === "bad" ? "border-bad/40 bg-bad/10" : "border-live/40 bg-live/10";
  return (
    <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${ring}`}>
      <span className="flex flex-1 items-center gap-1.5">{children}</span>
      <button onClick={onClose} className="p-1 text-dim hover:text-ink" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
