import Flag from "./Flag";
import { TEAMS, GROUP_LETTERS, THIRDS_ADVANCING_COUNT } from "../data/tournament";

// Pick exactly 8 of your 12 predicted third-place teams to advance.
// thirdByGroup: { A: "KOR" | null, ... } — null until that group is ranked.
export default function ThirdsPicker({ thirdByGroup, selected, onChange, disabled }) {
  const full = selected.length >= THIRDS_ADVANCING_COUNT;

  function toggle(code) {
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code));
    else if (!full) onChange([...selected, code]);
  }

  return (
    <div className="rounded-xl border border-line bg-panel overflow-clip">
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-line bg-panel2/90 backdrop-blur">
        <span className="font-display font-bold text-xl text-gold">BEST THIRDS</span>
        <span className={`nums font-display font-bold text-lg ${full ? "text-live" : "text-dim"}`}>
          {selected.length}/{THIRDS_ADVANCING_COUNT}
        </span>
      </div>

      <p className="px-3 pt-2 text-xs text-dim">
        These are your predicted 3rd-place teams. Pick the {THIRDS_ADVANCING_COUNT} you think
        advance to the Round of 32.
      </p>

      <div className="grid grid-cols-2 gap-2 p-3">
        {GROUP_LETTERS.map((g) => {
          const code = thirdByGroup[g];
          if (!code) {
            return (
              <div
                key={g}
                className="flex items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-2.5 text-xs text-dim"
              >
                <span className="font-display font-bold">{g}</span>
                <span>rank Group {g} first</span>
              </div>
            );
          }
          const on = selected.includes(code);
          const blocked = !on && (full || disabled);
          return (
            <button
              key={g}
              disabled={disabled || blocked}
              onClick={() => toggle(code)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors ${
                on
                  ? "border-gold bg-gold/10 text-ink"
                  : blocked
                    ? "border-line bg-panel2/40 text-dim/70"
                    : "border-line text-dim active:bg-panel2"
              }`}
            >
              <span className="font-display font-bold text-dim">{g}</span>
              <Flag code={code} size={22} className={blocked ? "opacity-50" : ""} />
              <span className="flex-1 truncate">{TEAMS[code].name}</span>
              {on && <span className="text-gold text-xs font-bold">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
