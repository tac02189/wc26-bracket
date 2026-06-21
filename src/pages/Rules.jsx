import { SCORING, MAX_POINTS } from "../data/scoring";
import { GROUP_LOCK_AT, BRACKET_LOCK_AT } from "../data/schedule";

const fmt = (ts) =>
  new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Row({ label, pts, count }) {
  return (
    <tr className="border-b border-line/60 last:border-b-0">
      <td className="py-2 pr-2">{label}</td>
      <td className="nums py-2 text-right font-display font-bold text-lg text-gold whitespace-nowrap">
        {pts} pts{count ? <span className="text-dim text-sm font-body"> × {count}</span> : null}
      </td>
    </tr>
  );
}

export default function Rules() {
  return (
    <div className="space-y-4 pb-4">
      <h2 className="font-display font-bold text-3xl tracking-wide">HOW IT WORKS</h2>

      <section className="rounded-xl border border-line bg-panel p-4 space-y-2 text-sm">
        <h3 className="font-display font-bold text-xl text-gold">TWO PHASES</h3>
        <p>
          <b>1 · Group stage.</b> Rank all 4 teams in each of the 12 groups, then pick the 8
          third-place teams you think advance. Locks at the opening kickoff —{" "}
          <b>{fmt(GROUP_LOCK_AT)}</b> your time.
        </p>
        <p>
          <b>2 · Knockout bracket.</b> Once the group stage ends (June 27), the real Round of 32 is
          set and the bracket opens here. Pick winners round by round through the Final. Locks at
          the first knockout kickoff — <b>{fmt(BRACKET_LOCK_AT)}</b> your time.
        </p>
        <p className="text-dim">
          Everyone's picks stay hidden until each phase locks, then all are revealed.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <h3 className="font-display font-bold text-xl text-gold mb-1">GROUP STAGE POINTS</h3>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Group winner spot-on" pts={SCORING.groupWinner} count={12} />
            <Row label="Runner-up spot-on" pts={SCORING.runnerUp} count={12} />
            <Row label="Top-2 team, wrong slot" pts={SCORING.top2WrongSlot} />
            <Row label="Top-2 pick finishes 3rd" pts={SCORING.top2ToThird} />
            <Row label="Each correct third that advances" pts={SCORING.thirdAdvancer} count={8} />
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <h3 className="font-display font-bold text-xl text-gold mb-1">KNOCKOUT POINTS</h3>
        <p className="text-xs text-dim mb-1">Per correct winner picked, escalating each round:</p>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Round of 32" pts={SCORING.knockout.R32} count={16} />
            <Row label="Round of 16" pts={SCORING.knockout.R16} count={8} />
            <Row label="Quarterfinals" pts={SCORING.knockout.QF} count={4} />
            <Row label="Semifinals" pts={SCORING.knockout.SF} count={2} />
            <Row label="Champion" pts={SCORING.champion} count={1} />
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4 text-sm space-y-1">
        <h3 className="font-display font-bold text-xl text-gold">THE MATH</h3>
        <p className="nums">
          Max group stage: <b>{MAX_POINTS.groups}</b> · Max knockout: <b>{MAX_POINTS.knockout}</b> ·
          Perfect tournament: <b className="text-gold">{MAX_POINTS.total}</b>
        </p>
        <p className="text-dim">
          Ties broken by: correct champion pick → most groups in exact 1-2-3-4 order → shared rank.
        </p>
      </section>
    </div>
  );
}
