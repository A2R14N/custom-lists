import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import axios from 'axios';
import { normalizeList, catalogId, parseListUrl, isCatalogId, listLabel } from '../shared/lists.js';
import { encodeUserId, decodeUserId, mergeConfig, configForUi, CONFIG_KEY } from '../src/services/user-store.js';
import { fetchProviderPage, resolvePage, providerError } from '../src/services/providers.js';
import { startImport, advanceImport } from '../src/services/imports.js';
import { selectCoverPosters } from '../src/services/artwork.js';
import { zipSync, strToU8 } from 'fflate';
import { parseWeTrakrCsv, prepareWeTrakrList, MAX_EXPORT_BYTES } from '../shared/wetrakr.js';
import { readWeTrakrExport } from '../shared/wetrakr-file.js';
import { cacheWeTrakrExport, cacheListExport } from '../src/services/export-cache.js';
import { parseImdbCsv, readImdbExport } from '../shared/imdb.js';

class MemoryRedis {
  constructor() { this.values=new Map(); this.writes=[]; this.expirations=new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async set(key,value,options={}) {
    if(options.nx && this.values.has(key)) return null;
    this.values.set(key,value); this.writes.push({key,value,options});
    if(options.ex) this.expirations.set(key,options.ex);
    return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async ping() { return 'PONG'; }
  multi() {
    const operations = [], redis = this;
    const transaction = { set(key, value) { operations.push([key, value]); return transaction; },
      async exec() { for (const [key, value] of operations) await redis.set(key, value); return operations.map(() => 'OK'); } };
    return transaction;
  }
}

const databases=new Map();
const legacy={username:'a2r14n',listId:'droopy',categoryName:'cartoon',sort:'released,asc'};
const mdb=normalizeList({provider:'mdblist',username:'alice',listId:'favorites',categoryName:'movie'});
const tmdb=normalizeList({provider:'tmdb',listId:'123',categoryName:'series'});
const cached=[{id:'tt0035824',name:'Dumb-Hounded',type:'movie',poster:'https://example.com/poster.jpg'}];
const entry=(id,mediatype='movie')=>({imdb_id:`tt${id}`,mediatype,title:`Title ${id}`,poster:'https://example.com/poster.jpg',release_year:2020});
const originalGet=axios.get;
const originalFetch=globalThis.fetch;
let server,base;

before(async()=>{
  process.env.DOTENV_CONFIG_PATH='__nonexistent_test_env__';
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.hostname==='127.0.0.1') return originalFetch(input,init);
    const redis=databases.get(url.hostname);
    assert.ok(redis,`Unexpected external request: ${url.origin}`);
    const body=JSON.parse(init.body);
    const execute=async(command)=>{
      const [op,key,value,...flags]=command;
      let result;
      if(op.toLowerCase()==='get') result=await redis.get(key);
      else if(op.toLowerCase()==='ping') result='PONG';
      else if(op.toLowerCase()==='del') result=await redis.del(key);
      else if(op.toLowerCase()==='set') {
        const lowered=flags.map(x=>String(x).toLowerCase());
        const options={nx:lowered.includes('nx')};
        const index=lowered.indexOf('ex'); if(index>=0) options.ex=Number(flags[index+1]);
        result=await redis.set(key,value,options);
      } else throw new Error(`Unexpected Redis command ${op}`);
      if(result && typeof result==='object') result=JSON.stringify(result);
      if(typeof result==='string') result=Buffer.from(result).toString('base64');
      return {result};
    };
    const result=Array.isArray(body[0])?await Promise.all(body.map(execute)):await execute(body);
    return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
  };
  const {default:app}=await import('../src/server/index.js');
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});

beforeEach(()=>{
  databases.clear();
  axios.get=async()=>{throw new Error('Unexpected provider call');};
});

after(async()=>{
  axios.get=originalGet;globalThis.fetch=originalFetch;
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
});

async function request(path,body) {
  const response=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  return {status:response.status,headers:response.headers,data:await response.json()};
}

function database(host='alpha.upstash.io') {
  const redis=new MemoryRedis();databases.set(host,redis);
  return {redis,userId:encodeUserId(`https://${host}`,'test-token'),upstashUrl:`https://${host}`,upstashToken:'test-token'};
}

test('legacy list identity and install identifiers remain compatible',()=>{
  assert.equal(catalogId(legacy),'trakt:a2r14n:droopy:released,asc');
  const id=Buffer.from('https://alpha.upstash.io|test-token').toString('base64url');
  assert.deepEqual(decodeUserId(id+'~2'),{upstashUrl:'https://alpha.upstash.io',upstashToken:'test-token'});
  assert.equal(encodeUserId('https://alpha.upstash.io','test-token'),id);
  assert.equal(normalizeList(legacy).provider,'trakt');
  assert.equal(normalizeList({...legacy,categoryName:'Kids & Family'}).categoryName,'Kids & Family');
});

test('parses provider URLs, preserves sorting, and rejects lookalike domains',()=>{
  assert.equal(catalogId(parseListUrl('https://www.themoviedb.org/list/123-tv-favorites')), 'tmdb:123');
  assert.equal(catalogId(parseListUrl('https://mdblist.com/lists/alice/favorites?sort=title&order=desc')), 'mdblist:alice:favorites:title:desc');
  assert.equal(catalogId(parseListUrl('https://mdblist.com/lists/alice/external/42')), 'mdblist:external:42');
  assert.equal(catalogId(parseListUrl('https://trakt.tv/users/a2r14n/lists/droopy?sort=released,asc')),catalogId(legacy));
  for(const url of ['https://trakt.tv.evil.test/users/a/lists/b','https://mdblist.com.evil.test/lists/a/b','https://user:pass@mdblist.com/lists/a/b','garbage']) assert.throws(()=>parseListUrl(url));
  assert.equal(isCatalogId('stremio:config'),false);
  assert.equal(isCatalogId('tmdb:123:extra'),false);
  assert.equal(isCatalogId(catalogId(legacy)),true);
});

