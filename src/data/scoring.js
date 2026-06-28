// The single tweakable scoring config. The Rules page renders FROM this object,
// and the scoring engine reads it — change values here, redeploy, done.

export const SCORING = {
  groupWinner: 3, // predicted group winner finishes 1st
  runnerUp: 3, // predicted runner-up finishes 2nd
  top2WrongSlot: 1, // team predicted top-2 advances top-2 but in the other slot
  top2ToThird: 1, // team predicted top-2 only manages 3rd — consolation
  thirdToTop2: 1, // team you picked as an advancing 3rd instead finishes top-2 — consolation
  thirdAdvancer: 2, // each correctly picked third-place team that advances
  knockout: { R32: 2, R16: 4, QF: 6, SF: 8 }, // per correct match-winner pick
  champion: 16, // correctly picking the winner of the Final
};

export const MAX_POINTS = {
  groups: 12 * (SCORING.groupWinner + SCORING.runnerUp) + 8 * SCORING.thirdAdvancer, // 88
  knockout:
    16 * SCORING.knockout.R32 +
    8 * SCORING.knockout.R16 +
    4 * SCORING.knockout.QF +
    2 * SCORING.knockout.SF +
    SCORING.champion, // 120
};
MAX_POINTS.total = MAX_POINTS.groups + MAX_POINTS.knockout; // 208
