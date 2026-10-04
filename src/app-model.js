import {applyCommand,restoreGame} from './engine.js';
import {createSession,addMatch,addGame,updateGame,finishSession} from './sessions.js';
export const defaults={profileId:'usap-2026-side-out-doubles',target:11,winBy:2,startingTeam:0,switchEndsAt:null};
export const emptyData=()=>({schema:1,revision:0,players:[],sessions:[],prefs:{...defaults,selfId:null}});
export const allGames=r=>r.core.matches.flatMap(m=>m.games);
export const lastGame=r=>allGames(r).at(-1);
export const activeRecord=d=>d.sessions.find(r=>r.core.status==='active');
export function validateData(d) {
  if(!d || d.schema!==1 || !Number.isSafeInteger(d.revision) || !Array.isArray(d.sessions)||!Array.isArray(d.players)||!d.prefs) throw new Error('This saved data version cannot be opened. Export a backup before making changes.');
  const copy=structuredClone(d);
  for(const r of copy.sessions) {
    if(!r.core?.matches||!r.names||!r.assignments) throw new Error('Session data needs recovery. No data has been replaced.');
    for(const m of r.core.matches) m.games=m.games.map(restoreGame);
  }
  if(copy.sessions.filter(r=>r.core.status==='active').length>1) throw new Error('Multiple active sessions need recovery.');
  return copy;
}
const ensure=(ok,msg)=>{if(!ok)throw new Error(msg);};
export function beginGame(data,{sessionId,matchId,gameId,at,timezone,title='Open play',venue='',settings=defaults,players=[]}) {
  const d=structuredClone(data); let record=activeRecord(d);
  if(!record) {
    record={core:createSession({id:sessionId,ownerId:'local-owner',start:at,timezone,title}),venue,names:{},assignments:{}};
    d.sessions.unshift(record);
  }
  ensure(!allGames(record).some(g=>g.state.status==='playing'),'Finish the current game first.');
  const count=settings.profileId.endsWith('singles')?1:2;
  const selected=players.filter(Boolean); ensure(new Set(selected.map(p=>p.id)).size===selected.length,'A player can only occupy one position.');
  const teams=[0,1].map(t=>Array.from({length:count},(_,i)=>{
    const slot=`${gameId}_${t}_${i}`,p=players[t*count+i];
    record.names[slot]=p?.name||`Guest ${t*count+i+1}`;record.assignments[slot]=p?.id||null;return slot;
  }));
  record.core=addMatch(record.core,{id:matchId,teams,profileId:settings.profileId,target:settings.target,winBy:settings.winBy});
  record.core=addGame(record.core,matchId,{gameId,startingTeam:settings.startingTeam,switchEndsAt:settings.switchEndsAt});
  for(const p of selected) {const stored=d.players.find(x=>x.id===p.id); if(stored)stored.lastUsed=at;}
  d.prefs={...d.prefs,...settings};return d;
}
export function commandGame(data,sessionId,gameId,command) {
  const d=structuredClone(data),r=d.sessions.find(r=>r.core.id===sessionId);ensure(r,'Session not found.');
  const m=r.core.matches.find(m=>m.games.some(g=>g.config.gameId===gameId));ensure(m,'Game not found.');
  const g=m.games.find(g=>g.config.gameId===gameId);
  const result=applyCommand(g,command);r.core=updateGame(r.core,m.id,result.game);return {data:d,effects:result.effects};
}
export function endSession(data,sessionId,at) {
  const d=structuredClone(data),r=d.sessions.find(r=>r.core.id===sessionId);ensure(r,'Session not found.');
  r.core=finishSession(r.core,at);return d;
}
export function assignPlayers(data,sessionId,gameId,playerIds) {
  const d=structuredClone(data),r=d.sessions.find(r=>r.core.id===sessionId);ensure(r,'Session not found.');
  const g=allGames(r).find(g=>g.config.gameId===gameId);ensure(g,'Game not found.');
  const slots=g.config.teams.flat();ensure(playerIds.length===slots.length,'Select each player position.');
  const named=playerIds.filter(Boolean);ensure(new Set(named).size===named.length,'Each player needs a different position.');
  slots.forEach((slot,i)=>{const p=d.players.find(p=>p.id===playerIds[i]);ensure(!playerIds[i]||p,'Player no longer exists.');r.assignments[slot]=p?.id||null;r.names[slot]=p?.name||`Guest ${i+1}`;});
  return d;
}
export function removePlayer(data,id) {
  const d=structuredClone(data);d.players=d.players.filter(p=>p.id!==id);
  if(d.prefs.selfId===id)d.prefs.selfId=null;
  for(const r of d.sessions)for(const [slot,pid]of Object.entries(r.assignments))if(pid===id){r.assignments[slot]=null;r.names[slot]='Guest';}
  return d;
}
export function playerStats(data,id) {
  const out={games:0,wins:0,losses:0,differential:0}; if(!id)return out;
  for(const r of data.sessions)for(const g of allGames(r)) {
    if(g.state.status!=='completed')continue;
    const t=g.config.teams.findIndex(team=>team.some(slot=>r.assignments[slot]===id));if(t<0)continue;
    out.games++;out.wins+=Number(g.state.winner===t);out.losses+=Number(g.state.winner!==t);out.differential+=g.state.points[t]-g.state.points[1-t];
  }return out;
}