test('rejects arbitrary Redis destinations before making requests',()=>{
  for(const url of ['http://alpha.upstash.io','https://127.0.0.1','https://alpha.upstash.io.evil.test','https://alpha.upstash.io/path','https://alpha.upstash.io?token=x']) assert.throws(()=>encodeUserId(url,'token'));
});

test('merging provider keys preserves legacy lists and unknown saved settings',()=>{
  const previous={traktClientId:'old-key',lists:[legacy],customOption:true};
  const merged=mergeConfig(previous,{mdblistApiKey:'new-key'});
  assert.deepEqual(merged.lists,[legacy]);assert.equal(merged.traktClientId,'old-key');assert.equal(merged.customOption,true);
  assert.throws(()=>mergeConfig(previous,{lists:[legacy,legacy]}));
  assert.deepEqual(previous.lists,[legacy]);
});

test('connect reads saved Trakt lists without writing or clearing configuration',async()=>{
  const db=database();
  await db.redis.set(CONFIG_KEY,JSON.stringify({lists:[legacy]}));
  await db.redis.set(catalogId(legacy),JSON.stringify(cached));db.redis.writes=[];
  const result=await request('/api/connect',{upstashUrl:db.upstashUrl,upstashToken:db.upstashToken});
  assert.equal(result.status,200);assert.equal(result.data.lists[0].cached,true);assert.equal(result.data.lists[0].itemCount,1);
  assert.equal(result.data.lists[0].provider,'trakt');assert.equal(db.redis.writes.length,0);
  assert.deepEqual(result.data.lists[0].coverPosters,[cached[0].poster]);
  assert.match(result.headers.get('cache-control'),/private, no-store/);
});

test('cover artwork selects bounded distinct HTTPS posters without changing old metadata',()=>{
  const metas=[null,{}, {poster:'javascript:alert(1)'}, {poster:'data:image/png;base64,AAAA'},
    {poster:'http://example.com/insecure.jpg'}, {poster:'https://user:secret@example.com/private.jpg'},
    {id:'tt1',type:'movie',poster:'https://example.com/1.jpg#fragment'},
    {id:'tt1',type:'movie',poster:'https://example.com/duplicate-title.jpg'},
    {id:'tt2',type:'movie',poster:'https://example.com/1.jpg'},
    ...[2,3,4,5,6].map(id=>({id:`tt${id}`,type:'movie',poster:`https://example.com/${id}.jpg`}))];
  const before=JSON.stringify(metas);
  assert.deepEqual(selectCoverPosters(metas),[1,2,3,4].map(id=>`https://example.com/${id}.jpg`));
  assert.equal(JSON.stringify(metas),before);
  assert.deepEqual(selectCoverPosters(null),[]);
  assert.deepEqual(selectCoverPosters([{id:'tt42'}]),[]);
});

test('cached legacy catalog works with no config or Trakt key, and isolates users',async()=>{
  const alpha=database();const beta=database('beta.upstash.io');
  await alpha.redis.set(catalogId(legacy),JSON.stringify(cached));
  for(const suffix of ['', '~2']) {
    const result=await request(`/${alpha.userId}${suffix}/catalog/cartoon/${catalogId(legacy)}.json`);
    assert.equal(result.status,200);assert.deepEqual(result.data.metas,cached);
  }
  const missing=await request(`/${beta.userId}/catalog/cartoon/${catalogId(legacy)}.json`);
  assert.deepEqual(missing.data.metas,[]);
  const forbidden=await request(`/${alpha.userId}/catalog/movie/stremio:config.json`);
  assert.deepEqual(forbidden.data.metas,[]);
});

test('manifest advertises all providers while keeping addon and Trakt IDs',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy,mdb,tmdb]});
  const result=await request(`/${db.userId}/manifest.json`);
  assert.equal(result.status,200);assert.equal(result.data.id,'community.trakt.custom-lists');
  assert.deepEqual(result.data.catalogs.map(x=>x.id),[catalogId(legacy),catalogId(mdb),catalogId(tmdb)]);
  assert.ok(result.data.types.includes('cartoon'));
});

test('manifest branding uses a public same-host asset without leaking configured credentials',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy]});
  const publicManifest=await request('/manifest.json');
  const configured=await request(`/${db.userId}~revision/manifest.json?private=not-for-logo`);
  assert.equal(publicManifest.data.name,'Custom Lists');
  assert.equal(configured.data.name,'Custom Lists');
  assert.equal(configured.data.logo,publicManifest.data.logo);
  const logo=new URL(configured.data.logo);
  assert.equal(logo.host,new URL(base).host);
  assert.equal(logo.pathname,'/brand/custom-lists-icon-v1.png');
  assert.equal(logo.search,'');assert.ok(!logo.href.includes(db.userId));
  const asset=fs.readFileSync(new URL('../vue/public'+logo.pathname,import.meta.url));
  assert.equal(asset.subarray(1,4).toString(),'PNG');
  assert.equal(asset.readUInt32BE(16),512);assert.equal(asset.readUInt32BE(20),512);
  const proxied=await fetch(base+'/manifest.json',{headers:{'X-Forwarded-Proto':'https','X-Forwarded-Host':'untrusted.example'}});
  const proxyLogo=new URL((await proxied.json()).logo);
  assert.equal(proxyLogo.protocol,'https:');assert.equal(proxyLogo.host,new URL(base).host);
});

