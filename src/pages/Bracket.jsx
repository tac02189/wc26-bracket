import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, GitBranch, Trophy, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDoc } from "../lib/hooks";
import { useLockedAutosave } from "../lib/autosave";
import { bracketSlotResult, scoreBracket } from "../lib/score";
import { SCORING } from "../data/scoring";
import { TEAMS } from "../data/tournament";
import { BRACKET_LOCK_AT, GROUP_STAGE_ENDS } from "../data/schedule";
import { BRACKET_ORDERS, FEEDS, ROUNDS, sanitizeWinners, slotOf, teamsOf } from "../data/bracketStructure";
import CountdownBanner from "../components/CountdownBanner";
import SaveStatus from "../components/SaveStatus";
import Flag from "../components/Flag";

const SH = 470; // bracket viewport height
const PT = 88; // vertical pitch between focused-round match cards
const CARD_H = 78; // match-card height (so connectors meet the card's middle)

const kickoffLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

// One side of a focused-round match. A real team is a tap target; an unresolved
// feeder is a dim "Winner of M__" ghost. Once the real result is in, the picked
// row is graded green (correct, +pts) or red (wrong), and the team that actually
// won is flagged green even if it wasn't the pick — so right/wrong is unmissable.
function FocusRow({ code, ghost, picked, out, won, result, pts, disabled, onPick }) {
  if (!code) {
    return (
      <div className="flex h-[30px] items-center gap-2 px-2.5 text-sm text-dim/60">
        <span className="h-[15px] w-5 shrink-0 rounded-[2px] bg-panel2" />
        <span className="truncate">{ghost}</span>
      </div>
    );
  }
  const correct = result === "correct";
  const wrong = result === "wrong";
  const cls = correct
    ? "bg-live/15 font-bold text-ink"
    : wrong
      ? "bg-bad/15 font-bold text-bad"
      : picked
        ? "bg-gold/10 font-bold text-ink"
        : won
          ? "text-live"
          : out
            ? "text-dim/60 line-through"
            : "text-dim";
  return (
    <button
      disabled={disabled}
      onClick={onPick}
      className={`flex h-[30px] w-full items-center gap-2 px-2.5 text-left text-sm transition-colors ${cls} ${
        disabled ? "cursor-default" : "active:bg-panel2"
      }`}
    >
      <Flag code={code} size={20} />
      <span className="flex-1 truncate">{TEAMS[code].name}</span>
      {correct && <span className="nums shrink-0 text-[10px] font-bold text-gold">+{pts}</span>}
      {correct && <CheckCircle2 size={14} className="shrink-0 text-live" />}
      {wrong && <XCircle size={14} className="shrink-0 text-bad" />}
      {!picked && won && <CheckCircle2 size={13} className="shrink-0 text-live/80" />}
      {picked && !correct && !wrong && <Check size={14} className="shrink-0 text-gold" />}
    </button>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const { data: knockout, loading: koLoading } = useDoc("results/knockout");
  // An admin-granted late-pick grace pushes this user's effective lock forward.
  const { data: grace } = useDoc(`bracketGrace/${user.uid}`);
  const effectiveLock = Math.max(BRACKET_LOCK_AT, grace?.until?.toMillis?.() ?? 0);
  const [focus, setFocus] = useState(0); // index into ROUNDS — the zoomed-in round
  const [dir, setDir] = useState(1); // slide direction for the round transition

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
    lockAt: effectiveLock,
    normalize: (d) => d?.winners ?? {},
    toDoc: (w) => ({ winners: w, champion: w.M104 ?? null }),
  });

  const r32Ready = useMemo(
    () =>
      koMatches &&
      ROUNDS[0].matches.every((n) => koMatches[slotOf(n)]?.home && koMatches[slotOf(n)]?.away),
    [koMatches]
  );

  // Measure the viewport so the card / peek / connectors scale to the phone
  // width (the shell is max-w-md, but real phones run 320–448px).
  const vpRef = useRef(null);
  const [vw, setVw] = useState(360);
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, [r32Ready]);

  // Horizontal swipe jumps round to round; vertical scrolls within a round.
  // `moved` keeps a horizontal drag from also registering as a pick.
  const drag = useRef({ down: false, sx: 0, sy: 0, axis: null });
  const moved = useRef(false);
  useEffect(() => {
    const onMove = (e) => {
      const d = drag.current;
      if (!d.down) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) d.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (d.axis === "h" && Math.abs(dx) > 10) moved.current = true;
    };
    const onUp = (e) => {
      const d = drag.current;
      if (!d.down) return;
      d.down = false;
      if (d.axis === "h") {
        const dx = e.clientX - d.sx;
        if (dx < -45) go(1);
        else if (dx > 45) go(-1);
      }
      setTimeout(() => (moved.current = false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function go(delta) {
    setDir(delta);
    setFocus((f) => Math.max(0, Math.min(ROUNDS.length - 1, f + delta)));
  }

  function pick(n, code) {
    if (locked || !code || !winners || moved.current) return;
    const slot = slotOf(n);
    const draft = { ...winners };
    if (draft[slot] === code) delete draft[slot];
    else draft[slot] = code;
    const next = sanitizeWinners(draft, koMatches);
    update(next);
    // Carry the user to the next round once this one is fully picked.
    const cur = ROUNDS[focus];
    const wasDone = cur.matches.every((m) => winners[slotOf(m)]);
    const justDone = cur.matches.every((m) => next[slotOf(m)]);
    if (justDone && !wasDone && focus < ROUNDS.length - 1) setTimeout(() => go(1), 480);
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

  const RKEYS = ROUNDS.map((r) => r.key);
  const focusKey = RKEYS[focus];
  const fo = BRACKET_ORDERS[focusKey];
  const nextKey = RKEYS[focus + 1];
  const no = nextKey ? BRACKET_ORDERS[nextKey] : null;

  const blockH = fo.length * PT;
  const top = Math.max(10, (SH - blockH) / 2);
  const H = Math.max(SH, blockH + 20);
  const cen = (i) => top + i * PT + CARD_H / 2;

  // Responsive geometry: focused card on the left, next round peeking on the
  // right with the connectors bridging the gap.
  const fcLeft = 6;
  const fcW = Math.round(vw * 0.64);
  const fcRight = fcLeft + fcW;
  const pkLeft = fcRight + 30;
  const pkW = Math.round(vw * 0.3);
  const midX = (fcRight + pkLeft) / 2;

  const champion = winners?.M104;
  const realChamp = knockout?.champion ?? null;
  const champCorrect = champion && realChamp && champion === realChamp;
  const champWrong = champion && realChamp && champion !== realChamp;
  const bracketPts = scoreBracket(winners, knockout);
  const filled = (key) => BRACKET_ORDERS[key].filter((n) => winners?.[slotOf(n)]).length;
  // Connector tint: green/red once the feeder match is decided, gold for an
  // ungraded pick, faint line for an empty slot.
  const stroke = (n) => {
    const sr = bracketSlotResult(slotOf(n), winners, knockout);
    if (sr.tier === "correct") return "var(--color-live)";
    if (sr.tier === "wrong") return "var(--color-bad)";
    return sr.pick ? "var(--color-bronze)" : "var(--color-line)";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-3xl tracking-wide">
          {locked ? "MY BRACKET" : "FILL YOUR BRACKET"}
        </h2>
        {locked ? (
          <span className="nums inline-flex items-center gap-1 font-display font-bold text-gold">
            <Trophy size={15} />
            {bracketPts} <span className="text-sm font-normal text-dim">pts</span>
          </span>
        ) : (
          <SaveStatus state={saveState} />
        )}
      </div>

      <CountdownBanner lockAt={effectiveLock} label="Bracket locks in" />

      <div className="grid grid-cols-5 gap-1">
        {ROUNDS.map((r, i) => (
          <button
            key={r.key}
            onClick={() => {
              setDir(i > focus ? 1 : -1);
              setFocus(i);
            }}
            className={`rounded-lg border px-1 py-1.5 text-center ${
              i === focus ? "border-gold bg-gold/10 text-gold" : "border-line text-dim"
            }`}
          >
            <div className="font-display font-bold text-sm leading-none">{r.key}</div>
            <div className="nums text-[10px]">
              {filled(r.key)}/{r.matches.length}
            </div>
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-pitch/40" style={{ height: SH }}>
        <div
          ref={vpRef}
          onPointerDown={(e) => {
            const d = drag.current;
            d.down = true;
            d.sx = e.clientX;
            d.sy = e.clientY;
            d.axis = null;
            moved.current = false;
          }}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [touch-action:pan-y]"
        >
          <div
            key={focus}
            className="animate-bracket-in relative"
            style={{ height: H, "--bx": dir > 0 ? "30px" : "-30px" }}
          >
            <svg
              width={vw}
              height={H}
              viewBox={`0 0 ${vw} ${H}`}
              className="pointer-events-none absolute left-0 top-0"
            >
              {no
                ? no.map((m, j) => {
                    const a = fo[2 * j];
                    const b = fo[2 * j + 1];
                    const ay = cen(2 * j);
                    const by = cen(2 * j + 1);
                    const py = (ay + by) / 2;
                    return (
                      <g key={m}>
                        <path d={`M${fcRight} ${ay} H${midX} V${py}`} fill="none" strokeWidth="1.6" stroke={stroke(a)} />
                        <path d={`M${fcRight} ${by} H${midX} V${py}`} fill="none" strokeWidth="1.6" stroke={stroke(b)} />
                        <path d={`M${midX} ${py} H${pkLeft}`} fill="none" strokeWidth="1.6" stroke="var(--color-line)" />
                      </g>
                    );
                  })
                : (
                    <path
                      d={`M${fcRight} ${cen(0)} H${pkLeft}`}
                      fill="none"
                      strokeWidth="1.6"
                      stroke={
                        champCorrect
                          ? "var(--color-live)"
                          : champWrong
                            ? "var(--color-bad)"
                            : champion
                              ? "var(--color-gold)"
                              : "var(--color-line)"
                      }
                    />
                  )}
            </svg>

            {fo.map((n, i) => {
              const slot = slotOf(n);
              const [home, away] = teamsOf(n, koMatches, winners);
              const pickHere = winners?.[slot];
              const [f1, f2] = FEEDS[n] ?? [];
              // Grade against the real result for this slot (mirrors scoreBracket).
              const sr = bracketSlotResult(slot, winners, knockout);
              const realWinner = n === 104 ? realChamp : koMatches[slot]?.winner ?? null;
              return (
                <div
                  key={n}
                  className="absolute overflow-hidden rounded-lg border border-line bg-panel"
                  style={{ left: fcLeft, width: fcW, top: top + i * PT }}
                >
                  <div className="flex h-[18px] items-center justify-between border-b border-line/60 bg-panel2/50 px-2.5">
                    <span className="nums text-[10px] font-bold tracking-widest text-dim">M{n}</span>
                    <span className="text-[10px] text-dim/80">{kickoffLabel(koMatches[slot]?.kickoff)}</span>
                  </div>
                  <FocusRow
                    code={home}
                    ghost={f1 ? `Winner of M${f1}` : "TBD"}
                    picked={pickHere && pickHere === home}
                    out={pickHere && pickHere !== home}
                    won={!!home && realWinner === home}
                    result={pickHere === home ? sr.tier : null}
                    pts={sr.pts}
                    disabled={locked}
                    onPick={() => pick(n, home)}
                  />
                  <div className="h-px bg-line/40" />
                  <FocusRow
                    code={away}
                    ghost={f2 ? `Winner of M${f2}` : "TBD"}
                    picked={pickHere && pickHere === away}
                    out={pickHere && pickHere !== away}
                    won={!!away && realWinner === away}
                    result={pickHere === away ? sr.tier : null}
                    pts={sr.pts}
                    disabled={locked}
                    onPick={() => pick(n, away)}
                  />
                </div>
              );
            })}

            {no
              ? no.map((m, j) => {
                  const py = (cen(2 * j) + cen(2 * j + 1)) / 2;
                  const [h, a] = teamsOf(m, koMatches, winners);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (moved.current) return;
                        setDir(1);
                        setFocus(focus + 1);
                      }}
                      className="absolute rounded-lg border border-line bg-panel/60 px-2 py-1 text-left"
                      style={{ left: pkLeft, width: pkW, top: py - 20 }}
                    >
                      <div className="font-display text-[9px] font-bold tracking-wide text-dim">{nextKey}</div>
                      {[h, a].map((c, k) => (
                        <div
                          key={k}
                          className={`flex items-center gap-1.5 truncate text-[11px] ${c ? "text-ink" : "text-dim/50"}`}
                        >
                          {c ? <Flag code={c} size={14} /> : <span className="h-3 w-4 shrink-0 rounded-[1px] bg-panel2" />}
                          {c ?? "—"}
                        </div>
                      ))}
                    </button>
                  );
                })
              : (
                  <div
                    className={`absolute rounded-lg border px-3 py-3 text-center ${
                      champCorrect
                        ? "border-live/50 bg-live/10"
                        : champWrong
                          ? "border-bad/50 bg-bad/10"
                          : "border-gold/40 bg-gold/10"
                    }`}
                    style={{ left: pkLeft - 4, width: pkW + 14, top: cen(0) - 30 }}
                  >
                    <Trophy
                      size={20}
                      className={`mx-auto ${champCorrect ? "text-live" : champWrong ? "text-bad" : "text-gold"}`}
                    />
                    {champion ? (
                      <div
                        className={`mt-1 font-display font-bold text-sm ${
                          champCorrect ? "text-live" : champWrong ? "text-bad" : "text-gold"
                        }`}
                      >
                        {TEAMS[champion].name}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-dim">Champion</div>
                    )}
                    {champCorrect && (
                      <div className="nums mt-0.5 text-[10px] font-bold text-live">+{SCORING.champion} ✓</div>
                    )}
                    {champWrong && <div className="mt-0.5 text-[10px] text-bad">missed</div>}
                  </div>
                )}
          </div>
        </div>

        {[-1, 1].map((d) => (
          <button
            key={d}
            disabled={focus + d < 0 || focus + d > ROUNDS.length - 1}
            onClick={() => go(d)}
            style={{ [d < 0 ? "left" : "right"]: 4 }}
            className="absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel/90 text-gold disabled:opacity-25"
            aria-label={d < 0 ? "Previous round" : "Next round"}
          >
            {d < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        ))}
      </div>

      {locked && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-[11px] text-dim/80">
          <span>
            <span className="text-live">●</span> correct (+pts)
          </span>
          <span>
            <span className="text-bad">●</span> wrong
          </span>
          <span>
            <span className="text-gold">●</span> awaiting result
          </span>
        </div>
      )}
      <p className="text-center text-xs text-dim/80">
        {locked
          ? "Swipe or tap a round to move across the bracket."
          : "Swipe or tap a round to move across the bracket. Changing an early pick clears any later picks that depended on it."}
      </p>
    </div>
  );
}
