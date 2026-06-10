import { useMemo, useState } from "react";
import { GitBranch, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDoc } from "../lib/hooks";
import { useLockedAutosave } from "../lib/autosave";
import { TEAMS } from "../data/tournament";
import { BRACKET_LOCK_AT, GROUP_STAGE_ENDS } from "../data/schedule";
import { FEEDS, ROUNDS, sanitizeWinners, slotOf, teamsOf } from "../data/bracketStructure";
import CountdownBanner from "../components/CountdownBanner";
import SaveStatus from "../components/SaveStatus";
import Flag from "../components/Flag";

function TeamRow({ code, ghost, picked, out, disabled, onPick }) {
  if (!code) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-dim">
        <span className="h-[18px] w-6 rounded-[2px] bg-panel2" />
        {ghost}
      </div>
    );
  }
  return (
    <button
      disabled={disabled}
      onClick={onPick}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
        picked ? "bg-gold/10 text-ink" : out ? "text-dim/70 line-through" : "text-dim"
      } ${disabled ? "cursor-default" : "active:bg-panel2"}`}
    >
      <Flag code={code} size={24} />
      <span className="flex-1 truncate">{TEAMS[code].name}</span>
      {picked && <span className="text-[10px] font-bold tracking-widest text-gold">ADV</span>}
    </button>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const { data: knockout, loading: koLoading } = useDoc("results/knockout");
  const [round, setRound] = useState("R32");

  const koMatches = knockout?.matches;
  const {
    value: winners,
    update,
    saveState,
    locked,
    error,
    loading,
  } = useLockedAutosave({
    path: `bracketPicks/${user.uid}`,
    lockAt: BRACKET_LOCK_AT,
    normalize: (d) => d?.winners ?? {},
    toDoc: (w) => ({ winners: w, champion: w.M104 ?? null }),
  });

  const r32Ready = useMemo(
    () =>
      koMatches &&
      ROUNDS[0].matches.every((n) => koMatches[slotOf(n)]?.home && koMatches[slotOf(n)]?.away),
    [koMatches]
  );

  function pick(n, code) {
    if (locked || !code || !winners) return;
    const slot = slotOf(n);
    const draft = { ...winners };
    if (draft[slot] === code) delete draft[slot];
    else draft[slot] = code;
    update(sanitizeWinners(draft, koMatches));
  }

  if (!r32Ready) {
    return (
      <div className="space-y-3">
        <h2 className="font-display font-bold text-3xl tracking-wide">THE BRACKET</h2>
        <div className="rounded-xl border border-line bg-panel px-4 py-10 text-center text-dim">
          <GitBranch size={36} className="mx-auto mb-3 text-gold" strokeWidth={1.5} />
          <p className="font-display font-bold text-xl text-ink">OPENS AFTER THE GROUP STAGE</p>
          <p className="mt-1 text-sm">
            The real Round of 32 is set on{" "}
            {new Date(GROUP_STAGE_ENDS).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
            . Then you'll pick winners round by round — bigger points every round.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-dim">Can't reach the server right now — your bracket is safe.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gold px-4 py-2 text-sm font-bold text-gold"
        >
          Retry
        </button>
      </div>
    );
  }
  if (koLoading || loading) {
    return <p className="py-16 text-center text-dim">Loading the bracket…</p>;
  }

  const currentRound = ROUNDS.find((r) => r.key === round) ?? ROUNDS[0];
  const champion = winners?.M104;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-3xl tracking-wide">
          {locked ? "MY BRACKET" : "FILL YOUR BRACKET"}
        </h2>
        <SaveStatus state={saveState} />
      </div>

      <CountdownBanner lockAt={BRACKET_LOCK_AT} label="Bracket locks in" />

      <div className="sticky top-0 z-10 -mx-3 bg-pitch/95 px-3 py-2 backdrop-blur">
        <div className="grid grid-cols-5 gap-1">
          {ROUNDS.map((r) => {
            const filled = r.matches.filter((n) => winners?.[slotOf(n)]).length;
            return (
              <button
                key={r.key}
                onClick={() => setRound(r.key)}
                className={`rounded-lg border px-1 py-1.5 text-center ${
                  round === r.key ? "border-gold bg-gold/10 text-gold" : "border-line text-dim"
                }`}
              >
                <div className="font-display font-bold text-sm leading-none">{r.key}</div>
                <div className="nums text-[10px]">
                  {filled}/{r.matches.length}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {currentRound.matches.map((n) => {
          const slot = slotOf(n);
          const [home, away] = teamsOf(n, koMatches, winners);
          const pickHere = winners?.[slot];
          const [f1, f2] = FEEDS[n] ?? [];
          return (
            <div key={n} className="overflow-clip rounded-xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line/60 bg-panel2/50 px-3 py-1">
                <span className="nums text-[11px] font-bold tracking-widest text-dim">
                  MATCH {n}
                </span>
                {koMatches[slot]?.kickoff && (
                  <span className="text-[11px] text-dim/80">
                    {new Date(koMatches[slot].kickoff).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <TeamRow
                code={home}
                ghost={f1 ? `Winner of Match ${f1}` : "TBD"}
                picked={pickHere && pickHere === home}
                out={pickHere && pickHere !== home}
                disabled={locked}
                onPick={() => pick(n, home)}
              />
              <div className="border-t border-line/40" />
              <TeamRow
                code={away}
                ghost={f2 ? `Winner of Match ${f2}` : "TBD"}
                picked={pickHere && pickHere === away}
                out={pickHere && pickHere !== away}
                disabled={locked}
                onPick={() => pick(n, away)}
              />
            </div>
          );
        })}
      </div>

      {round === "F" && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-4 text-center">
          <Trophy size={24} className="mx-auto mb-1 text-gold" />
          {champion ? (
            <p className="font-display font-bold text-2xl">
              YOUR CHAMPION: <span className="text-gold">{TEAMS[champion].name}</span>
            </p>
          ) : (
            <p className="text-sm text-dim">Pick the winner of the Final to crown your champion.</p>
          )}
        </div>
      )}

      <p className="pb-4 text-center text-xs text-dim/80">
        Changing an early pick clears any later picks that depended on it.
      </p>
    </div>
  );
}