test('saving new lists and removing manifest entries never changes cached snapshots',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy],traktClientId:'old'});await db.redis.set(catalogId(legacy),JSON.stringify(cached));
  const save=await request('/api/config',{upstashUrl:db.upstashUrl,upstashToken:db.upstashToken,mdblistApiKey:'new',lists:[legacy,mdb]});
  assert.equal(save.status,200);
  assert.equal(JSON.parse(await db.redis.get(CONFIG_KEY)).traktClientId,'old');
  await request('/api/config',{upstashUrl:db.upstashUrl,upstashToken:db.upstashToken,lists:[mdb]});
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))),cached);
});

// Contract cases traced from Nuvio Desktop commit 85877828687722fdc4ed5c16766068df94640b8a:
// AddonTransportUrls.kt, HomeCatalogParser.kt and CatalogData.kt. These exercise
// our real HTTP handlers with Nuvio-shaped requests; they do not run Nuvio itself.
test('Nuvio-shaped encoded catalog URLs preserve private configuration and real item media types',async()=>{
  const db=database();
  const lists=[legacy,mdb,tmdb,
    normalizeList({provider:'imdb',listId:'a'.repeat(64),categoryName:'Family Cartoons',name:'IMDb sample'}),
    normalizeList({provider:'wetrakr',listId:'b'.repeat(64),categoryName:'cartoon',name:'Export sample'})];
  const metas=[{id:'tt100',type:'movie',name:'Movie',poster:'https://example.com/movie.jpg',posterShape:'poster'},
    {id:'tt200',type:'series',name:'Series',imdb_id:'tt200',tmdb_id:'20',releaseInfo:'2020'}];
  await db.redis.set(CONFIG_KEY,JSON.stringify({lists}));
  for(const list of lists) await db.redis.set(catalogId(list),JSON.stringify(metas));
  db.redis.writes=[];
  const configured=`${db.userId}~review%20one`;
  const manifest=await request(`/${configured}/manifest.json?client=nuvio`);
  assert.equal(manifest.status,200);
  for(const field of ['id','name','version']) assert.ok(typeof manifest.data[field]==='string' && manifest.data[field].length);
  assert.deepEqual(manifest.data.resources,['catalog']);
  assert.equal(manifest.data.behaviorHints.configurable,true);
  for(const catalog of manifest.data.catalogs) {
    // Nuvio hides home catalogs with required extras; none should be required here.
    assert.ok(!(catalog.extra || []).some(extra=>extra.isRequired));
    const encodedId=encodeURIComponent(catalog.id);
    assert.ok(encodedId.includes('%3A'));
    const result=await request(`/${configured}/catalog/${encodeURIComponent(catalog.type)}/${encodedId}.json?client=nuvio`);
    assert.equal(result.status,200);
    assert.deepEqual(result.data.metas,metas);
    // HomeCatalogParser requires all three fields and routes each item's own type.
    assert.ok(result.data.metas.every(meta=>meta.id && meta.type && meta.name));
    assert.deepEqual(result.data.metas.map(meta=>meta.type),['movie','series']);
  }
  assert.equal(db.redis.writes.length,0);
});

test('Nuvio full-list loading and explicit raw-count pagination return every cached item without writes',async()=>{
  const db=database();const key=catalogId(legacy);
  const metas=Array.from({length:205},(_,i)=>({id:`tt${i+1000}`,name:`Title ${i}`,type:i%2?'series':'movie'}));
  const snapshot=JSON.stringify(metas);await db.redis.set(key,snapshot);db.redis.writes=[];
  const route=`/${db.userId}~review/catalog/cartoon/${encodeURIComponent(key)}`;
  // Nuvio's first request omits skip, so retaining the full snapshot avoids loss.
  assert.deepEqual((await request(`${route}.json`)).data.metas,metas);
  const combined=[];
  for(const [skip,count] of [[0,100],[100,100],[200,5],[205,0]]) {
    const response=await fetch(base+`${route}/skip=${skip}.json?client=nuvio`,{headers:{'Cache-Control':'no-cache'}});
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
    const page=(await response.json()).metas;assert.equal(page.length,count);combined.push(...page);
  }
  assert.deepEqual(combined,metas);
  for(const skip of ['-1','1.5','NaN','9007199254740992']) {
    assert.equal((await request(`${route}/skip=${skip}.json`)).status,400);
  }
  assert.equal(await db.redis.get(key),snapshot);assert.equal(db.redis.writes.length,0);
});

test('MDBList importer follows cursors and publishes only a complete snapshot',async()=>{
  const redis=new MemoryRedis();await redis.set(CONFIG_KEY,{lists:[mdb],mdblistApiKey:'mdb-key'});await redis.set(catalogId(mdb),JSON.stringify(cached));
  const calls=[];
  axios.get=async(url,options)=>{calls.push({url,options});return options.params.cursor
    ? {data:{items:[entry(2,'show')]},headers:{'x-has-more':'false'}}
    : {data:{items:[entry(1)],next_cursor:'next-page'},headers:{'x-has-more':'true'}};};
  const job=await startImport(redis,mdb);
  const first=await advanceImport(redis,job.jobId,0);
  assert.equal(first.status,'progress');assert.deepEqual(JSON.parse(await redis.get(catalogId(mdb))),cached);
  assert.equal(first.coverPosters,undefined);
  const retry=await advanceImport(redis,job.jobId,0);assert.deepEqual(retry,first);assert.equal(calls.length,1);
  const last=await advanceImport(redis,job.jobId,1);assert.equal(last.status,'done');assert.equal(last.done,2);
  assert.deepEqual(last.coverPosters,[cached[0].poster]);
  assert.deepEqual(JSON.parse(await redis.get(catalogId(mdb))).map(x=>x.id),['tt1','tt2']);
  assert.equal(calls[0].url,'https://api.mdblist.com/lists/alice/favorites/items');assert.equal(calls[0].options.params.apikey,'mdb-key');
  assert.equal(calls[1].options.params.cursor,'next-page');assert.equal(redis.expirations.has(catalogId(mdb)),false);
});

