// Static source of truth for the 2026 World Cup field.
// iso2 feeds flagcdn.com; fdId = football-data.org team id, filled in for v1.1's results bot.

export const TEAMS = {
  // Group A
  MEX: { name: "Mexico", iso2: "mx", fdId: null },
  RSA: { name: "South Africa", iso2: "za", fdId: null },
  KOR: { name: "South Korea", iso2: "kr", fdId: null },
  CZE: { name: "Czechia", iso2: "cz", fdId: null },
  // Group B
  CAN: { name: "Canada", iso2: "ca", fdId: null },
  BIH: { name: "Bosnia & Herzegovina", iso2: "ba", fdId: null },
  QAT: { name: "Qatar", iso2: "qa", fdId: null },
  SUI: { name: "Switzerland", iso2: "ch", fdId: null },
  // Group C
  BRA: { name: "Brazil", iso2: "br", fdId: null },
  MAR: { name: "Morocco", iso2: "ma", fdId: null },
  HAI: { name: "Haiti", iso2: "ht", fdId: null },
  SCO: { name: "Scotland", iso2: "gb-sct", fdId: null },
  // Group D
  USA: { name: "United States", iso2: "us", fdId: null },
  PAR: { name: "Paraguay", iso2: "py", fdId: null },
  AUS: { name: "Australia", iso2: "au", fdId: null },
  TUR: { name: "Türkiye", iso2: "tr", fdId: null },
  // Group E
  GER: { name: "Germany", iso2: "de", fdId: null },
  CUW: { name: "Curaçao", iso2: "cw", fdId: null },
  CIV: { name: "Ivory Coast", iso2: "ci", fdId: null },
  ECU: { name: "Ecuador", iso2: "ec", fdId: null },
  // Group F
  NED: { name: "Netherlands", iso2: "nl", fdId: null },
  JPN: { name: "Japan", iso2: "jp", fdId: null },
  SWE: { name: "Sweden", iso2: "se", fdId: null },
  TUN: { name: "Tunisia", iso2: "tn", fdId: null },
  // Group G
  BEL: { name: "Belgium", iso2: "be", fdId: null },
  EGY: { name: "Egypt", iso2: "eg", fdId: null },
  IRN: { name: "Iran", iso2: "ir", fdId: null },
  NZL: { name: "New Zealand", iso2: "nz", fdId: null },
  // Group H
  ESP: { name: "Spain", iso2: "es", fdId: null },
  CPV: { name: "Cape Verde", iso2: "cv", fdId: null },
  KSA: { name: "Saudi Arabia", iso2: "sa", fdId: null },
  URU: { name: "Uruguay", iso2: "uy", fdId: null },
  // Group I
  FRA: { name: "France", iso2: "fr", fdId: null },
  SEN: { name: "Senegal", iso2: "sn", fdId: null },
  IRQ: { name: "Iraq", iso2: "iq", fdId: null },
  NOR: { name: "Norway", iso2: "no", fdId: null },
  // Group J
  ARG: { name: "Argentina", iso2: "ar", fdId: null },
  ALG: { name: "Algeria", iso2: "dz", fdId: null },
  AUT: { name: "Austria", iso2: "at", fdId: null },
  JOR: { name: "Jordan", iso2: "jo", fdId: null },
  // Group K
  POR: { name: "Portugal", iso2: "pt", fdId: null },
  COD: { name: "DR Congo", iso2: "cd", fdId: null },
  UZB: { name: "Uzbekistan", iso2: "uz", fdId: null },
  COL: { name: "Colombia", iso2: "co", fdId: null },
  // Group L
  ENG: { name: "England", iso2: "gb-eng", fdId: null },
  CRO: { name: "Croatia", iso2: "hr", fdId: null },
  GHA: { name: "Ghana", iso2: "gh", fdId: null },
  PAN: { name: "Panama", iso2: "pa", fdId: null },
};

export const GROUPS = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"],
};

export const GROUP_LETTERS = Object.keys(GROUPS);
export const THIRDS_ADVANCING_COUNT = 8;
