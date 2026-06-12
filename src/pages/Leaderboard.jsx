import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Trophy, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection, useDoc } from "../lib/hooks";
import { rankUsers, scoreGroup, scoreThirds, scoreUser } from "../lib/score";
import { GROUP_LETTERS } from "../data/tournament";
import { GROUP_LOCK_AT, BRACKET_LOCK_AT } from "../data/schedule";
import { getLeague, joinLeague } from "../lib/leagues";
import Flag from "../components/Flag";

// Pre-lock: who's in. Post-lock: everyone's picks become readable and the table
// scores live against results. A league just narrows the field — same picks,
// same scores, ranks recomputed within the chosen members.

function PickDetail({ row, results }) {
  return (
    <div className="space-y-2 border-t border-line/60 bg-pitch/40 px-3 py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {GROUP_LETTERS.map((g) => {
          const picked = row.groupPicks?.groups?.[g];
          // Only show points once the group is decided (matches the scoring).
          const complete = results?.groups?.groupComplete?.[g];
          const pts = complete ? scoreGroup(picked, results?.groups?.standings?.[g]) : 0;
          return (
            <div key={g} className="flex items-center gap-1.5">
              <span className="font-display font-bold text-dim w-3">{g}</span>
              {picked?.length === 4 ? (
                <>
                  {picked.slice(0, 2).map((c) => (
                    <Flag key={c} code={c} size={16} />
                  ))}
                  <span className="text-dim/70 truncate">{picked.slice(0, 2).join(" · ")}</span>
                  <span className="nums ml-auto text-gold">{complete ? `+${pts}` : ""}</span>
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

function Avatar({ photoURL, displayName }) {
  return photoURL ? (
    <img src={photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
  ) : (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-panel2 font-display font-bold text-dim">
      {(displayName ?? "?")[0]}
    </span>
  );
}

function JoinByCode({ uid }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState(null);

  async function go() {
    if (!code.trim()) return;
    setMsg("…");
    const league = await getLeague(code);
    if (!league) return setMsg("No league with that code.");
    await joinLeague(uid, league.code, league.name);
    setMsg(`Joined ${league.name}!`);
    setCode("");
    setTimeout(() => { setMsg(null); setOpen(false); }, 1500);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-dim underline">
        Have a league code?
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="League code"
        className="flex-1 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-sm"
      />
      <button onClick={go} className="rounded-lg bg-gold px-3 py-1.5 text-sm font-bold text-pitch">
        Join
      </button>
      {msg && <span className="text-xs text-dim">{msg}</span>}
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const groupsLocked = Date.now() >= GROUP_LOCK_AT;
  const bracketLocked = Date.now() >= BRACKET_LOCK_AT;

  const { docs: users, loading } = useCollection("users");
  const { docs: allGroupPicks } = useCollection("groupPicks", groupsLocked);
  const { docs: allBracketPicks } = useCollection("bracketPicks", bracketLocked);
  const { data: resultsGroups } = useDoc(groupsLocked ? "results/groups" : null);
  const { data: resultsKnockout } = useDoc(groupsLocked ? "results/knockout" : null);

  const [open, setOpen] = useState(null);
  const [league, setLeague] = useState("all");

  const me = useMemo(() => users.find((u) => u.id === user.uid), [users, user.uid]);
  const memberLeagues = me?.leagues ?? {}; // counted + ranked
  const viewLeagues = me?.leaguesView ?? {}; // can watch the board, not a member
  const myLeagues = { ...viewLeagues, ...memberLeagues }; // membership name wins
  // If we left the selected league (or it vanished), fall back to Everyone.
  const activeLeague = league !== "all" && !myLeagues[league] ? "all" : league;

  const members = useMemo(
    () => (activeLeague === "all" ? users : users.filter((u) => u.leagues?.[activeLeague])),
    [users, activeLeague]
  );

  const ranked = useMemo(() => {
    if (!groupsLocked) return [];
    const results = { groups: resultsGroups, knockout: resultsKnockout };
    const byUid = Object.fromEntries(allGroupPicks.map((d) => [d.id, d]));
    const bByUid = Object.fromEntries(allBracketPicks.map((d) => [d.id, d]));
    const rows = members.map((u) => {
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
  }, [groupsLocked, members, allGroupPicks, allBracketPicks, resultsGroups, resultsKnockout]);

  const leagueCodes = Object.keys(myLeagues);
  const selector = leagueCodes.length > 0 && (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
      {[["all", "Everyone"], ...leagueCodes.map((c) => [c, myLeagues[c]])].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLeague(code)}
          className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold ${
            activeLeague === code
              ? "border-gold bg-gold/10 text-gold"
              : "border-line text-dim"
          }`}
        >
          {code !== "all" && !memberLeagues[code] && <Eye size={12} />}
          {label}
        </button>
      ))}
    </div>
  );

  const heading = (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display font-bold text-3xl tracking-wide">THE TABLE</h2>
      {activeLeague !== "all" && (
        <span className="flex items-center gap-1 text-xs text-dim">
          {memberLeagues[activeLeague] ? <Users size={13} /> : <Eye size={13} />}
          {members.length} in {myLeagues[activeLeague]}
        </span>
      )}
    </div>
  );

  if (!groupsLocked) {
    return (
      <div className="space-y-3 pb-4">
        {heading}
        {selector}
        <div className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-dim">
          <Trophy size={14} className="inline mr-1.5 text-gold" />
          Standings go live at kickoff. Until then — who's in:
        </div>
        <ul className="rounded-xl border border-line bg-panel overflow-hidden">
          {loading && <li className="px-3 py-3 text-sm text-dim">Loading…</li>}
          {!loading && members.length === 0 && (
            <li className="px-3 py-3 text-sm text-dim">Nobody here yet — share the link!</li>
          )}
          {members.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-b-0"
            >
              <Avatar photoURL={u.photoURL} displayName={u.displayName} />
              <span className="flex-1 truncate">{u.displayName}</span>
              <span className="text-xs text-dim">in</span>
            </li>
          ))}
        </ul>
        <JoinByCode uid={user.uid} />
      </div>
    );
  }

  const anyComplete = Object.values(resultsGroups?.groupComplete ?? {}).some(Boolean);

  return (
    <div className="space-y-3 pb-4">
      {heading}
      {selector}
      {!anyComplete && (
        <p className="text-xs text-dim">
          Scores are awarded as each group finishes — none have wrapped up yet, so everyone's at 0.
        </p>
      )}
      <ul className="rounded-xl border border-line bg-panel overflow-hidden">
        {ranked.length === 0 && (
          <li className="px-3 py-3 text-sm text-dim">Nobody here yet — share the link!</li>
        )}
        {ranked.map((r) => (
          <li key={r.uid} className="border-b border-line/60 last:border-b-0">
            <button
              onClick={() => setOpen(open === r.uid ? null : r.uid)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-panel2"
            >
              <span className="nums w-7 shrink-0 font-display font-bold text-lg text-dim">
                {r.rank}
              </span>
              <Avatar photoURL={r.photoURL} displayName={r.displayName} />
              <span className="flex-1 truncate">{r.displayName}</span>
              <span className="nums font-display font-bold text-xl text-gold">{r.score.total}</span>
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
      <JoinByCode uid={user.uid} />
    </div>
  );
}
