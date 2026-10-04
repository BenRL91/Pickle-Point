/** Bounded, local description parser. Never changes stored games or guesses an unmatched server. */
const numbers = {one:1,two:2,three:3,seven:7,eleven:11,fifteen:15,twenty:20,'twenty one':21,'twenty-one':21};
const numeric = s => /^\d+$/.test(s) ? Number(s) : numbers[s.toLowerCase()];
const clean = s => s.trim().replace(/^[,.;\s]+|[,.;\s]+$/g,'').replace(/\s+/g,' ');
export function parseDescription(input) {
  if(typeof input !== 'string' || !input.trim() || input.length > 600) throw new Error('Describe two teams and who serves first.');
  let text = input.replace(/[’]/g,"'").replace(/\b(win(?:ning)?\s+by)\s+(one|two|three)\b/gi,(_,p,n)=>`${p} ${numbers[n.toLowerCase()]}`);
  text = text.replace(/\b(to|play to|playing to)\s+(twenty[ -]one|eleven|fifteen|seven)\b/gi,(_,p,n)=>`${p} ${numeric(n)}`);
  const warnings = [];
  const targetHits=[...text.matchAll(/\b(?:to|target(?: score)?(?: is)?)\s+(\d+)\b/gi)];
  const winHits=[...text.matchAll(/\bwin(?:ning)?\s+by\s+(\d+)\b/gi)];
  if(new Set(targetHits.map(x=>x[1])).size>1 || new Set(winHits.map(x=>x[1])).size>1) throw new Error('I heard conflicting scores. Choose the target and win-by below.');
  const target=targetHits.length ? Number(targetHits[0][1]) : 11, winBy=winHits.length ? Number(winHits[0][1]) : 2;
  if(target<1||target>100||winBy<1||winBy>10) throw new Error('Use a target from 1–100 and win by 1–10.');
  const rally=/\brally(?:\s+scoring)?\b/i.test(text);
  if(rally && /\b(side[ -]?out|normal|traditional)\b/i.test(text)) throw new Error('Choose either traditional side-out or rally scoring.');
  if(/\b(MLP|freeze|best of|switch ends|win on serve|no[- ]ad)\b/i.test(text)) warnings.push('Extra format instructions need manual review; this preview uses one game and no automatic end switch.');
  const parseTeams = phrase => {
    phrase=phrase.replace(/^(?:(?:all?right|okay|ok|let's play|let us play)[,\s]*)?(?:(?:it'?s|it is|we have)\s+)?/i,'');
    const roster=phrase.split(/\s+(?:in\s+(?:a\s+)?|playing\s+|play\s+|to\s+\d|win(?:ning)?\s+by\s+|best of\s+|switch ends\s+|(?:a\s+)?(?:normal|traditional|rally|side[ -]?out|singles|doubles)\s+game\b)/i)[0];
    const halves=roster.split(/\s+(?:vs\.?|versus|against)\s+/i);
    if(halves.length!==2)return null;
    const result=halves.map(t=>clean(t).split(/\s+(?:and|&)\s+|\s*\+\s*/i).map(clean));
    if(![1,2].includes(result[0].length)||result[0].length!==result[1].length||result.flat().some(n=>!n||n.length>60||!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(n)))return null;
    return result;
  };
  const suffix=text.match(/\s+(?:is\s+)?serv(?:ing|es?)\s*(?:first)?\s*[.!]?$/i);
  let serverName=null,teams;
  if(suffix){
    const before=text.slice(0,suffix.index).trim(),candidates=[];
    // Speech providers often omit punctuation. Find a suffix that exactly matches one roster name.
    for(let i=0;i<before.length;i++){
      if(i>0&&!/[\s,.;]/.test(before[i-1]))continue;
      const name=clean(before.slice(i));if(!name||name.length>60)continue;
      const phrase=clean(before.slice(0,i)).replace(/\s+(?:with|and)$/i,'');
      const roster=parseTeams(phrase);
      if(roster&&roster.flat().filter(n=>n.toLocaleLowerCase()===name.toLocaleLowerCase()).length===1)candidates.push({name,roster});
    }
    const unique=[...new Map(candidates.map(c=>[JSON.stringify(c),c])).values()];
    if(unique.length!==1)throw new Error('The first server did not match one player. Check the names, or use “, John serving first”.');
    serverName=unique[0].name;teams=unique[0].roster;
  }else{
    if(/\bserv(?:ing|es?)\b/i.test(text))throw new Error('Put the server at the end, for example: “, John serving first”.');
    teams=parseTeams(text);
  }
  if(!teams)throw new Error('Use one player per team for singles or two per team for doubles, separated by “versus”.');
  const keys=teams.flat().map(n=>n.toLocaleLowerCase());
  if(new Set(keys).size!==keys.length)throw new Error('Two players have the same name. Add a last name or initial to distinguish them.');
  const discipline=teams[0].length===2?'doubles':'singles';
  if((/\bsingles\b/i.test(input)&&discipline!=='singles')||(/\bdoubles\b/i.test(input)&&discipline!=='doubles')) throw new Error('The player count does not match singles/doubles.');
  let startingTeam=0;
  if(serverName) {
    const indexes=teams.flat().map((n,i)=>n.toLocaleLowerCase()===serverName.toLocaleLowerCase()?i:-1).filter(i=>i>=0);
    if(indexes.length!==1) throw new Error(`“${serverName}” did not match one player. Check the server's name.`);
    startingTeam=Math.floor(indexes[0]/teams[0].length);
    // First entry is each team's right-side anchor at 0–0.
    const side=teams[startingTeam]; if(side[0].toLowerCase()!==serverName.toLowerCase()) side.reverse();
  } else warnings.push(`${teams[0][0]} is set to serve first. Change this if needed.`);
  return {teams,startingTeam,profileId:`usap-2026-${rally?'rally':'side-out'}-${discipline}`,target,winBy,switchEndsAt:null,warnings};
}
