/** Pure, versioned scoring and reversible journal. No I/O, clocks or generated IDs. */
export const ENGINE_VERSION = '0.1.0';
const RULE_SOURCE = 'https://fliphtml5.com/cksih/USAP-Official-Rulebook/';
function freeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
}
const copy = x => structuredClone(x);
export class ScoringError extends Error {
  constructor(code, message) { super(message); this.name = 'ScoringError'; this.code = code; }
}
const fail = (code, message) => { throw new ScoringError(code, message); };
function check(ok, code, message) { if (!ok) fail(code, message); }
const profiles = {};
for (const discipline of ['singles', 'doubles']) {
  for (const scoring of ['side-out', 'rally']) {
    const id = `usap-2026-${scoring}-${discipline}`;
    profiles[id] = {id, version: '2026.1', discipline, scoring, source: RULE_SOURCE,
      ruleSections: scoring === 'rally' ? ['4', '5', '14.A'] : ['4', '5'],
      openingSecondServer: scoring === 'side-out' && discipline === 'doubles',
      secondServer: scoring === 'side-out' && discipline === 'doubles'};
  }
}
profiles['simple-v1'] = {id: 'simple-v1', version: '1', discipline: 'simple', scoring: 'simple',
  source: null, ruleSections: [], openingSecondServer: false, secondServer: false};
export const RULE_PROFILES = freeze(profiles);

export function canonical(value) {
  return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}
