import {emptyData,validateData} from './app-model.js';
/** One atomic IndexedDB compare-and-swap stores the journal and all derived session data. */
export class LocalStore {
  constructor(factory=globalThis.indexedDB){this.factory=factory;}
  async open(){
    if(!this.factory)throw new Error('This browser cannot save sessions. Enable browser storage to keep score safely.');
    this.db=await new Promise((resolve,reject)=>{const q=this.factory.open('pickle-point-local',1);q.onupgradeneeded=()=>q.result.createObjectStore('state');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(new Error('Close another Pickle Point tab to update storage.'));});
    this.db.onversionchange=()=>this.db.close();return this;
  }
  async raw(){return new Promise((resolve,reject)=>{const tx=this.db.transaction('state','readonly'),q=tx.objectStore('state').get('main');let value;q.onsuccess=()=>{value=q.result;};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||new Error('Could not read saved sessions.'));});}
  async read(){const raw=await this.raw();return raw===undefined?emptyData():validateData(raw);}
  async save(next,expectedRevision){
    const payload=structuredClone(next);payload.revision=expectedRevision+1;
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('state','readwrite'),s=tx.objectStore('state'),q=s.get('main');let conflict=false;
      q.onsuccess=()=>{if((q.result?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}s.put(payload,'main');};
      tx.oncomplete=()=>resolve(payload);
      tx.onabort=()=>reject(Object.assign(new Error(conflict?'Another tab changed this session. The latest score has been loaded; check it before tapping again.':'Could not save. Your last saved score is unchanged. Free storage or export a backup and try again.'),{code:conflict?'CONFLICT':'STORAGE_FAILED'}));
    });
  }
}
