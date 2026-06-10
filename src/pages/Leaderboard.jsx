import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { useCollection, useDoc } from "../lib/hooks";
import { rankUsers, scoreGroup, scoreThirds, scoreUser } from "../lib/score";
import { GROUPS, GROUP_LETTERS, TEAMS } from "../data/tournament";
import { GROUP_LOCK_AT, BRACKET_LOCK_AT } from "../data/schedule";
import Flag from "../components/Flag";

// Pre-lock: who's in. Post-lock: everyone's picks become readable (rules flip at
// the same instant) and the table scores live against results as the bot writes them.

function PickDetail({ row, results }) {
  return (
    <div className="space-y-2 border-t border-line/60 bg-pitch/40 px-3 py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {GROUP_LETTERS.map((g) => {
          const picked = row.groupPicks?.groups?.[g];
          const pts = scoreGroup(picked, results?.groups?.standings?.[g]);
          return (
            <div key={g} className="flex items-center gap-1.5">
              <span className="font-display font-bold text-dim w-3">{g}</span>
              {picked?.length === 4 ? (
                <>
                  {picked.slice(0, 2).map((c) => (
                    <Flag key={c} code={c} size={16} />
                  ))}
                  <span className="text-dim/70 truncate">
                    {picked
                      .slice(0, 2)
                      .map((c) => c)
                      .join(" · ")}
                  </span>
                  <span className="nums ml-auto text-gold">{pts > 0 ? `+${pts}` : ""}</span>
                </>
              ) : (
                <span className="text-dim/50">no pick</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-display font-bold text-dim">THIRDS</span>
        {(row.groupPicks?.thirds ?? []).map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5">
            <Flag code={c} size={14} />
            {c}
          </span>
        ))}
        <span className="nums ml-auto text-gold">
          +{scoreThirds(row.groupPicks?.thirds, results?.groups?.thirdsAdvancing ?? [])}
        </span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const groupsLocked = Date.now() >= GROUP_LOCK_AT;
  const bracketLocked = Date.now() >= BRACKET_LOCK_AT;

  const { docs: users, loading } = useCollection("users");
  const { docs: allGroupPicks } = useCollection("groupPicks", groupsLocked);
  const { docs: allBracketPicks } = useCollection("bracketPicks", bracketLocked);
  const { data: resultsGroups } = useDoc(groupsLocked ? "results/groups" : null);
  const { data: resultsKnockout } = useDoc(groupsLocked ? "results/knockout" : null);

  const [open, setOpen] = useState(null);

  const ranked = useMemo(() => {
    if (!groupsLocked) return [];
    const results = { groups: resultsGroups, knockout: resultsKnockout };
    const byUid = Object.fromEntries(allGroupPicks.map((d) => [d.id, d]));
    const bByUid = Object.fromEntries(allBracketPicks.map((d) => [d.id, d]));
    const rows = users.map((u) => {
      const groupPicks = byUid[u.id] ?? null;
      const bracketPicks = bByUid[u.id] ?? null;
      return {
        uid: u.id,
        displayName: u.displayName,
        photoURL: u.photoURL,
        groupPicks,
        bracketPicks,
        score: scoreUser(groupPicks, bracketPicks, results),
      };
    });
    return rankUsers(rows, results);
  }, [groupsLocked, users, allGroupPicks, allBracketPicks, resultsGroups, resultsKnockout]);

  if (!groupsLocked) {
    return (
      <div className="space-y-3 pb-4">
        <h2 className="font-display font-bold text-3xl tracking-wide">THE TABLE</h2>
        <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-dim">
          <Trophy size={14} className="inline mr-1.5 text-gold" />
          Standings go live at kickoff. Until then — who's in:
        </div>
        <ul className="rounded-xl border border-line bg-panel overflow-hidden">
          {loading && <li className="px-3 py-3 text-sm text-dim">Loading…</li>}
          {!loading && users.length === 0 && (
            <li className="px-3 py-3 text-sm text-dim">Nobody yet — share the link!</li>
          )}
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-b-0"
            >
              {u.photoURL ? (
                <img src={u.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-panel2 font-display font-bold text-dim">
                  {(u.displayName ?? "?")[0]}
                </span>
              )}
              <span className="flex-1 truncate">{u.displayName}</span>
              <span className="text-xs text-dim">in</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const anyProvisional = ranked.some((r) => r.score.provisional > 0);

  return (
    <div className="space-y-3 pb-4">
      <h2 className="font-display font-bold text-3xl tracking-wide">THE TABLE</h2>
      {anyProvisional && (
        <p className="text-xs text-dim">
          <span className="text-live">●</span> includes live "if standings hold" points — they can
          still move until each group finishes.
        </p>
      )}
      <ul className="rounded-xl border border-line bg-panel overflow-hidden">
        {ranked.map((r) => (
          <li key={r.uid} className="border-b border-line/60 last:border-b-0">
            <button
              onClick={() => setOpen(open === r.uid ? null : r.uid)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-panel2"
            >
              <span className="nums w-7 shrink-0 font-display font-bold text-lg text-dim">
                {r.rank}
              </span>
              {r.photoURL ? (
                <img src={r.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-panel2 font-display font-bold text-dim">
                  {(r.displayName ?? "?")[0]}
                </span>
              )}
              <span className="flex-1 truncate">{r.displayName}</span>
              {r.score.provisional > 0 && <span className="text-live text-xs">●</span>}
              <span className="nums font-display font-bold text-xl text-gold">
                {r.score.total}
              </span>
              {open === r.uid ? (
                <ChevronUp size={16} className="text-dim" />
              ) : (
                <ChevronDown size={16} className="text-dim" />
              )}
            </button>
            {open === r.uid && (
              <PickDetail row={r} results={{ groups: resultsGroups, knockout: resultsKnockout }} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
