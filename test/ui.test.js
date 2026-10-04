import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';import {IDBFactory} from 'fake-indexeddb';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('DOM smoke: describe → preview → start → rally → undo → complete → next game → persisted session',async()=>{
 const {window,document}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'));
 globalThis.window=window;globalThis.document=document;globalThis.indexedDB=new IDBFactory();globalThis.BroadcastChannel=class{postMessage(){}};
 Object.defineProperty(globalThis,'navigator',{value:{storage:{persist:async()=>false}},configurable:true});
 let hash='';globalThis.location={get hash(){return hash;},set hash(v){hash=v.startsWith('#')?v:'#'+v;window.dispatchEvent(new window.Event('hashchange'));}};
 const modal=document.querySelector('#modal');modal.showModal=()=>modal.setAttribute('open','');modal.close=()=>modal.removeAttribute('open');Object.defineProperty(modal,'open',{get:()=>modal.hasAttribute('open')});
 globalThis.FormData=class{constructor(form){this.values=new Map();for(const el of form.querySelectorAll('input,textarea,select')){if(!el.name||el.disabled||(el.type==='checkbox'&&!el.hasAttribute('checked')))continue;this.values.set(el.name,el.value??'');}}get(n){return this.values.get(n)??null;}has(n){return this.values.has(n);}};
 // DOM emulation only; no real rendering, permissions, browser audio, or browser storage claims.
 const intervals=[],nativeInterval=globalThis.setInterval;globalThis.setInterval=(...args)=>{const t=nativeInterval(...args);t.unref();intervals.push(t);return t;};
 const nativeTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{const t=nativeTimeout(fn,ms,...args);if(ms>=1000)t.unref();return t;};
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const submit=id=>document.querySelector(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 const waitFor=async fn=>{for(let i=0;i<100;i++){if(fn())return;await delay(10);}assert.fail('Timed out: '+document.querySelector('#main').textContent.slice(0,400)+' dialog '+modal.textContent.slice(-300));};
 try{
  await import('../dist/app.js?dom-test');assert.match(document.querySelector('h1').textContent,/play/);
  click('[data-action="describe"]');click('[data-action="example"]');submit('#description-form');await waitFor(()=>!!document.querySelector('#setup-form'));
  assert.equal(document.querySelector('input[name="player0"]').value,'John');assert.equal(document.querySelector('input[name="player1"]').value,'Jack');assert.equal(document.querySelector('input[name="target"]').value,'11');
  // linkedom's selects do not provide browser default selected-option behavior.
  for(const select of document.querySelectorAll('#setup-form select'))if(select.value===undefined){select.querySelector('option').setAttribute('selected','');}
  submit('#setup-form');await waitFor(()=>!!document.querySelector('.scoreboard'));
  assert.match(document.querySelector('.serve-call').textContent,/John serves · right/);assert.match(document.querySelector('.serve-call').textContent,/0 – 0 – 2/);
  click('[data-action="rally"][data-team="0"]');await waitFor(()=>document.querySelector('.score-number').textContent==='1');
  click('[data-action="undo"]');await waitFor(()=>document.querySelector('.score-number').textContent==='0');
  for(let i=1;i<=11;i++){click('[data-action="rally"][data-team="0"]');await waitFor(()=>document.querySelector('.score-number').textContent===String(i));}
  assert.ok(document.querySelector('.complete-banner'));assert.ok(!document.querySelector('[data-action="undo"]').disabled);
  click('[data-action="next"]');for(const select of document.querySelectorAll('#setup-form select'))if(select.value===undefined)select.querySelector('option').setAttribute('selected','');submit('#setup-form');await waitFor(()=>!modal.open&&document.querySelector('.score-number').textContent==='0');
  click('[data-action="live-details"]');assert.match(document.querySelector('#main').textContent,/Game 2/);
  const {LocalStore}=await import('../src/storage.js');const store=await new LocalStore(globalThis.indexedDB).open();const saved=await store.read();assert.equal(saved.sessions.length,1);assert.equal(saved.sessions[0].core.matches.length,2);assert.equal(saved.players.length,4);store.db.close();
 }finally{intervals.forEach(clearInterval);globalThis.setInterval=nativeInterval;globalThis.setTimeout=nativeTimeout;}
});