test('MDBList handles legacy bucket pages, offset fallback, and repeated cursors',async()=>{
  axios.get=async()=>({data:{movies:[{...entry(2),rank:2}],shows:[{...entry(1,'show'),rank:1}]},headers:{'x-has-more':'true'}});
  const page=await fetchProviderPage(mdb,{mdblistApiKey:'key'});
  assert.deepEqual(page.items.map(x=>x.imdb_id),['tt1','tt2']);assert.deepEqual(page.next,{offset:2});
  axios.get=async()=>({data:{items:[entry(1)],next_cursor:'same'},headers:{}});
  await assert.rejects(fetchProviderPage(mdb,{mdblistApiKey:'key'},{cursor:'same'}),/did not advance/);
});

test('TMDB mixed lists resolve IMDb IDs with the user token and preserve page order',async()=>{
  const redis=new MemoryRedis();await redis.set(CONFIG_KEY,{lists:[tmdb],tmdbAccessToken:'tmdb-token'});
  const calls=[];
  axios.get=async(url,options)=>{
    calls.push({url,options});assert.equal(options.headers.Authorization,'Bearer tmdb-token');
    if(url.includes('/4/list/')) return {data:{results:[{id:10,media_type:'movie',title:'Movie',poster_path:'/a.jpg'},{id:20,media_type:'tv',name:'Show'},{id:30,media_type:'tv',name:'No IMDb'}],total_pages:1,total_results:3}};
    return {data:{imdb_id:url.includes('/30/')?null:url.includes('/10/')?'tt10':'tt20'}};
  };
  const job=await startImport(redis,tmdb);const done=await advanceImport(redis,job.jobId,0);
  assert.equal(done.done,2);assert.equal(done.skipped,1);
  const metas=JSON.parse(await redis.get(catalogId(tmdb)));
  assert.deepEqual(metas.map(x=>[x.id,x.type]),[['tt10','movie'],['tt20','series']]);
  assert.equal(metas[0].poster,'https://image.tmdb.org/t/p/w500/a.jpg');
  assert.ok(calls.some(call=>call.url.includes('/3/tv/20/external_ids')));
});

test('TMDB fetches subsequent list pages',async()=>{
  axios.get=async()=>({data:{results:[{id:10,media_type:'movie'}],total_pages:3,total_results:50}});
  assert.deepEqual((await fetchProviderPage(tmdb,{tmdbAccessToken:'key'},{page:2})).next,{page:3});
});

test('failed, empty, and oversized refreshes retain previous snapshots',async()=>{
  for(const scenario of ['failure','empty','oversized']) {
    const redis=new MemoryRedis();await redis.set(CONFIG_KEY,{lists:[tmdb],tmdbAccessToken:'key'});await redis.set(catalogId(tmdb),JSON.stringify(cached));
    axios.get=async()=>{if(scenario==='failure') throw Object.assign(new Error('quota'),{isAxiosError:true,response:{status:429}});return {data:{results:[],total_pages:1,total_results:scenario==='oversized'?10001:0}};};
    const job=await startImport(redis,tmdb);await assert.rejects(advanceImport(redis,job.jobId,0));
    assert.deepEqual(JSON.parse(await redis.get(catalogId(tmdb))),cached);
  }
});

test('Trakt import is refused without touching its cache',async()=>{
  const redis=new MemoryRedis();await redis.set(CONFIG_KEY,{lists:[legacy]});await redis.set(catalogId(legacy),JSON.stringify(cached));redis.writes=[];
  await assert.rejects(startImport(redis,legacy),/Trakt snapshots are preserved/);assert.equal(redis.writes.length,0);
});

test('failed IMDb resolution does not silently publish a partial TMDB refresh',async()=>{
  axios.get=async()=>{throw Object.assign(new Error('timeout'),{isAxiosError:true});};
  await assert.rejects(resolvePage(tmdb,{tmdbAccessToken:'key'},[{id:10,media_type:'movie'}]));
});

test('public import API advances a job in the requesting user database',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[mdb],mdblistApiKey:'key'});
  axios.get=async()=>({data:{items:[entry(42)]},headers:{}});
  const start=await request(`/api/cache/${db.userId}`,{list:mdb});assert.equal(start.status,200);
  const step=await request(`/api/cache/${db.userId}/${start.data.jobId}`,{step:0});assert.equal(step.status,200);assert.equal(step.data.status,'done');
  const catalog=await request(`/${db.userId}/catalog/movie/${catalogId(mdb)}.json`);assert.equal(catalog.data.metas[0].id,'tt42');
});

function frontend() {
  const source=fs.readFileSync(new URL('../vue/src/composables/useCatalogs.ts',import.meta.url),'utf8');
  const script=stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('import.meta.env.VITE_APP_URL',"''").replace('export function','function'));
  const context=vm.createContext({reactive:x=>x,computed:fn=>({get value(){return fn();}}),
    catalogId,normalizeList,parseListUrl,listLabel,URL,console,AbortSignal,window:{location:{origin:base}},
    fetch:(url,init)=>fetch(base+url,init)});
  vm.runInContext(script+'\nglobalThis.ui=useCatalogs();',context);
  return context;
}

test('frontend loads legacy data, invalid URLs clear parsing, and revisions affect URLs',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy]});await db.redis.set(catalogId(legacy),JSON.stringify(cached));db.redis.writes=[];
  const {ui}=frontend();ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  assert.equal(ui.state.lists.length,1);assert.equal(ui.state.lists[0].cached,true);assert.equal(db.redis.writes.length,0);
  assert.deepEqual(Array.from(ui.state.lists[0].coverPosters),[cached[0].poster]);
  ui.state.listUrl='https://mdblist.com/lists/alice/favorites';assert.ok(ui.parsed.value.list);
  ui.state.listUrl='broken';assert.equal(ui.parsed.value.list,null);
  const original=ui.buildAddonUrl();ui.state.cacheBuster='2';assert.notEqual(ui.buildAddonUrl(),original);
  assert.ok(ui.buildAddonUrl().includes('~2/manifest.json'));
});

