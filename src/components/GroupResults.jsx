import Flag from "./Flag";
import { GROUP_LETTERS } from "../data/tournament";

// Post-lock view: your predicted ranking next to where each group stands now.
// LIVE position colors mirror the advancement meaning used on the Picks editor
// (1st gold, 2nd azul, 3rd bronze "thirds race", 4th out). In the MY PICK column
// a team is bold-white when it sits in that exact live spot, bronze when it's in
// the live top 2 but a different slot — or bronze with a ³ when a top-2 pick has
// slipped to 3rd (the consolation point) — dim otherwise, same language as the
// leaderboard breakdown.
const ZONE = ["text-gold", "text-azul", "text-bronze", "text-dim/70"];

function Cell({ children }) {
  return (
    <li className="flex items-center gap-1.5 border-t border-line/40 px-3 py-1.5 text-sm first:border-t-0">
      {children}
    </li>
  );
}

export default function GroupResults({ picks, standings }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-dim">
        Your ranking vs. where each group stands now.{" "}
        <span className="text-live">✓</span> marks a pick sitting in that exact spot.
      </p>
      {GROUP_LETTERS.map((g) => {
        const mine = picks?.groups?.[g] ?? [];
        const live = standings?.[g] ?? [];
        const liveCodes = live.map((r) => r.code);
        const liveTop2 = liveCodes.slice(0, 2);
        return (
          <div key={g} className="overflow-clip rounded-xl border border-line bg-panel">
            <div className="border-b border-line bg-panel2/50 px-3 py-1.5">
              <span className="font-display font-bold text-lg text-gold">GROUP {g}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-line/50">
              <div>
                <div className="px-3 pt-1.5 text-[10px] font-bold tracking-wider text-dim">
                  MY PICK
                </div>
                <ul>
                  {[0, 1, 2, 3].map((i) => {
                    const code = mine[i];
                    const exact = code && code === liveCodes[i];
                    const advancing = code && liveTop2.includes(code);
                    // A top-2 pick that's slipped to live 3rd earns the
                    // consolation point — bronze with a ³, mirroring the breakdown.
                    const third = code && i < 2 && code === liveCodes[2];
                    return (
                      <Cell key={i}>
                        <span className="nums w-3 shrink-0 text-xs text-dim">{i + 1}</span>
                        {code ? (
                          <>
                            <Flag code={code} size={16} />
                            <span
                              className={
                                exact
                                  ? "font-bold text-ink"
                                  : advancing || third
                                    ? "font-semibold text-bronze"
                                    : "text-dim/70"
                              }
                            >
                              {code}
                              {third && <sup className="text-gold/90">3</sup>}
                            </span>
                            {exact && <span className="ml-auto text-xs text-live">✓</span>}
                          </>
                        ) : (
                          <span className="text-dim/40">—</span>
                        )}
                      </Cell>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="px-3 pt-1.5 text-[10px] font-bold tracking-wider text-dim">LIVE</div>
                <ul>
                  {[0, 1, 2, 3].map((i) => {
                    const row = live[i];
                    return (
                      <Cell key={i}>
                        <span className={`nums w-3 shrink-0 text-xs ${ZONE[i]}`}>{i + 1}</span>
                        {row ? (
                          <>
                            <Flag code={row.code} size={16} />
                            <span className={i < 2 ? "text-ink" : "text-dim"}>{row.code}</span>
                            <span className="nums ml-auto text-xs text-dim">{row.points}</span>
                          </>
                        ) : (
                          <span className="text-dim/40">—</span>
                        )}
                      </Cell>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
