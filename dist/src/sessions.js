/** Pure outing/match container. Identity here is an opaque local owner reference, not authorization. */
import {createGame, restoreGame, ScoringError, canonical} from './engine.js';
const clone = x => structuredClone(x);
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
function check(ok, code, message) { if (!ok) throw new ScoringError(code, message); }
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
const instant = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(x) &&
  Number.isFinite(Date.parse(x)) && new Date(x).toISOString().replace('.000Z', 'Z') === x.replace('.000Z', 'Z');
function matchState(match) {
  const wins = [0, 0];
  for (const g of match.games) if (g.state.status === 'completed') wins[g.state.winner]++;
  const winner = [0, 1].find(t => wins[t] >= match.gamesRequired) ?? null;
  return {...match, wins, winner, status: winner === null ? 'open' : 'completed'};
}
function normalized(session) {
  return freeze({...session, matches: session.matches.map(matchState)});
}
export function createSession({id, ownerId, start, timezone, title = ''}) {
  check(validId(id) && validId(ownerId), 'INVALID_ID', 'Session and owner IDs required.');
  check(instant(start), 'INVALID_TIME', 'Session start requires a UTC instant.');
  try { new Intl.DateTimeFormat('en', {timeZone: timezone}).format(new Date(start)); }
  catch { throw new ScoringError('INVALID_TIMEZONE', 'Use an IANA timezone.'); }
  check(typeof timezone === 'string' && timezone.length > 0, 'INVALID_TIMEZONE', 'Timezone required.');
  check(typeof title === 'string' && title.length <= 200, 'INVALID_TITLE', 'Invalid session title.');
  return normalized({id, ownerId, start, end: null, timezone, title, status: 'active', revision: 0, matches: []});
}
export function addMatch(session, {id, gamesRequired = 1, teams, profileId = 'usap-2026-side-out-doubles', target = 11, winBy = 2}) {
  check(session.status === 'active', 'SESSION_ENDED', 'Session has ended.');
  check(validId(id) && !session.matches.some(m => m.id === id), 'INVALID_ID', 'Use a new stable match ID.');
  check(Number.isInteger(gamesRequired) && gamesRequired >= 1 && gamesRequired <= 5, 'INVALID_SETTINGS', 'Invalid required game wins.');
  check(!session.matches.some(m => m.games.some(g => g.state.status === 'playing')), 'ACTIVE_GAME', 'Finish the current game first.');
  const config = createGame({gameId: 'validate', profileId, teams, target, winBy}).config;
  return normalized({...clone(session), revision: session.revision + 1, matches: [...clone(session.matches),
    {id, gamesRequired, teams: config.teams, profileId, target, winBy, games: []}]});
}
export function addGame(session, matchId, {gameId, ...options}) {
  check(Object.keys(options).every(k => ['startingTeam', 'startingAnchors', 'startingLeftTeam', 'switchEndsAt', 'hostEpoch'].includes(k)),
    'CONFIG_CONFLICT', 'Use a new match to change teams or scoring settings.');
  check(session.status === 'active', 'SESSION_ENDED', 'Session has ended.');
  const match = session.matches.find(m => m.id === matchId);
  check(match, 'MATCH_NOT_FOUND', 'Match not found.');
  check(match.status !== 'completed', 'MATCH_COMPLETED', 'Create a new match after its result.');
  check(!session.matches.some(m => m.games.some(g => g.state.status === 'playing')), 'ACTIVE_GAME', 'Finish the current game first.');
  check(!session.matches.some(m => m.games.some(g => g.config.gameId === gameId)), 'INVALID_ID', 'Game ID already exists.');
  const game = createGame({...options, gameId, teams: match.teams, profileId: match.profileId, target: match.target, winBy: match.winBy});
  return normalized({...clone(session), revision: session.revision + 1,
    matches: session.matches.map(m => m.id === matchId ? {...clone(m), games: [...clone(m.games), game]} : clone(m))});
}
export function updateGame(session, matchId, updatedGame) {
  check(session.status === 'active', 'SESSION_ENDED', 'Session must be active to correct a game.');
  const next = restoreGame(updatedGame), match = session.matches.find(m => m.id === matchId);
  const prior = match?.games.find(g => g.config.gameId === next.config.gameId);
  check(prior, 'GAME_NOT_FOUND', 'Game not found.');
  check(canonical(next.config) === canonical(prior.config), 'CONFIG_CONFLICT', 'Roster/settings cannot change during a game.');
  check(next.journal.length >= prior.journal.length &&
    canonical(next.journal.slice(0, prior.journal.length)) === canonical(prior.journal), 'JOURNAL_CONFLICT', 'Only append accepted game commands.');
  check(next.state.status !== 'playing' || !session.matches.some(m => m.games.some(g =>
    g.config.gameId !== next.config.gameId && g.state.status === 'playing')), 'ACTIVE_GAME', 'Resolve the other active game before reopening.');
  if (canonical(prior) === canonical(next)) return session;
  return normalized({...clone(session), revision: session.revision + 1,
    matches: session.matches.map(m => m.id === matchId ? {...clone(m), games: m.games.map(g =>
      g.config.gameId === next.config.gameId ? next : clone(g))} : clone(m))});
}
export function finishSession(session, end) {
  check(instant(end) && Date.parse(end) >= Date.parse(session.start), 'INVALID_TIME', 'End must be at or after start.');
  if (session.status === 'completed') {
    check(session.end === end, 'SESSION_ENDED', 'Session was already completed with another end time.'); return session;
  }
  check(session.matches.every(m => m.games.every(g => g.state.status !== 'playing')), 'ACTIVE_GAME', 'Complete or abandon the active game explicitly.');
  return normalized({...clone(session), end, status: 'completed', revision: session.revision + 1});
}
export function sessionSummary(session, ownSlotId = null) {
  let wins = 0, losses = 0, completedGames = 0, incompleteGames = 0;
  const players = new Set();
  for (const m of session.matches) for (const g of m.games) {
    g.config.teams.flat().forEach(x => players.add(x));
    if (g.state.status !== 'completed') { incompleteGames++; continue; }
    completedGames++;
    const team = g.config.teams.findIndex(t => t.includes(ownSlotId));
    if (team !== -1) { if (team === g.state.winner) wins++; else losses++; }
  }
  return freeze({sessionId: session.id, matchCount: session.matches.length, completedGames, incompleteGames,
    playerSlotIds: [...players], ownResults: ownSlotId && players.has(ownSlotId) ? {wins, losses} : null,
    durationMs: session.end ? Date.parse(session.end) - Date.parse(session.start) : null});
}
