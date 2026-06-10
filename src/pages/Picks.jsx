import { useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLockedAutosave } from "../lib/autosave";
import { GROUP_LETTERS, TEAMS, THIRDS_ADVANCING_COUNT } from "../data/tournament";
import { GROUP_LOCK_AT } from "../data/schedule";
import GroupCard from "../components/GroupCard";
import ThirdsPicker from "../components/ThirdsPicker";
import CountdownBanner from "../components/CountdownBanner";
import SaveStatus from "../components/SaveStatus";

const EMPTY = { groups: {}, thirds: [] };
const normalize = (d) => (d ? { groups: d.groups ?? {}, thirds: d.thirds ?? [] } : EMPTY);

export default function Picks() {
  const { user } = useAuth();
  const {
    value: picks,
    update,
    saveState,
    locked,
    error,
    loading,
  } = useLockedAutosave({
    path: `groupPicks/${user.uid}`,
    lockAt: GROUP_LOCK_AT,
    normalize,
    toDoc: (v) => v,
  });

  const [thirdsDropped, setThirdsDropped] = useState(null);
  const dropTimer = useRef(null);

  function change(mutate) {
    if (locked || !picks) return;
    const draft = mutate(picks);
    // A group re-rank can change who someone's 3rd-placer is — drop stale thirds,
    // and tell the user we did (silently losing an 8/8 costs guaranteed points).
    const validThirds = new Set(
      GROUP_LETTERS.map((g) => draft.groups[g])
        .filter((o) => o?.length === 4)
        .map((o) => o[2])
    );
    const removed = draft.thirds.filter((c) => !validThirds.has(c));
    const next = { ...draft, thirds: draft.thirds.filter((c) => validThirds.has(c)) };
    if (removed.length > 0) {
      setThirdsDropped(removed);
      clearTimeout(dropTimer.current);
      dropTimer.current = setTimeout(() => setThirdsDropped(null), 6000);
    }
    update(next);
  }

  const thirdByGroup = useMemo(() => {
    const m = {};
    for (const g of GROUP_LETTERS) {
      const o = picks?.groups[g];
      m[g] = o?.length === 4 ? o[2] : null;
    }
    return m;
  }, [picks]);

  if (error) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-dim">
          Can't reach the server right now — your saved picks are safe on the server.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gold px-4 py-2 text-sm font-bold text-gold"
        >
          Retry
        </button>
      </div>
    );
  }
  if (loading) {
    return <p className="py-16 text-center text-dim">Loading your picks…</p>;
  }

  const rankedCount = GROUP_LETTERS.filter((g) => picks.groups[g]?.length === 4).length;
  const thirdsShort = rankedCount === 12 && picks.thirds.length < THIRDS_ADVANCING_COUNT;
  const done = rankedCount === 12 && picks.thirds.length === THIRDS_ADVANCING_COUNT;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-3xl tracking-wide">
          {locked ? "MY PICKS" : "MAKE YOUR PICKS"}
        </h2>
        <SaveStatus state={saveState} />
      </div>

      <CountdownBanner lockAt={GROUP_LOCK_AT} label="Group picks lock in" />

      <div
        className={`nums sticky top-0 z-10 rounded-lg border px-3 py-2 text-sm backdrop-blur ${
          done
            ? "border-live/40 bg-live/10 text-live"
            : thirdsDropped || thirdsShort
              ? "border-gold/60 bg-[#2a2110] text-gold"
              : "border-line bg-panel/95 text-dim"
        }`}
      >
        {thirdsDropped ? (
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            {thirdsDropped.map((c) => TEAMS[c].name).join(", ")} left your thirds — re-pick below.
          </span>
        ) : (
          <>
            Groups {rankedCount}/12 · Thirds {picks.thirds.length}/{THIRDS_ADVANCING_COUNT}
            {done && " — you're all set!"}
            {thirdsShort && !locked && " — pick your thirds below!"}
          </>
        )}
      </div>

      {GROUP_LETTERS.map((g) => (
        <GroupCard
          key={g}
          letter={g}
          order={picks.groups[g] ?? []}
          disabled={locked}
          onChange={(order) =>
            change((prev) => ({ ...prev, groups: { ...prev.groups, [g]: order } }))
          }
        />
      ))}

      <ThirdsPicker
        thirdByGroup={thirdByGroup}
        selected={picks.thirds}
        disabled={locked}
        onChange={(thirds) => change((prev) => ({ ...prev, thirds }))}
      />

      <p className="pb-4 text-center text-xs text-dim/80">
        Everything autosaves. You can change picks until kickoff —{" "}
        {new Date(GROUP_LOCK_AT).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        your time.
      </p>
    </div>
  );
}