test('redesigned UI restores a private link through this server, never the pasted host',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy]});await db.redis.set(catalogId(legacy),JSON.stringify(cached));db.redis.writes=[];
  const context=frontend(), calls=[];
  context.fetch=(url,init)=>{calls.push(url);return fetch(base+url,init);};
  assert.equal(await context.ui.restoreFromUrl(`https://old-host.invalid/${db.userId}/manifest.json`),true);
  assert.equal(calls.length,1);assert.equal(calls[0],`/api/config/${db.userId}`);
  assert.equal(context.ui.state.lists[0].cached,true);assert.equal(db.redis.writes.length,0);
  assert.equal(await context.ui.restoreFromUrl('https://unrelated.invalid/'),false);
  assert.equal(calls.length,1);
});

test('redesigned UI edits and reorders catalogs without rewriting their snapshots',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy,mdb]});await db.redis.set(catalogId(legacy),JSON.stringify(cached));
  const {ui}=frontend();ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();db.redis.writes=[];
  assert.equal(await ui.editList(ui.state.lists[0],'Saturday cartoons','cartoon'),true);
  assert.equal(ui.state.lists[0].name,'Saturday cartoons');
  assert.deepEqual(Array.from(ui.state.lists[0].coverPosters),[cached[0].poster]);
  assert.equal(await ui.moveList(ui.state.lists[1],-1),true);assert.equal(ui.state.lists[0].provider,'mdblist');
  assert.equal(await ui.removeList(ui.state.lists[1]),true);assert.equal(ui.state.lists.length,1);
  assert.ok(db.redis.writes.every(write=>write.key===CONFIG_KEY));
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))),cached);
});

test('cover artwork updates across matching catalogs only after a successful refresh',async()=>{
  const db=database();
  await db.redis.set(CONFIG_KEY,{lists:[mdb,{...mdb,categoryName:'cartoon'}],mdblistApiKey:'key'});
  await db.redis.set(catalogId(mdb),JSON.stringify(cached));
  const {ui}=frontend();ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  axios.get=async()=>({data:{items:[{...entry(42),poster:'https://example.com/new.jpg'}]},headers:{}});
  await ui.runImport(ui.state.lists[0]);
  for(const list of ui.state.lists) assert.deepEqual(Array.from(list.coverPosters),['https://example.com/new.jpg']);
  axios.get=async()=>{throw new Error('Provider unavailable');};
  await ui.runImport(ui.state.lists[0]);
  for(const list of ui.state.lists) assert.deepEqual(Array.from(list.coverPosters),['https://example.com/new.jpg']);
  assert.match(ui.state.lists[0].error,/previous snapshot is still available/);
});

test('redesigned UI keeps local lists on a failed save and clears credentials on disconnect',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy]});
  const context=frontend(),{ui}=context;ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  context.fetch=async()=>new Response(JSON.stringify({error:'Test save failure'}),{status:502});
  assert.equal(await ui.removeList(ui.state.lists[0]),false);assert.equal(ui.state.lists.length,1);
  assert.equal(await ui.editList(ui.state.lists[0],'Changed','movie'),false);assert.notEqual(ui.state.lists[0].name,'Changed');
  ui.disconnect();assert.equal(ui.state.connected,false);assert.equal(ui.state.upstashToken,'');assert.equal(ui.state.userId,'');assert.equal(ui.state.lists.length,0);
});

test('malformed input and unknown APIs return JSON errors',async()=>{
  assert.equal((await request('/api/connect',{upstashUrl:'https://127.0.0.1',upstashToken:'key'})).status,400);
  assert.equal((await request('/api/missing')).status,404);
  const response=await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
  assert.equal(response.status,400);assert.match((await response.json()).error,/Invalid request/);
});

test('import jobs cannot be read through another user database',async()=>{
  const alpha=database();const beta=database('beta.upstash.io');
  await alpha.redis.set(CONFIG_KEY,{lists:[mdb],mdblistApiKey:'key'});
  const start=await request(`/api/cache/${alpha.userId}`,{list:mdb});
  const wrong=await request(`/api/cache/${beta.userId}/${start.data.jobId}`,{step:0});
  assert.equal(wrong.status,400);assert.match(wrong.data.error,/Import expired/);
  assert.equal(await beta.redis.get(catalogId(mdb)),null);
});

test('missing provider keys, expired jobs and removed lists cannot replace snapshots',async()=>{
  const redis=new MemoryRedis();await redis.set(CONFIG_KEY,{lists:[mdb]});
  await assert.rejects(startImport(redis,mdb),/MDBList API key/);
  await redis.set(CONFIG_KEY,{lists:[mdb],mdblistApiKey:'key'});
  const job=await startImport(redis,mdb);
  await redis.set(CONFIG_KEY,{lists:[],mdblistApiKey:'key'});
  await assert.rejects(advanceImport(redis,job.jobId,0),/removed/);
  await redis.del(`stremio:import:${job.jobId}`);
  await assert.rejects(advanceImport(redis,job.jobId,0),/expired/);
});

test('provider and Redis errors cannot reflect secrets to callers',()=>{
  const secret='https://secret.upstash.io?token=hidden';
  assert.ok(!providerError(new Error(secret)).includes(secret));
  assert.ok(!providerError(Object.assign(new Error(secret),{isAxiosError:true,response:{status:401}})).includes(secret));
});

