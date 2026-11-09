const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createService} = require('../service');
function memoryStore(){
 const tables=new Map();const table=n=>{if(!tables.has(n))tables.set(n,new Map());return tables.get(n);};
 const matches=(row,f)=>f.or?f.or.some(x=>matches(row,x)):Object.entries(f).every(([k,v])=>v&&typeof v==='object'?row[k]>v.gt:row[k]===v);
 return {
  async get(n,id){return table(n).get(id)||null;},
  async set(n,id,data){table(n).set(id,{...data,_id:id});},
  async create(n,id,data){if(table(n).has(id))return false;await this.set(n,id,data);return true;},
  async all(n,f){return [...table(n).values()].filter(r=>matches(r,f));},
  async list(n,f,key,order,limit){return (await this.all(n,f)).sort((a,b)=>(a[key]===b[key]?a._id.localeCompare(b._id):a[key]>b[key]?1:-1)*(order==='desc'?-1:1)).slice(0,limit);},
  async updateIf(n,id,expected,data){const row=await this.get(n,id);if(!row||!matches(row,expected))return false;await this.set(n,id,{...row,...data});return true;},
  async remove(n,id){table(n).delete(id);},
  async removeWhere(n,f){for(const row of await this.all(n,f))await this.remove(n,row._id);}
 };
}
test('publish venue and body parts, permission checks, accepted chat, block and data deletion',async()=>{
 const store=memoryStore(), moderated=[];const api=createService(store,async text=>{moderated.push(text);});
 await assert.rejects(()=>api('', 'me'),/微信/);
 assert.equal(await api('alice','me'),null);
 await assert.rejects(()=>api('alice','publish',{}),/完善/);
 const a=await api('alice','profile',{name:'小何',city:'上海'}),b=await api('bob','profile',{name:'小林',city:'上海'});
 await api('eve','profile',{name:'路人',city:'上海'});
 const plan={venue:'静安健身房',city:'上海',parts:['背部','二头肌'],starts:Date.now()+3600000,note:'门口集合'};
 await assert.rejects(()=>api('alice','publish',{...plan,parts:['无效部位']}),/训练部位/);
 const workout=await api('alice','publish',plan);
 const rows=await api('bob','workouts',{});assert.equal(rows[0].venue,plan.venue);assert.deepEqual(rows[0].parts,plan.parts);assert.equal(rows[0].openid,undefined);
 await assert.rejects(()=>api('alice','invite',workout),/自己/);
 const invite=await api('bob','invite',workout);
 await assert.rejects(()=>api('bob','invite',workout),/已发送/);
 await assert.rejects(()=>api('bob','respond',{...invite,status:'accepted'}),/不能更改/);
 await assert.rejects(()=>api('eve','messages',invite),/不存在/);
 await assert.rejects(()=>api('bob','send',{...invite,body:'你好'}),/接受邀约/);
 await api('alice','respond',{...invite,status:'accepted'});
 for(let i=0;i<105;i++)await store.create('messages',String(i).padStart(4,'0'),{inviteId:invite.id,userId:b.id,body:'历史'+i,created:Date.now()-10000+i});
 await api('bob','send',{...invite,body:'最新消息'});
 const history=await api('alice','messages',invite);assert.equal(history.length,100);assert.equal(history.at(-1).body,'最新消息');assert.ok(history.every((m,i)=>i===0||m.created>=history[i-1].created));
 await assert.rejects(()=>api('bob','removeWorkout',workout),/不存在/);
 await api('bob','report',{target:a.id,reason:'测试举报'});
 await api('bob','block',{target:a.id});assert.equal((await api('bob','workouts',{})).length,0);
 await assert.rejects(()=>api('alice','messages',invite),/无法访问/);
 await api('alice','deleteAccount');assert.equal(await api('alice','me'),null);assert.equal((await store.all('messages',{})).length,0);assert.equal((await store.all('invites',{})).length,0);
 assert.ok(moderated.includes('静安健身房 上海 门口集合'));assert.ok(moderated.includes('最新消息'));
});
test('content check failure prevents publishing and frozen users cannot bypass with profile update',async()=>{
 const store=memoryStore();const api=createService(store,async content=>{if(content.includes('禁止内容'))throw new Error('内容未通过');});
 const u=await api('alice','profile',{name:'测试',city:'上海'});
 await assert.rejects(()=>api('alice','publish',{venue:'测试场馆',city:'上海',parts:['胸部'],starts:Date.now()+10000,note:'禁止内容'}),/内容未通过/);
 assert.equal((await store.all('workouts',{})).length,0);
 await store.set('users',u.id,{name:'测试',city:'上海',suspended:true});
 await assert.rejects(()=>api('alice','profile',{name:'重置',city:'上海'}),/暂停/);
});
