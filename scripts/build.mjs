import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/src',{recursive:true});
await cp('src','dist/src',{recursive:true});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
manifest.static={directory:'dist'};
await writeFile('.openai/hosting.json',JSON.stringify(manifest,null,2)+'\n');