const exportHeader = 'list_name,list_description,title,year,type,tmdb_id,imdb_id,rank,created_at';
const exportCsv = `${exportHeader}\r\n"Weekend, favorites","Line one\nLine two","A \"\"great\"\" movie",2020,movie,10,tt100,2,today\r\n"Weekend, favorites",,First show,2021,show,20,tt200,1,today\r\nOther,,Only TMDB,2022,movie,30,,1,today\r\nOther,,Episode,2022,episode,40,tt400,2,today\r\n`;
const exportItems = [{title:'First movie',year:'2020',type:'movie',tmdb_id:'10',imdb_id:'tt100',rank:'1'},
  {title:'Second show',year:'2021',type:'show',tmdb_id:'20',imdb_id:'tt200',rank:'2'}];

test('WeTrakr CSV preserves quoted names, rank, media types and both identifiers',()=>{
  const lists = parseWeTrakrCsv('\uFEFF'+exportCsv);
  assert.equal(lists.length,2);
  assert.equal(lists[0].sourceName,'Weekend, favorites');
  assert.deepEqual(lists[0].metas.map(x=>[x.name,x.type,x.id,x.tmdb_id]),[
    ['First show','series','tt200','20'],['A "great" movie','movie','tt100','10']]);
  assert.equal(lists[1].missingIds,1);assert.equal(lists[1].unsupported,1);
  assert.equal(lists[1].metas.length,0);
  assert.equal(Object.hasOwn(lists[0].items[0],'list_description'),false);
  assert.equal(prepareWeTrakrList('Same',[...exportItems,exportItems[0]]).duplicates,1);
});

test('WeTrakr reads original ZIP or CSV and ignores notes and unrelated files',()=>{
  const zip = zipSync({'lists.csv':strToU8(exportCsv),'notes.csv':strToU8('private notes'), '../ignored.txt':strToU8('ignored')});
  assert.deepEqual(readWeTrakrExport(zip,'export.zip'),parseWeTrakrCsv(exportCsv));
  assert.equal(readWeTrakrExport(strToU8(exportCsv),'lists.csv').length,2);
  assert.throws(()=>readWeTrakrExport(zipSync({'notes.csv':strToU8('private')}),'empty.zip'),/valid WeTrakr ZIP/);
  assert.throws(()=>readWeTrakrExport(zip.slice(0,30),'broken.zip'),/valid WeTrakr ZIP/);
  assert.throws(()=>readWeTrakrExport(new Uint8Array(MAX_EXPORT_BYTES+1),'big.zip'),/smaller than 8 MB/);
  assert.throws(()=>readWeTrakrExport(zipSync({'lists.csv':new Uint8Array(MAX_EXPORT_BYTES+1)}),'bomb.zip'),/valid WeTrakr ZIP/);
  assert.throws(()=>readWeTrakrExport(new Uint8Array([255]),'lists.csv'),/UTF-8/);
});

test('WeTrakr rejects incomplete CSV and malformed IDs rather than publishing partial titles',()=>{
  for(const csv of ['title,imdb_id\nMovie,tt100',exportHeader+'\n"unfinished',exportHeader+'\nList,,Movie,2020,movie,10,tt100,1',exportHeader+'\n"List"junk,,Movie,2020,movie,10,tt100,1,today']) assert.throws(()=>parseWeTrakrCsv(csv));
  assert.throws(()=>prepareWeTrakrList('List',[{...exportItems[0],imdb_id:'https://example.com'}]));
  assert.throws(()=>prepareWeTrakrList('List',[{...exportItems[0],tmdb_id:'../private'}]));
  assert.throws(()=>prepareWeTrakrList('List',Array(10001).fill(exportItems[0])));
});

test('WeTrakr caches directly with no provider key and preserves other providers',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy,mdb],customOption:true,mdblistApiKey:'saved-key'});
  await db.redis.set(catalogId(legacy),JSON.stringify(cached));db.redis.writes=[];
  const saved=await request(`/api/exports/${db.userId}`,{sourceName:'Weekend',items:exportItems,categoryName:'cartoon'});
  assert.equal(saved.status,200);assert.equal(saved.data.list.itemCount,2);
  const key=catalogId(saved.data.list);assert.match(key,/^wetrakr:[0-9a-f]{64}$/);assert.equal(isCatalogId(key),true);
  const catalog=await request(`/${db.userId}/catalog/cartoon/${key}.json`);
  assert.equal(catalog.data.metas[0].id,'tt100');assert.equal(catalog.data.metas[0].tmdb_id,'10');
  assert.equal(catalog.data.metas[1].type,'series');
  const config=JSON.parse(await db.redis.get(CONFIG_KEY));assert.equal(config.lists.length,3);
  assert.equal(config.customOption,true);assert.equal(config.mdblistApiKey,'saved-key');
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))),cached);
  assert.ok(db.redis.writes.every(write=>[key,CONFIG_KEY].includes(write.key)));
  assert.equal(db.redis.expirations.has(key),false);
  assert.equal((await request(`/${db.userId}/manifest.json`)).data.catalogs.at(-1).id,key);
});

test('repeat WeTrakr exports update only their cache and keep edited names and categories',async()=>{
  const redis=new MemoryRedis();const first=await cacheWeTrakrExport(redis,{sourceName:'Same',items:exportItems,categoryName:'cartoon'});
  const key=catalogId(first.list);const config=JSON.parse(await redis.get(CONFIG_KEY));
  config.lists[0].name='My custom name';await redis.set(CONFIG_KEY,JSON.stringify(config));
  const next=await cacheWeTrakrExport(redis,{sourceName:'Same',items:[exportItems[1]],categoryName:'movie'});
  assert.equal(catalogId(next.list),key);assert.equal(next.list.name,'My custom name');assert.equal(next.list.categoryName,'cartoon');
  assert.equal(JSON.parse(await redis.get(CONFIG_KEY)).lists.length,1);
  assert.equal(JSON.parse(await redis.get(key)).length,1);
  await assert.rejects(startImport(redis,next.list),/select a new ZIP or CSV/);
});

