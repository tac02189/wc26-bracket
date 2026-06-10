import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { db } from "../firebase";
import { useDoc } from "../lib/hooks";
import { GROUPS, GROUP_LETTERS, TEAMS } from "../data/tournament";
import GroupCard from "../components/GroupCard";
import Flag from "../components/Flag";

// Manual fallback for everything the results bot does. Writes the exact same
// doc shapes, so bot and human edits are interchangeable. Rules gate writes to
// the admin UID; this page rendering at all is cosmetic.

async function save(path, data, setMsg) {
  try {
    await setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    setMsg("Saved ✓");
    setTimeout(() => setMsg(null), 2000);
  } catch (err) {
    console.error(err);
    setMsg(`Write failed: ${err.code ?? err.message}`);
  }
}

export default function Admin() {
  const { data: results } = useDoc("results/groups");
  const { data: knockout } = useDoc("results/knockout");
  const { data: settings } = useDoc("config/settings");
  const [msg, setMsg] = useState(null);

  const standings = results?.standings ?? {};
  const groupComplete = results?.groupComplete ?? {};

  // Actual 3rd-placers per entered standings — candidates for the official thirds list.
  const thirdCandidates = GROUP_LETTERS.map((g) => standings[g]?.[2]?.code).filter(Boolean);
  const thirds = results?.thirdsAdvancing ?? [];

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-3xl tracking-wide">ADMIN</h2>
        {msg && <span className="text-xs text-live">{msg}</span>}
      </div>

      <p className="text-xs text-dim">
        Manual override for everything the results bot writes. Group results: tap actual finishing
        order, then mark final. The bot (
        <a
          href="https://github.com/tac02189/wc26-bracket/actions"
          className="text-gold inline-flex items-center gap-0.5"
          target="_blank"
          rel="noreferrer"
        >
          Actions <ExternalLink size={11} />
        </a>
        ) normally does all this.
      </p>

      <section className="space-y-3">
        <h3 className="font-display font-bold text-xl text-gold">ACTUAL GROUP RESULTS</h3>
        {GROUP_LETTERS.map((g) => {
          const order = (standings[g] ?? []).map((r) => r.code);
          return (
            <div key={g} className="space-y-1">
              <GroupCard
                letter={g}
                order={order}
                disabled={false}
                onChange={(next) =>
                  save(
                    "results/groups",
                    {
                      standings: {
                        ...standings,
                        [g]: next.map((code) => ({ code })),
                      },
                    },
                    setMsg
                  )
                }
              />
              <label className="flex items-center gap-2 px-1 text-xs text-dim">
                <input
                  type="checkbox"
                  checked={!!groupComplete[g]}
                  onChange={(e) =>
                    save(
                      "results/groups",
                      {
                        groupComplete: { ...groupComplete, [g]: e.target.checked },
                        allGroupsFinal: GROUP_LETTERS.every((x) =>
                          x === g ? e.target.checked : !!groupComplete[x]
                        ),
                      },
                      setMsg
                    )
                  }
                />
                Group {g} final
              </label>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-line bg-panel p-3 space-y-2">
        <h3 className="font-display font-bold text-xl text-gold">
          OFFICIAL THIRDS — {thirds.length}/8
        </h3>
        <p className="text-xs text-dim">
          The 8 third-place teams that actually advance (from the real R32 field).
        </p>
        <div className="grid grid-cols-2 gap-2">
          {thirdCandidates.map((code) => {
            const on = thirds.includes(code);
            return (
              <button
                key={code}
                onClick={() =>
                  save(
                    "results/groups",
                    {
                      thirdsAdvancing: on
                        ? thirds.filter((c) => c !== code)
                        : [...thirds, code].slice(0, 8),
                    },
                    setMsg
                  )
                }
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                  on ? "border-gold bg-gold/10" : "border-line text-dim"
                }`}
              >
                <Flag code={code} size={20} />
                {TEAMS[code].name}
                {on && <CheckCircle2 size={14} className="ml-auto text-gold" />}
              </button>
            );
          })}
          {thirdCandidates.length === 0 && (
            <p className="col-span-2 text-xs text-dim/60">Enter group results first.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-3 space-y-2">
        <h3 className="font-display font-bold text-xl text-gold">KNOCKOUT WINNERS</h3>
        {!knockout?.matches && (
          <p className="text-xs text-dim/60">
            No knockout matches yet — the bot writes them when the R32 is drawn, or seed them from
            the Firestore console.
          </p>
        )}
        {Object.entries(knockout?.matches ?? {})
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([slot, m]) => (
            <div key={slot} className="flex items-center gap-2 text-sm">
              <span className="nums w-12 shrink-0 font-display font-bold text-dim">{slot}</span>
              {[m.home, m.away].map((c) =>
                c ? (
                  <button
                    key={c}
                    onClick={() =>
                      save(
                        "results/knockout",
                        {
                          matches: {
                            ...knockout.matches,
                            [slot]: { ...m, winner: m.winner === c ? null : c, status: "FINISHED" },
                          },
                          ...(slot === "F" ? { champion: m.winner === c ? null : c } : {}),
                        },
                        setMsg
                      )
                    }
                    className={`flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                      m.winner === c ? "border-gold bg-gold/10" : "border-line text-dim"
                    }`}
                  >
                    <Flag code={c} size={18} />
                    {c}
                  </button>
                ) : (
                  <span key={`${slot}-tbd`} className="flex-1 text-center text-dim/50">TBD</span>
                )
              )}
            </div>
          ))}
      </section>

      <section className="rounded-xl border border-line bg-panel p-3 space-y-2">
        <h3 className="font-display font-bold text-xl text-gold">PHASE & NOTICE</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-dim">Phase</span>
          <select
            value={settings?.phase ?? "groups"}
            onChange={(e) => save("config/settings", { phase: e.target.value }, setMsg)}
            className="rounded-lg border border-line bg-panel2 px-2 py-1.5"
          >
            <option value="groups">groups</option>
            <option value="bracket-open">bracket-open</option>
            <option value="knockout">knockout</option>
            <option value="done">done</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-dim">Banner notice (empty = hidden)</span>
          <input
            defaultValue={settings?.notice ?? ""}
            onBlur={(e) => save("config/settings", { notice: e.target.value }, setMsg)}
            className="w-full rounded-lg border border-line bg-panel2 px-2 py-1.5 text-sm"
            placeholder="e.g. Bracket picks are open!"
          />
        </div>
        <p className="text-[11px] text-dim/60">
          Lock times are enforced in firestore.rules — changing them needs a rules redeploy, not
          this page.
        </p>
      </section>
    </div>
  );
}
