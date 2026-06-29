import { useMemo, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Eye, Trophy, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection, useDoc } from "../lib/hooks";
import {
  bracketSlotResult,
  computeProvisionalThirds,
  groupEveryonePlayed,
  rankUsers,
  scoreBracket,
  scoreUser,
} from "../lib/score";
import { GROUP_LETTERS, TEAMS } from "../data/tournament";
import { ROUNDS, slotOf } from "../data/bracketStructure";
import { GROUP_LOCK_AT, BRACKET_LOCK_AT } from "../data/schedule";
import { getLeague, joinLeague } from "../lib/leagues";
import Flag from "../components/Flag";

// Pre-lock: who's in. Post-lock: everyone's picks become readable and the table
// scores live against results. A league just narrows the field — same picks,
// same scores, ranks recomputed within the chosen members.

// How a single displayed group pick fared, mirroring scoreGroup exactly so the
// emphasis tracks the points: exact slot (full), right team in the top 2 but the
// wrong slot (1), the 3rd-place consolation (1), or a plain miss. `actual` is the
// real finishing order, or null until the group is being scored.
function pickTier(code, slot, actual) {
  if (!actual) return "pending";
  const exactSlot = slot === 0 ? actual[0] : actual[1];
  const otherSlot = slot === 0 ? actual[1] : actual[0];
  if (code === exactSlot) return "exact";
  if (code === otherSlot) return "wrong";
  if (code === actual[2]) return "third";
  return "miss";
}

const GROUP_PICK_CLASS = {
  exact: "font-bold text-ink", // spot-on, full points
  wrong: "font-semibold text-bronze", // in the top 2 but wrong slot (1 pt) — bronze
  third: "font-semibold text-bronze", // top-2 pick finished 3rd — consolation (1 pt)
  miss: "text-dim/55", // no points
  pending: "text-dim/70", // group not scored yet
};