test('invalid or failed WeTrakr publications leave saved config and caches untouched',async()=>{
  const redis=new MemoryRedis();const first=await cacheWeTrakrExport(redis,{sourceName:'Same',items:exportItems});
  const key=catalogId(first.list), oldConfig=await redis.get(CONFIG_KEY), oldCache=await redis.get(key);
  for(const items of [[],[{...exportItems[0],imdb_id:''}],[{...exportItems[0],rank:'invalid'}]]) {
    await assert.rejects(cacheWeTrakrExport(redis,{sourceName:'Same',items}));
    assert.equal(await redis.get(CONFIG_KEY),oldConfig);assert.equal(await redis.get(key),oldCache);
  }
  redis.multi=()=>({set(){return this;},async exec(){throw new Error('Transaction unavailable');}});
  await assert.rejects(cacheWeTrakrExport(redis,{sourceName:'Same',items:[exportItems[0]]}));
  assert.equal(await redis.get(CONFIG_KEY),oldConfig);assert.equal(await redis.get(key),oldCache);
});

test('WeTrakr UI sends only selected rows and changes its state only after successful caching',async()=>{
  const alpha=database(),beta=database('beta.upstash.io');const context=frontend(),{ui}=context;
  ui.state.upstashUrl=alpha.upstashUrl;ui.state.upstashToken=alpha.upstashToken;await ui.connect();
  const selected={sourceName:'Weekend',items:exportItems};
  assert.equal(await ui.cacheExport(selected,'cartoon'),true);assert.equal(ui.state.lists[0].itemCount,2);
  assert.equal(ui.state.lists[0].provider,'wetrakr');assert.equal(ui.canImport(ui.state.lists[0]),false);
  assert.equal(await beta.redis.get(CONFIG_KEY),null);
  context.fetch=async()=>new Response(JSON.stringify({error:'Cache unavailable'}),{status:502});
  assert.equal(await ui.cacheExport({...selected,items:[exportItems[0]]},'movie'),false);
  assert.equal(ui.state.lists[0].itemCount,2);assert.equal(ui.state.importing,false);
});

const imdbHeader = 'Position,Const,Title,Title Type,Year,Description,Your Rating';
const imdbCsv = `${imdbHeader}\r\n2,tt100,"A ""great"" movie",Movie,2026,"private\nnotes",9\r\n1,tt200,"Series, one",TV Series,2020,,8\r\n3,tt300,Special,TV Special,2024,,\r\n`;

test('IMDb CSV preserves Position order and titles without uploading private fields or inventing TMDB IDs',()=>{
  const parsed=readImdbExport(strToU8('\uFEFF'+imdbCsv),'random-uuid.csv','Weekend');
  assert.equal(parsed.provider,'imdb');assert.equal(parsed.total,3);assert.equal(parsed.skipped,0);
  assert.deepEqual(parsed.metas.map(x=>[x.id,x.type,x.name]),[
    ['tt200','series','Series, one'],['tt100','movie','A "great" movie'],['tt300','movie','Special']]);
  assert.ok(parsed.metas.every(meta=>!Object.hasOwn(meta,'tmdb_id')));
  assert.ok(parsed.items.every(item=>Object.keys(item).sort().join(',')==='imdb_id,rank,title,tmdb_id,type,year'));
  assert.ok(!JSON.stringify(parsed).includes('private'));
});

test('IMDb maps supported title types and reports duplicates, missing IDs and unsupported entries',()=>{
  const kinds=['Movie','TV Movie','Short','TV Short','Video','TV Special','TV Series','TV Mini Series','TV Episode','Video Game','Unknown'];
  const csv=imdbHeader+'\n'+kinds.map((kind,i)=>`${i+1},tt${100+i},Title,${kind},2020,,`).join('\n')+'\n12,tt100,Duplicate,Movie,2020,,\n13,,No ID,Movie,2020,,';
  const parsed=parseImdbCsv(csv,'Types');
  assert.equal(parsed.metas.length,8);assert.equal(parsed.unsupported,3);assert.equal(parsed.duplicates,1);assert.equal(parsed.missingIds,1);
  assert.deepEqual(parsed.metas.map(x=>x.type),[...Array(6).fill('movie'),'series','series']);
});

test('IMDb rejects malformed or oversized exports before caching',()=>{
  for(const csv of [imdbHeader,imdbCsv.replace('Const','Title'),imdbCsv.replace('tt100','https://example.com'),imdbCsv.replace('2,tt100','bad,tt100'),imdbHeader+'\n"unfinished',imdbHeader+'\n1,tt123,Too few']) {
    assert.throws(()=>parseImdbCsv(csv,'Name'),/^Error: IMDb export:/);
  }
  assert.throws(()=>parseImdbCsv(imdbCsv,''),/list name/);
  assert.throws(()=>readImdbExport(strToU8(imdbCsv),'wrong.zip','Name'),/CSV file/);
  assert.throws(()=>readImdbExport(new Uint8Array([255]),'list.csv','Name'),/UTF-8/);
  assert.throws(()=>readImdbExport(new Uint8Array(MAX_EXPORT_BYTES+1),'large.csv','Name'),/8 MB/);
  assert.throws(()=>parseImdbCsv(imdbHeader+'\n'+Array(10001).fill('1,tt123,Title,Movie,2020,,').join('\n'),'Name'),/10,000/);
});

