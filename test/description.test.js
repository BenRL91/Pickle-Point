import test from 'node:test';import assert from 'node:assert/strict';
import {parseDescription} from '../src/description.js';
import {beginGame,emptyData,lastGame,activeRecord} from '../src/app-model.js';
test('exact user description starts John right, Jack left, traditional doubles 11/2',()=>{
 const p=parseDescription("Alright, it's John and Jack vs Liam and Ephram in a normal game, John serving first");
 assert.deepEqual(p.teams,[['John','Jack'],['Liam','Ephram']]);assert.equal(p.profileId,'usap-2026-side-out-doubles');assert.equal(p.target,11);assert.equal(p.winBy,2);
 const players=p.teams.flat().map((name,i)=>({id:`p${i}`,name}));const d=beginGame(emptyData(),{sessionId:'s',matchId:'m',gameId:'g',at:'2026-10-04T03:30:00Z',timezone:'America/New_York',settings:p,players});
 const r=activeRecord(d),g=lastGame(r);assert.equal(r.names[g.state.servingSlotId],'John');assert.equal(g.state.serviceSide,'right');assert.equal(g.state.serverNumber,2);assert.equal(r.names[g.state.positions.find(p=>p.team===0&&p.side==='left').slotId],'Jack');
});
test('voice punctuation and second player as server become explicit right-side anchor',()=>{const p=parseDescription('John and Jack versus Liam and Ephram. Jack serving first.');assert.deepEqual(p.teams[0],['Jack','John']);});
test('spoken numeric settings and exact versioned rally format',()=>{const p=parseDescription('John and Jack vs Liam and Ephram in rally scoring to fifteen win by two, Ephram serving first');assert.equal(p.target,15);assert.equal(p.startingTeam,1);assert.deepEqual(p.teams[1],['Ephram','Liam']);assert.equal(p.profileId,'usap-2026-rally-doubles');});
test('singles, Unicode names, multiword names, explicit first server',()=>{const p=parseDescription('José Luis vs Anne-Marie, Anne-Marie serving first');assert.equal(p.profileId,'usap-2026-side-out-singles');assert.equal(p.startingTeam,1);assert.deepEqual(p.teams,[['José Luis'],['Anne-Marie']]);});
test('missing first server is explicitly disclosed',()=>{assert.match(parseDescription('John and Jack vs Liam and Ephram').warnings[0],/John/);});
test('ambiguous or conflicting descriptions never start a guessed game',()=>{for(const input of ['John and John vs Liam and Ephram','John and Jack vs Liam','John vs Sarah, Jeff serving first','John vs Sarah in normal rally scoring','John vs Sarah to 11 to 15','John vs Sarah in doubles','John vs Sarah to 0','<script> vs Sarah',''])assert.throws(()=>parseDescription(input),input);});
test('unsupported advanced instructions are disclosed for review',()=>{assert.ok(parseDescription('John and Jack vs Liam and Ephram in MLP rally scoring, John serving first').warnings.length);});
test('unpunctuated speech transcripts identify the server without absorbing the name into a team',()=>{
 for(const input of ["alright it's John and Jack versus Liam and Ephram in a normal game John serving first",'John and Jack versus Liam and Ephram John serving first','John and Jack versus Liam and Ephram Ephram serving first']){
 const p=parseDescription(input);assert.equal(p.teams.flat().length,4);assert.deepEqual(new Set(p.teams.flat()),new Set(['John','Jack','Liam','Ephram']));assert.equal(p.teams[p.startingTeam][0],input.endsWith('Ephram serving first')?'Ephram':'John');
 }
});
