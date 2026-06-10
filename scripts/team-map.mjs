// football-data.org team id -> our 3-letter code.
// Build/verify before June 11 with one call:
//   curl -H "X-Auth-Token: $TOKEN" https://api.football-data.org/v4/competitions/WC/teams
// Match by id, NEVER by name (their names drift: Czechia/Czech Republic, Türkiye/Turkey…).
// Entries left at 0 are unverified placeholders — the bot refuses to run while any remain.

export const FD_TEAM_MAP = {
  // fdId: code        — fill from the /teams call
  0: "MEX",
};

export function isMapComplete() {
  return !Object.keys(FD_TEAM_MAP).includes("0");
}