test('IMDb cache is isolated from WeTrakr and other users, updates in place, and survives invalid imports',async()=>{
  const db=database(),other=database('other.upstash.io');
  await db.redis.set(CONFIG_KEY,{lists:[legacy],customOption:true});
  await db.redis.set(catalogId(legacy),JSON.stringify(cached));
  const wetrakr=await cacheWeTrakrExport(db.redis,{sourceName:'Weekend',items:exportItems});
  const originalWetrakr=await db.redis.get(catalogId(wetrakr.list));
  const payload={...parseImdbCsv(imdbCsv,'Weekend'),categoryName:'movie'};
  const saved=await request(`/api/exports/${db.userId}`,payload);
  assert.equal(saved.status,200);const key=catalogId(saved.data.list);
  assert.match(key,/^imdb:[a-f0-9]{64}$/);assert.ok(isCatalogId(key));
  assert.equal((await request(`/${db.userId}/catalog/movie/${key}.json`)).data.metas.length,3);
  assert.ok((await request(`/${db.userId}/manifest.json`)).data.catalogs.some(item=>item.id===key));
  const config=JSON.parse(await db.redis.get(CONFIG_KEY));config.lists.at(-1).name='Custom display';
  await db.redis.set(CONFIG_KEY,JSON.stringify(config));
  const updated=await cacheListExport(db.redis,{...payload,items:[payload.items[0]],categoryName:'series'});
  assert.equal(updated.list.name,'Custom display');assert.equal(updated.list.categoryName,'movie');
  assert.equal(updated.list.sourceName,'Weekend');
  const oldConfig=await db.redis.get(CONFIG_KEY),oldCache=await db.redis.get(key);
  for(const patch of [{items:[]},{items:[{...payload.items[0],imdb_id:'invalid'}]},{provider:'trakt'}]) {
    assert.equal((await request(`/api/exports/${db.userId}`,{...payload,...patch})).status,400);
    assert.equal(await db.redis.get(CONFIG_KEY),oldConfig);assert.equal(await db.redis.get(key),oldCache);
  }
  assert.equal(await db.redis.get(catalogId(wetrakr.list)),originalWetrakr);
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))),cached);
  assert.equal(await other.redis.get(CONFIG_KEY),null);assert.equal(db.redis.expirations.has(key),false);
  await assert.rejects(startImport(db.redis,updated.list),/select a new CSV/);
});

test('IMDb frontend sends its provider and preserves the last snapshot after a failed update',async()=>{
  const db=database();const context=frontend(),{ui}=context;
  ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  const parsed=parseImdbCsv(imdbCsv,'Weekend');
  assert.equal(await ui.cacheExport(parsed,'movie'),true);
  assert.equal(ui.state.lists[0].provider,'imdb');assert.equal(ui.state.lists[0].itemCount,3);
  assert.equal(ui.canImport(ui.state.lists[0]),false);
  context.fetch=async()=>new Response(JSON.stringify({error:'Cache unavailable'}),{status:502});
  assert.equal(await ui.cacheExport({...parsed,items:[parsed.items[0]]},'movie'),false);
  assert.equal(ui.state.lists[0].itemCount,3);assert.equal(ui.state.importing,false);
});

test('metadata fallback uses Cinemeta for MDBList entries without posters',async()=>{
  axios.get=async(url)=>{assert.equal(url,'https://v3-cinemeta.strem.io/meta/movie/tt42.json');return {status:200,data:{meta:{name:'Cinemeta title',poster:'https://example.com/rich.jpg'}}};};
  const metas=await resolvePage(mdb,{},[{imdb_id:'tt42',title:'Fallback',mediatype:'movie'}]);
  assert.equal(metas[0].name,'Cinemeta title');assert.equal(metas[0].id,'tt42');
});
test('UI preview bounds responses without changing addon pagination or full snapshots',async()=>{
  const db=database();
  const metas=Array.from({length:150},(_,i)=>({id:`tt${i}`,type:'movie',name:`Title ${i}`}));
  await db.redis.set(catalogId(legacy),JSON.stringify(metas));db.redis.writes=[];
  const path=`/${db.userId}/catalog/cartoon/${encodeURIComponent(catalogId(legacy))}`;
  const preview=await request(path+'/skip=0.json?preview=1');
  assert.deepEqual(preview.data.metas,metas.slice(0,12));
  assert.match(preview.headers.get('cache-control'),/no-store/);
  assert.equal((await request(path+'/skip=0.json')).data.metas.length,100);
  assert.equal((await request(path+'.json')).data.metas.length,150);
  assert.equal(db.redis.writes.length,0);
});

test('preview reuse deduplicates requests, isolates image failures and clears on reconnect',async()=>{
  const db=database();await db.redis.set(CONFIG_KEY,{lists:[legacy]});
  await db.redis.set(catalogId(legacy),JSON.stringify(cached));
  const context=frontend(),{ui}=context;
  ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  const original=context.fetch;let calls=0;
  context.fetch=(url,init)=>{if(url.includes('?preview=1')) calls++;return original(url,init);};
  const [first,second]=await Promise.all([ui.previewList(ui.state.lists[0]),ui.previewList(ui.state.lists[0])]);
  first[0].poster='';assert.equal(second[0].poster,cached[0].poster);
  await ui.previewList(ui.state.lists[0]);assert.equal(calls,1);
  await db.redis.set(catalogId(legacy),JSON.stringify([{...cached[0],name:'Updated'}]));
  await ui.connect();assert.equal((await ui.previewList(ui.state.lists[0]))[0].name,'Updated');
  assert.equal(calls,2);
  ui.disconnect();ui.state.upstashUrl=db.upstashUrl;ui.state.upstashToken=db.upstashToken;await ui.connect();
  context.fetch=async()=>new Response(JSON.stringify({error:'Unavailable'}),{status:502});
  await assert.rejects(ui.previewList(ui.state.lists[0]),/Unavailable/);
  context.fetch=original;
  assert.equal((await ui.previewList(ui.state.lists[0]))[0].name,'Updated');
});