/** Corruption checksum, NOT cryptographic authentication. Server must validate events. */
export function checksum(value) {
  let n = 2166136261;
  for (const byte of new TextEncoder().encode(canonical(value))) { n ^= byte; n = Math.imul(n, 16777619); }
  return (n >>> 0).toString(16).padStart(8, '0');
}
function id(v) { return typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v); }
function integer(v, min = 0, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(v) && v >= min && v <= max; }
function normalizeConfig(input) {
  check(input && typeof input === 'object', 'INVALID_CONFIG', 'Game configuration required.');
  const keys = ['gameId', 'profileId', 'target', 'winBy', 'startingTeam', 'teams', 'startingAnchors', 'startingLeftTeam', 'switchEndsAt', 'hostEpoch'];
  check(!Array.isArray(input) && Object.keys(input).every(k => keys.includes(k)), 'INVALID_CONFIG', 'Unexpected game configuration field.');
  const profileId = input.profileId ?? 'usap-2026-side-out-doubles';
  const profile = Object.hasOwn(RULE_PROFILES, profileId) ? RULE_PROFILES[profileId] : null;
  check(profile, 'UNSUPPORTED_RULES', 'This scoring profile is not supported.');
  const teams = input.teams ?? (profile.discipline === 'singles' ? [['a1'], ['b1']] : [['a1', 'a2'], ['b1', 'b2']]);
  const count = profile.discipline === 'singles' ? 1 : 2;
  check(Array.isArray(teams) && teams.length === 2 && Array.from(teams).every(t => Array.isArray(t) &&
    (profile.discipline === 'simple' ? t.length >= 1 && t.length <= 2 : t.length === count) && Array.from(t).every(id)),
  'INVALID_ROSTER', 'Use two valid teams with the required player-slot count.');
  check(new Set(teams.flat()).size === teams.flat().length, 'INVALID_ROSTER', 'Player-slot IDs must be distinct.');
  const anchors = input.startingAnchors ?? teams.map(t => t[0]);
  check(Array.isArray(anchors) && anchors.length === 2 && Array.from(anchors).every((a, i) => teams[i].includes(a)),
    'INVALID_ANCHOR', 'Each starting anchor must belong to its team.');
  const c = {gameId: input.gameId, profileId: profile.id, target: input.target ?? 11,
    winBy: input.winBy ?? 2, startingTeam: input.startingTeam ?? 0,
    teams: copy(teams), startingAnchors: copy(anchors), startingLeftTeam: input.startingLeftTeam ?? 0,
    switchEndsAt: input.switchEndsAt ?? null, hostEpoch: input.hostEpoch ?? 1};
  check(id(c.gameId), 'INVALID_ID', 'A stable game ID is required.');
  check(integer(c.target, 1, 1000) && integer(c.winBy, 1, 100), 'INVALID_SETTINGS', 'Invalid target or win-by.');
  check([0, 1].includes(c.startingTeam) && [0, 1].includes(c.startingLeftTeam), 'INVALID_TEAM', 'Team index must be 0 or 1.');
  check(c.switchEndsAt === null || integer(c.switchEndsAt, 1, c.target), 'INVALID_SETTINGS', 'Invalid end-switch threshold.');
  check(integer(c.hostEpoch, 1), 'INVALID_EPOCH', 'Host epoch must be positive.');
  return c;
}
function initial(c, p) {
  return {points: [0, 0], status: 'playing', winner: null,
    servingTeam: p.scoring === 'simple' ? null : c.startingTeam,
    servingSlotId: p.scoring === 'simple' ? null : c.startingAnchors[c.startingTeam],
    serverNumber: p.secondServer ? 2 : null, openingServiceTurn: p.openingSecondServer,
    leftTeam: c.startingLeftTeam, endsSwitched: false};
}
function slotSide(s, c, team, slot) {
  const anchorRight = s.points[team] % 2 === 0;
  return (slot === c.startingAnchors[team]) === anchorRight ? 'right' : 'left';
}
function rightPlayer(s, c, team) {
  return c.teams[team].find(slot => slotSide(s, c, team, slot) === 'right');
}
function changeServe(s, c, p) {
  s.servingTeam = 1 - s.servingTeam;
  s.servingSlotId = p.discipline === 'singles' ? c.teams[s.servingTeam][0] : rightPlayer(s, c, s.servingTeam);
  s.serverNumber = p.secondServer ? 1 : null;
  s.openingServiceTurn = false;
}
function rally(before, c, p, winner) {
  check(before.status === 'playing', 'GAME_NOT_PLAYING', 'Undo or reopen before scoring another rally.');
  const s = copy(before), effects = [];
  const award = p.scoring !== 'side-out' || winner === s.servingTeam;
  if (award) { check(s.points[winner] < Number.MAX_SAFE_INTEGER, 'SCORE_OVERFLOW', 'Score cannot increase further.'); s.points[winner]++; effects.push('point'); }
  if (p.scoring !== 'simple' && winner !== s.servingTeam) {
    if (p.secondServer && s.serverNumber === 1) {
      s.serverNumber = 2;
      s.servingSlotId = c.teams[s.servingTeam].find(x => x !== s.servingSlotId);
      effects.push('second-server');
    } else { changeServe(s, c, p); effects.push('side-out'); }
  }
  if (c.switchEndsAt !== null && !s.endsSwitched && Math.max(...s.points) >= c.switchEndsAt) {
    s.leftTeam = 1 - s.leftTeam; s.endsSwitched = true; effects.push('switch-ends');
  }
  if (s.points[winner] >= c.target && s.points[winner] - s.points[1 - winner] >= c.winBy) {
    s.winner = winner; s.status = 'completed'; effects.push('game-won');
  }
  return {state: s, effects};
}
function projection(s, c, p, effectiveIds, redo, viewFlipped, sequence) {
  let positions = [], serviceSide = null, receiverSlotId = null;
  if (p.scoring !== 'simple') {
    const st = s.servingTeam, rt = 1 - st;
    if (p.discipline === 'singles') {
      serviceSide = s.points[st] % 2 === 0 ? 'right' : 'left';
      positions = c.teams.flatMap((slots, team) => slots.map(slotId => ({team, slotId, side: serviceSide})));
      receiverSlotId = c.teams[rt][0];
    } else {
      positions = c.teams.flatMap((slots, team) => slots.map(slotId => ({team, slotId, side: slotSide(s, c, team, slotId)})));
      serviceSide = slotSide(s, c, st, s.servingSlotId);
      receiverSlotId = positions.find(x => x.team === rt && x.side === serviceSide).slotId;
    }
  }
  const scoreCall = p.scoring === 'simple' ? [...s.points] : [s.points[s.servingTeam], s.points[1 - s.servingTeam],
    ...(p.secondServer ? [s.serverNumber] : [])];
  const gamePointTeams = [0, 1].filter(t => s.status === 'playing' && s.points[t] + 1 >= c.target &&
    s.points[t] + 1 - s.points[1 - t] >= c.winBy && (p.scoring !== 'side-out' || t === s.servingTeam));
  return {...copy(s), gameId: c.gameId, profileId: p.id, ruleVersion: p.version, engineVersion: ENGINE_VERSION,
    headRevision: sequence, effectiveRallyIds: [...effectiveIds], redoEventId: redo?.id ?? null,
    viewFlipped, screenLeftTeam: viewFlipped ? 1 - s.leftTeam : s.leftTeam,
    serviceSide, receiverSlotId, positions, scoreCall, gamePointTeams};
}

export function createGame(config) {
  const c = normalizeConfig(config), p = RULE_PROFILES[c.profileId];
  return freeze({engineVersion: ENGINE_VERSION, config: c, profile: copy(p), journal: [],
    state: projection(initial(c, p), c, p, [], null, false, 0)});
}
function validateCommand(cmd, revision, c) {
  check(cmd && typeof cmd === 'object' && !Array.isArray(cmd), 'INVALID_COMMAND', 'Command required.');
  const types = ['RallyWon', 'UndoRally', 'RedoRally', 'FlipView', 'AbandonGame', 'ReopenGame'];
  check(types.includes(cmd.type), 'INVALID_COMMAND', 'Unsupported command type.');
  const keys = ['type', 'eventId', 'at', 'expectedRevision', 'hostEpoch', ...(cmd.type === 'RallyWon' ? ['winner'] : [])];
  check(Object.keys(cmd).every(k => keys.includes(k)), 'INVALID_COMMAND', 'Unexpected command field.');
  check(id(cmd.eventId), 'INVALID_ID', 'A stable event ID is required.');
  check(typeof cmd.at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(cmd.at) &&
    Number.isFinite(Date.parse(cmd.at)) && new Date(cmd.at).toISOString().replace('.000Z', 'Z') === cmd.at.replace('.000Z', 'Z'),
  'INVALID_TIME', 'Use an actual UTC ISO event timestamp.');
  check(cmd.expectedRevision === revision, 'STALE_REVISION', 'Reload the latest game revision.');
  check(cmd.hostEpoch === c.hostEpoch, 'STALE_HOST', 'Only the authoritative host can append.');
  if (cmd.type === 'RallyWon') check([0, 1].includes(cmd.winner), 'INVALID_TEAM', 'Rally winner must be team 0 or 1.');
}

