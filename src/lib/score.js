// Pure scoring engine — no Firebase imports, trivially testable.
// Shapes consumed:
//   groupPicks doc:   { groups: {A:[code×4],…}, thirds: [code×≤8] }
//   bracketPicks doc: { winners: {"R32-1":code, …, "F":code} }
//   results/groups:   { standings: {A:[{code,points,gd,gf},…]}, groupComplete:{A:bool},
//                       thirdsAdvancing: [code×8]|null, allGroupsFinal: bool }
//   results/knockout: { matches: {"R32-1":{winner:code|null},…}, champion: code|null }

import { SCORING } from "../data/scoring";
import { GROUP_LETTERS } from "../data/tournament";

const codes = (rows) => (rows ?? []).map((r) => (typeof r === "string" ? r : r.code));

// A group becomes "live" (projection-eligible) once every team has played ≥1
// match, so its order reflects real results rather than arbitrary 0-0 ties.
export const groupEveryonePlayed = (standings) =>
  standings?.length === 4 && standings.every((r) => (r.played ?? 0) >= 1);

// Winner exact, runner-up exact, right team in the top 2 but the wrong slot, or
// a consolation point when a team you ranked top-2 only manages 3rd (a[2]).
// (At most one top-2 pick can equal the single 3rd-place team, so the consolation
// caps at +1/group and can't co-occur with that same team also scoring as a
// top-2 finish — it never lifts a group above its 6-point max.)
export function scoreGroup(pickedOrder, actualOrder, s = SCORING) {
  const p = pickedOrder ?? [];
  const a = codes(actualOrder);
  if (p.length < 4 || a.length < 2) return 0;
  let pts = 0;
  if (p[0] === a[0]) pts += s.groupWinner;
  if (p[1] === a[1]) pts += s.runnerUp;
  if (p[0] === a[1]) pts += s.top2WrongSlot;
  if (p[1] === a[0]) pts += s.top2WrongSlot;
  if (p[0] === a[2]) pts += s.top2ToThird;
  if (p[1] === a[2]) pts += s.top2ToThird;
  return pts;
}

export function scoreThirds(picked, actualEight, s = SCORING) {
  if (!actualEight?.length) return 0;
  const set = new Set(actualEight);
  return (picked ?? []).filter((c) => set.has(c)).length * s.thirdAdvancer;
}

// Current 3rd-place teams ranked by points → GD → GF, top 8. Projection only —
// the official advancers come from the real R32 field.
export function computeProvisionalThirds(rg) {
  if (!rg?.standings) return [];
  return GROUP_LETTERS.map((g) => rg.standings[g]?.[2])
    .filter(Boolean)
    .sort(
      (x, y) =>
        (y.points ?? 0) - (x.points ?? 0) || (y.gd ?? 0) - (x.gd ?? 0) || (y.gf ?? 0) - (x.gf ?? 0)
    )
    .slice(0, 8)
    .map((r) => r.code);
}

export function scoreBracket(winners, knockout, s = SCORING) {
  if (!knockout?.matches) return 0;
  let pts = 0;
  for (const [slot, m] of Object.entries(knockout.matches)) {
    if (!m?.winner) continue;
    const n = Number(slot.slice(1)); // slots are "M73".."M104"
    const round = n <= 88 ? "R32" : n <= 96 ? "R16" : n <= 100 ? "QF" : n <= 102 ? "SF" : null;
    if (round && winners?.[slot] === m.winner) pts += s.knockout[round];
  }
  if (knockout.champion && winners?.M104 === knockout.champion) pts += s.champion;
  return pts;
}

// Returns { total, final, provisional, detail }. `final` = decided (group
// complete / official thirds / finished knockout). `provisional` = live "if
// standings hold" points, counted ONLY for groups where every team has played
// (and projected thirds once every group has). total = final + provisional.
export function scoreUser(groupPicks, bracketPicks, results, s = SCORING) {
  const rg = results?.groups;
  let final = 0;
  let provisional = 0;
  const detail = { groups: {}, thirds: 0, bracket: 0 };

  for (const g of GROUP_LETTERS) {
    const st = rg?.standings?.[g];
    const complete = !!rg?.groupComplete?.[g];
    const live = !complete && groupEveryonePlayed(st);
    const pts = complete || live ? scoreGroup(groupPicks?.groups?.[g], st, s) : 0;
    detail.groups[g] = pts;
    if (complete) final += pts;
    else if (live) provisional += pts;
  }

  if (rg?.thirdsAdvancing?.length) {
    detail.thirds = scoreThirds(groupPicks?.thirds, rg.thirdsAdvancing, s);
    final += detail.thirds;
  } else if (GROUP_LETTERS.every((g) => groupEveryonePlayed(rg?.standings?.[g]))) {
    detail.thirds = scoreThirds(groupPicks?.thirds, computeProvisionalThirds(rg), s);
    provisional += detail.thirds;
  }

  detail.bracket = scoreBracket(bracketPicks?.winners, results?.knockout, s);
  final += detail.bracket;

  return { total: final + provisional, final, provisional, detail };
}

// rows: [{ uid, displayName, groupPicks, bracketPicks, score }]
// Tiebreaks: total → correct champion → most groups exactly 1-2-3-4 → shared rank.
export function rankUsers(rows, results) {
  const champion = results?.knockout?.champion ?? null;
  const exactGroups = (gp) =>
    GROUP_LETTERS.filter((g) => {
      if (!results?.groups?.groupComplete?.[g]) return false;
      const a = codes(results.groups.standings?.[g]);
      const p = gp?.groups?.[g];
      return a.length === 4 && p?.length === 4 && p.every((c, i) => c === a[i]);
    }).length;

  const ranked = rows
    .map((r) => ({
      ...r,
      tb1: champion && r.bracketPicks?.winners?.M104 === champion ? 1 : 0,
      tb2: exactGroups(r.groupPicks),
    }))
    .sort(
      (x, y) => y.score.total - x.score.total || y.tb1 - x.tb1 || y.tb2 - x.tb2
    );

  let prevKey = null;
  let prevRank = 0;
  ranked.forEach((r, i) => {
    const key = `${r.score.total}|${r.tb1}|${r.tb2}`;
    r.rank = key === prevKey ? prevRank : i + 1;
    if (key !== prevKey) prevRank = i + 1;
    prevKey = key;
  });
  return ranked;
}