// A person's champion pick, shown right on the table row once brackets are
// locked. Green once it IS the crowned champion, red once a *different* champion
// is decided, neutral gold until the Final resolves. (Mirrors scoring: the champ
// is graded only against the real champion, not an earlier elimination — so a
// pick eliminated mid-tournament still reads gold until someone is crowned.)
function ChampChip({ code, realChampion }) {
  if (!code) return null;
  const decided = !!realChampion;
  const right = decided && code === realChampion;
  const wrong = decided && code !== realChampion;
  return (
    <span
      title={`Champion pick: ${TEAMS[code]?.name ?? code}`}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 ${
        right ? "border-live/60 bg-live/10" : wrong ? "border-bad/50 bg-bad/10" : "border-gold/40 bg-gold/10"
      }`}
    >
      <Trophy size={11} className={right ? "text-live" : wrong ? "text-bad" : "text-gold"} />
      <Flag code={code} size={14} />
    </span>
  );
}

// The whole bracket in one compact block: each round's picked winners as small
// flags, graded green (correct) / struck-red (wrong) against the real results —
// the same per-slot verdict the scoring engine uses (bracketSlotResult).
function BracketDetail({ winners, knockout }) {
  if (!winners || Object.keys(winners).length === 0) {
    return <div className="text-xs text-dim/55">No bracket picks.</div>;
  }
  const total = scoreBracket(winners, knockout);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-display font-bold text-dim text-xs">BRACKET</span>
        {total > 0 && <span className="nums text-xs text-gold">+{total}</span>}
      </div>
      {ROUNDS.map((r) => {
        const cells = r.matches
          .map((n) => ({ slot: slotOf(n), ...bracketSlotResult(slotOf(n), winners, knockout) }))
          .filter((c) => c.pick);
        if (cells.length === 0) return null;
        const pts = cells.reduce((a, c) => a + c.pts, 0);
        return (
          <div key={r.key} className="flex items-start gap-1.5 text-xs">
            <span className="w-7 shrink-0 pt-0.5 font-display font-bold text-dim">
              {r.key === "F" ? <Trophy size={12} className="text-gold" /> : r.key}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {cells.map((c) => (
                <span
                  key={c.slot}
                  title={TEAMS[c.pick]?.name ?? c.pick}
                  className={`inline-flex items-center gap-1 rounded bg-panel2 px-1 py-0.5 ${
                    c.tier === "correct"
                      ? "font-bold text-ink ring-1 ring-live/50"
                      : c.tier === "wrong"
                        ? "text-bad/70 line-through"
                        : "text-dim/70"
                  }`}
                >
                  <Flag code={c.pick} size={13} />
                  {c.pick}
                </span>
              ))}
            </div>
            {pts > 0 && <span className="nums shrink-0 pt-0.5 text-gold">+{pts}</span>}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[10px] text-dim">
        <span>
          <span className="font-bold text-ink">Ringed</span> = correct
        </span>
        <span>
          <span className="text-bad/70 line-through">Struck</span> = wrong
        </span>
        <span>
          <span className="text-dim/70">Plain</span> = not played yet
        </span>
      </div>
    </div>
  );
}

function PickDetail({ row, results }) {
  const detail = row.score?.detail ?? { groups: {}, thirds: 0 };
  const rg = results?.groups;
  const thirdsOfficial = !!rg?.thirdsAdvancing?.length;

  // Bold-white = this pick is currently paying off (mirrors the scoring engine).
  // Thirds that count right now: the real R32 field if known, else the live
  // projection — the same set scoreThirds uses. Empty until thirds are scoreable.
  const thirdsActual = thirdsOfficial
    ? rg.thirdsAdvancing
    : GROUP_LETTERS.every((g) => groupEveryonePlayed(rg?.standings?.[g]))
      ? computeProvisionalThirds(rg)
      : [];
  const thirdsHit = new Set(thirdsActual);
  // A third you picked that instead finished top-2 in its group earns the
  // consolation point (thirdToTop2). Same top-2 set the engine uses; only
  // meaningful once thirds are scoreable (thirdsActual non-empty).
  const top2 = new Set(
    GROUP_LETTERS.flatMap((g) => (rg?.standings?.[g] ?? []).slice(0, 2).map((r) => r.code))
  );

  return (
    <div className="space-y-2 border-t border-line/60 bg-pitch/40 px-3 py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {GROUP_LETTERS.map((g) => {
          const picked = row.groupPicks?.groups?.[g];
          const pts = detail.groups?.[g] ?? 0;
          const complete = rg?.groupComplete?.[g];
          const st = rg?.standings?.[g];
          // Real finishing order once the group is being scored, else null — each
          // pick is then graded against it (see pickTier) so spot-on (3) reads
          // differently from a wrong-slot / 3rd-place consolation (1).
          const actual =
            complete || groupEveryonePlayed(st) ? (st ?? []).map((r) => r.code) : null;
          return (
            <div key={g} className="flex items-center gap-1.5">
              <span className="font-display font-bold text-dim w-3">{g}</span>
              {picked?.length === 4 ? (
                <>
                  {picked.slice(0, 2).map((c, i) => {
                    const tier = pickTier(c, i, actual);
                    return (
                      <span key={c} className="flex items-center gap-1">
                        <Flag code={c} size={16} />
                        <span className={GROUP_PICK_CLASS[tier]}>
                          {c}
                          {tier === "third" && <sup className="text-gold/90">3</sup>}
                        </span>
                      </span>
                    );
                  })}
                  <span className={`nums ml-auto ${complete ? "text-gold" : "text-live"}`}>
                    {pts ? `+${pts}` : ""}
                  </span>
                </>
              ) : (
                <span className="text-dim/50">no pick</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-dim">
        <span>
          <b className="font-bold text-ink">Bold</b> = exact (3)
        </span>
        <span>
          <span className="font-semibold text-bronze">Bronze</span> = wrong slot (1)
        </span>
        <span>
          <span className="font-semibold text-bronze">
            Bronze<sup className="text-gold/90">3</sup>
          </span>{" "}
          = 3rd (1)
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-display font-bold text-dim">THIRDS</span>
          {(row.groupPicks?.thirds ?? []).map((c) => {
            const advanced = thirdsHit.has(c); // made the R32 as a third (2)
            const consolation = !advanced && top2.has(c); // instead finished top-2 (1)
            return (
              <span
                key={c}
                className={`inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 ${
                  advanced
                    ? `font-bold text-ink ring-1 ${thirdsOfficial ? "ring-gold/40" : "ring-live/40"}`
                    : consolation
                      ? "font-semibold text-bronze ring-1 ring-bronze/50"
                      : "text-dim/70"
                }`}
              >
                <Flag code={c} size={14} />
                {c}
                {consolation && <ArrowUp size={11} strokeWidth={2.5} className="text-bronze" />}
              </span>
            );
          })}
          {detail.thirds > 0 && (
            <span className={`nums ml-auto ${thirdsOfficial ? "text-gold" : "text-live"}`}>
              +{detail.thirds}
            </span>
          )}
        </div>
        {thirdsActual.length > 0 && (row.groupPicks?.thirds?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-dim">
            <span>
              <span className="font-bold text-ink">Ringed</span> = advanced (2)
            </span>
            <span>
              <span className="font-semibold text-bronze">
                Bronze <ArrowUp size={9} strokeWidth={2.5} className="inline align-middle text-bronze" />
              </span>{" "}
              = finished top-2 (1)
            </span>
          </div>
        )}
      </div>
      {row.bracketPicks?.winners && (
        <div className="border-t border-line/60 pt-2">
          <BracketDetail winners={row.bracketPicks.winners} knockout={results?.knockout} />
        </div>
      )}
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

  const anyProvisional = ranked.some((r) => r.score.provisional > 0);
  const anyScored = ranked.some((r) => r.score.total > 0);

  return (
    <div className="space-y-3 pb-4">
      {heading}
      {selector}
      {anyProvisional ? (
        <p className="text-xs text-dim">
          <span className="text-live">●</span> live "if standings hold" points — counted once every
          team in a group has played. They can still change; points turn solid when a group finishes.
        </p>
      ) : !anyScored ? (
        <p className="text-xs text-dim">
          Scores appear once every team in a group has played its first game.
        </p>
      ) : null}
      <ul className="rounded-xl border border-line bg-panel overflow-hidden">
        {ranked.length === 0 && (
          <li className="px-3 py-3 text-sm text-dim">Nobody here yet — share the link!</li>
        )}
        {ranked.map((r) => (
          <li key={r.uid} className="border-b border-line/60 last:border-b-0">
            <button
              onClick={() => setOpen(open === r.uid ? null : r.uid)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-panel2"
            >
              <span className="nums w-6 shrink-0 font-display font-bold text-lg text-dim">
                {r.rank}
              </span>
              <Avatar photoURL={r.photoURL} displayName={r.displayName} />
              <span className="flex-1 truncate">{r.displayName}</span>
              {bracketLocked && (
                <ChampChip
                  code={r.bracketPicks?.champion ?? r.bracketPicks?.winners?.M104 ?? null}
                  realChampion={resultsKnockout?.champion ?? null}
                />
              )}
              {r.score.provisional > 0 && <span className="text-live text-xs">●</span>}
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