/** Rebuild all accepted transitions. Frames hold physical state; perspective is independent. */
function rebuild(config, journal, verify) {
  const c = normalizeConfig(config), p = RULE_PROFILES[c.profileId];
  let frames = [{state: initial(c, p), id: null}], redo = null, flipped = false;
  let lastEffects = [], generated = [], seen = new Set();
  for (const [index, entry] of journal.entries()) {
    check(entry && typeof entry === 'object' && !Array.isArray(entry), 'CORRUPT_JOURNAL', 'Invalid journal entry.');
    const cmd = entry.command;
    validateCommand(cmd, index, c);
    check(!seen.has(cmd.eventId), 'CORRUPT_JOURNAL', 'Duplicate event ID in journal.'); seen.add(cmd.eventId);
    const previous = projection(frames.at(-1).state, c, p, frames.slice(1).map(x => x.id), redo, flipped, index);
    let effects = [], s = frames.at(-1).state;
    if (cmd.type === 'RallyWon') {
      const next = rally(s, c, p, cmd.winner); effects = next.effects;
      frames.push({state: next.state, id: cmd.eventId}); redo = null;
    } else if (cmd.type === 'UndoRally') {
      check(s.status !== 'abandoned', 'GAME_ABANDONED', 'Reopen the game before correcting rallies.');
      check(frames.length > 1, 'NOTHING_TO_UNDO', 'No rally to undo.');
      redo = frames.pop(); effects = ['undo'];
    } else if (cmd.type === 'RedoRally') {
      check(s.status !== 'abandoned', 'GAME_ABANDONED', 'Reopen the game before correcting rallies.');
      check(redo, 'NOTHING_TO_REDO', 'No rally to redo.'); frames.push(redo); redo = null; effects = ['redo'];
    } else if (cmd.type === 'FlipView') { flipped = !flipped; effects = ['view-flipped']; }
    else if (cmd.type === 'AbandonGame') {
      check(s.status === 'playing', 'GAME_NOT_PLAYING', 'Only an active game can be abandoned.');
      frames[frames.length - 1] = {...frames.at(-1), state: {...copy(s), status: 'abandoned'}}; redo = null; effects = ['abandoned'];
    } else {
      check(s.status === 'abandoned', 'NOT_ABANDONED', 'Only an abandoned game needs explicit reopening.');
      frames[frames.length - 1] = {...frames.at(-1), state: {...copy(s), status: 'playing'}}; effects = ['reopened'];
    }
    const state = projection(frames.at(-1).state, c, p, frames.slice(1).map(x => x.id), redo, flipped, index + 1);
    const accepted = {sequence: index + 1, command: copy(cmd), beforeChecksum: checksum(previous),
      afterChecksum: checksum(state), effects, engineVersion: ENGINE_VERSION};
    if (verify) check(canonical(entry) === canonical(accepted), 'CORRUPT_JOURNAL', 'Journal transition failed validation.');
    generated.push(accepted); lastEffects = effects;
  }
  return {engineVersion: ENGINE_VERSION, config: c, profile: copy(p), journal: generated,
    state: projection(frames.at(-1).state, c, p, frames.slice(1).map(x => x.id), redo, flipped, journal.length),
    lastEffects};
}
export function restoreGame(serialized) {
  const raw = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  check(raw && raw.engineVersion === ENGINE_VERSION, 'UNSUPPORTED_ENGINE', 'Use the original engine version to replay this game.');
  check(Array.isArray(raw.journal), 'CORRUPT_JOURNAL', 'Journal must be an array.');
  check(canonical(raw.profile) === canonical(RULE_PROFILES[raw.config?.profileId]), 'UNSUPPORTED_RULES', 'Rule snapshot does not match this version.');
  const {lastEffects, ...game} = rebuild(raw.config, raw.journal, true);
  // Cached state may be stale/corrupt; accepted journal is the recovery authority.
  return freeze(game);
}
export function applyCommand(game, command) {
  const current = restoreGame(game);
  const existing = current.journal.find(e => e.command.eventId === command?.eventId);
  if (existing) {
    check(canonical(existing.command) === canonical(command), 'EVENT_ID_CONFLICT', 'Event ID was reused with different data.');
    return freeze({game: current, effects: [], duplicate: true});
  }
  validateCommand(command, current.journal.length, current.config);
  const {lastEffects, ...next} = rebuild(current.config, [...current.journal, {command}], false);
  return freeze({game: next, effects: lastEffects, duplicate: false});
}
export function serializeGame(game) { return canonical(restoreGame(game)); }
