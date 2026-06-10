import { useMemo, useState } from "react";
import { Check, Copy, Plus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../lib/hooks";
import { createLeague, joinLeague, joinLink } from "../lib/leagues";

// Admin-only: create leagues and grab their shareable join links. Member counts
// come from scanning the users collection's denormalized `leagues` maps.
export default function LeaguesAdmin({ setMsg }) {
  const { user } = useAuth();
  const { docs: leagues } = useCollection("leagues");
  const { docs: users } = useCollection("users");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    for (const u of users) for (const code of Object.keys(u.leagues ?? {})) c[code] = (c[code] ?? 0) + 1;
    return c;
  }, [users]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const code = await createLeague(name, user.uid);
      await joinLeague(user.uid, code, name.trim()); // creator is a member too
      setName("");
      setMsg?.("League created ✓");
      setTimeout(() => setMsg?.(null), 2000);
    } catch (err) {
      console.error(err);
      setMsg?.(`Create failed: ${err.code ?? err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(joinLink(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setMsg?.("Copy failed — long-press the link to copy.");
    }
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-3 space-y-3">
      <h3 className="font-display font-bold text-xl text-gold">LEAGUES</h3>
      <p className="text-xs text-dim">
        Make a league per group (Family, Friends, Work) and share its link. Everyone’s picks and
        scores stay the same — a league just filters the leaderboard.
      </p>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="New league name…"
          className="flex-1 rounded-lg border border-line bg-panel2 px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="flex items-center gap-1 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-pitch disabled:opacity-50"
        >
          <Plus size={16} /> Create
        </button>
      </div>

      <ul className="space-y-2">
        {leagues.length === 0 && <li className="text-xs text-dim/70">No leagues yet.</li>}
        {leagues.map((l) => (
          <li key={l.code} className="rounded-lg border border-line bg-panel2/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">{l.name}</span>
              <span className="flex items-center gap-1 text-xs text-dim">
                <Users size={13} /> {counts[l.code] ?? 0}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-pitch/50 px-2 py-1 text-xs text-dim">
                {joinLink(l.code)}
              </code>
              <button
                onClick={() => copy(l.code)}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink"
              >
                {copied === l.code ? <Check size={13} className="text-live" /> : <Copy size={13} />}
                {copied === l.code ? "Copied" : "Copy"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
