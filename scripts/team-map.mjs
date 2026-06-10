// football-data.org team id -> our 3-letter code.
// Built 2026-06-10 from GET /v4/competitions/WC/teams (48 teams verified).
// Match by id, NEVER by name (their names drift: Czechia/Czech Republic,
// Türkiye/Turkey, and their Uruguay TLA is URY vs our URU).

export const FD_TEAM_MAP = {
  // Group A
  769: "MEX",
  774: "RSA",
  772: "KOR",
  798: "CZE",
  // Group B
  828: "CAN",
  1060: "BIH",
  8030: "QAT",
  788: "SUI",
  // Group C
  764: "BRA",
  815: "MAR",
  836: "HAI",
  8873: "SCO",
  // Group D
  771: "USA",
  761: "PAR",
  779: "AUS",
  803: "TUR",
  // Group E
  759: "GER",
  9460: "CUW",
  1935: "CIV",
  791: "ECU",
  // Group F
  8601: "NED",
  766: "JPN",
  792: "SWE",
  802: "TUN",
  // Group G
  805: "BEL",
  825: "EGY",
  840: "IRN",
  783: "NZL",
  // Group H
  760: "ESP",
  1930: "CPV",
  801: "KSA",
  758: "URU",
  // Group I
  773: "FRA",
  804: "SEN",
  8062: "IRQ",
  8872: "NOR",
  // Group J
  762: "ARG",
  778: "ALG",
  816: "AUT",
  8049: "JOR",
  // Group K
  765: "POR",
  1934: "COD",
  8070: "UZB",
  818: "COL",
  // Group L
  770: "ENG",
  799: "CRO",
  763: "GHA",
  1836: "PAN",
};

export function isMapComplete() {
  return Object.keys(FD_TEAM_MAP).length === 48;
}
