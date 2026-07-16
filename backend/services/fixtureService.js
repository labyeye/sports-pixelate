// Builds the fixture list for a tournament. Both generators take a list of
// { team: ObjectId, name: String } slots (already shuffled by the caller if
// random seeding was requested) and return plain objects ready for
// Fixture.insertMany — round/nextFixture wiring is filled in by the caller
// once Mongo has assigned each fixture's real _id.

function roundRobinRounds(teams) {
  // Standard circle method: fix the first team, rotate the rest each round.
  const list = [...teams];
  if (list.length % 2 !== 0) list.push(null); // bye slot
  const n = list.length;
  const totalRounds = n - 1;
  const half = n / 2;

  const rounds = [];
  let current = list;
  for (let r = 0; r < totalRounds; r++) {
    const matches = [];
    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a && b) matches.push([a, b]);
    }
    rounds.push(matches);
    const fixed = current[0];
    const rest = current.slice(1);
    rest.unshift(rest.pop());
    current = [fixed, ...rest];
  }
  return rounds;
}

// Returns { rounds: [[{teamA, teamB}, ...], ...], byeRound1Indices: Set }
// where round 1 may contain matches with a null teamB (a bye — teamA
// advances automatically). Later rounds always have both slots eventually
// filled by real matches or a single round-1 bye propagation.
function knockoutRounds(teams) {
  const n = teams.length;
  let size = 1;
  while (size < n) size *= 2;
  const matchCount = size / 2;
  const byesNeeded = size - n;
  const fullMatches = matchCount - byesNeeded;

  // Byes must each land in their own match — pair every bye with a real
  // team rather than padding nulls contiguously, which can otherwise leave
  // two byes facing each other in round 1.
  const round1 = [];
  let idx = 0;
  for (let i = 0; i < fullMatches; i++) {
    round1.push([teams[idx], teams[idx + 1]]);
    idx += 2;
  }
  for (let i = 0; i < byesNeeded; i++) {
    round1.push([teams[idx], null]);
    idx += 1;
  }

  const rounds = [round1];
  let count = matchCount / 2;
  while (count >= 1) {
    rounds.push(Array.from({ length: count }, () => [null, null]));
    count /= 2;
  }
  return rounds;
}

function knockoutRoundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex; // 1 = final, 2 = semifinal, ...
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinal";
  if (fromEnd === 3) return "Quarterfinal";
  return `Round ${roundIndex + 1}`;
}

function toSlot(team) {
  return team
    ? { team: team.team, name: team.name }
    : { team: null, name: null };
}

module.exports = {
  roundRobinRounds,
  knockoutRounds,
  knockoutRoundLabel,
  toSlot,
};
