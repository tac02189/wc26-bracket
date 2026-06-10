import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Flag from "./Flag";
import { TEAMS, GROUPS } from "../data/tournament";

// Tap-to-rank: tap teams in predicted finishing order. Tapping a ranked team
// clears it and everything ranked after it. Ranking 3 teams auto-fills the 4th.
// `order` is an array of 0–4 team codes; index 0 = predicted group winner.

export function toggleRank(order, teamCodes, code) {
  const idx = order.indexOf(code);
  let next;
  if (idx >= 0) {
    next = order.slice(0, idx);
  } else {
    next = [...order, code];
  }
  if (next.length === 3) {
    const last = teamCodes.find((c) => !next.includes(c));
    next = [...next, last];
  }
  return next;
}

const BADGE = {
  0: "bg-gold text-pitch", // 1st — advances
  1: "bg-gold/80 text-pitch", // 2nd — advances
  2: "bg-amber-700/60 text-ink", // 3rd — maybe (thirds race)
  3: "bg-panel2 text-dim", // 4th — out
};

export default function GroupCard({ letter, order, onChange, disabled }) {
  const teamCodes = GROUPS[letter];
  const complete = order.length === 4;
  // Once fully ranked, show rows in predicted order; while partial, keep draw order stable.
  const rows = complete ? order : teamCodes;
  // Reset clears the group AND (via the page's sanitizer) its third — two-step confirm.
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!confirmReset) return undefined;
    const t = setTimeout(() => setConfirmReset(false), 2500);
    return () => clearTimeout(t);
  }, [confirmReset]);

  return (
    <div className="rounded-xl border border-line bg-panel overflow-clip">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-panel2/50">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-xl text-gold">GROUP {letter}</span>
          <span className="text-xs text-dim">
            {complete ? "ranked" : "tap in predicted finishing order"}
          </span>
        </div>
        {order.length > 0 && !disabled && (
          <button
            onClick={() => {
              if (confirmReset) {
                onChange([]);
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
            className="relative -m-1 rounded-md p-2.5 text-dim hover:text-ink"
            aria-label={`Reset group ${letter}`}
          >
            {confirmReset ? (
              <span className="text-xs font-bold text-bad">Reset?</span>
            ) : (
              <RotateCcw size={18} />
            )}
          </button>
        )}
      </div>

      <ul>
        {rows.map((code) => {
          const rank = order.indexOf(code);
          const ranked = rank >= 0;
          return (
            <li key={code} className="border-b border-line/60 last:border-b-0">
              <button
                disabled={disabled}
                onClick={() => onChange(toggleRank(order, teamCodes, code))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  ranked && rank < 2 ? "bg-gold/5" : ""
                } ${disabled ? "cursor-default" : "active:bg-panel2"}`}
              >
                <span
                  className={`nums w-6 h-6 shrink-0 rounded-md grid place-items-center font-display font-bold text-sm ${
                    ranked ? BADGE[rank] : "border border-line text-dim/50"
                  }`}
                >
                  {ranked ? rank + 1 : ""}
                </span>
                <Flag code={code} size={26} />
                <span className={`flex-1 truncate ${ranked && rank > 1 ? "text-dim" : ""}`}>
                  {TEAMS[code].name}
                </span>
                {ranked && rank < 2 && (
                  <span className="text-[10px] font-bold tracking-widest text-gold/80">ADV</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
