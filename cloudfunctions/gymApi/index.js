const cloud = require('wx-server-sdk');
const { createService } = require('./service');
cloud.init({env: cloud.DYNAMIC_CURRENT_ENV});
const db = cloud.database({throwOnNotFound:false}), command = db.command;
function query(filter) {
 if (filter.or) return command.or(filter.or);
 return Object.fromEntries(Object.entries(filter).map(([k,v])=>[k,v && typeof v==='object' && 'gt' in v ? command.gt(v.gt) : v]));
}
const store = {
 async get(table,id) {const {data}=await db.collection(table).where({_id:id}).limit(1).get();return data[0] || null;},
 async set(table,id,data) {const {_id,...fields}=data;await db.collection(table).doc(id).set({data:fields});},
 async create(table,id,data) {
  try {await db.collection(table).add({data:{_id:id,...data}});return true;}
  catch(e) {if (await this.get(table,id)) return false;throw e;}
 },
 async list(table,filter,field,direction,limit) {return (await db.collection(table).where(query(filter)).orderBy(field,direction).orderBy('_id',direction).limit(limit).get()).data;},
 async updateIf(table,id,expected,data) {const r=await db.collection(table).where({_id:id,...expected}).update({data});return r.stats.updated===1;},
 async all(table,filter) {const rows=[];for(let skip=0;;skip+=100){const batch=(await db.collection(table).where(query(filter)).skip(skip).limit(100).get()).data;rows.push(...batch);if(batch.length<100)return rows;}},
 async removeWhere(table,filter) {for(;;){const rows=(await db.collection(table).where(query(filter)).limit(100).get()).data;if(!rows.length)return;for(const row of rows)await this.remove(table,row._id);}},
 async remove(table,id) {await db.collection(table).doc(id).remove();}
};
const service = createService(store, async(content,openid)=>{
 const result = await cloud.openapi.security.msgSecCheck({openid,scene:2,version:2,content});
 if (!result.result || result.result.suggest !== 'pass') {const e=new Error('内容未通过安全检查，请修改后再试');e.userFacing=true;throw e;}
});
exports.main = async event => {
 try {
  const {OPENID} = cloud.getWXContext();
  if (!OPENID) return {ok:false,error:'请从微信小程序访问'};
  const key=require('node:crypto').createHash('sha256').update(OPENID+':'+Math.floor(Date.now()/60000)).digest('hex');
  await db.runTransaction(async tx=>{
   const ref=tx.collection('rateLimits').doc(key);
   const row=(await ref.get()).data;
   if(row && row.count>=120){const e=new Error('操作过于频繁，请稍后再试');e.userFacing=true;throw e;}
   await ref.set({data:{count:(row?row.count:0)+1,expiresAt:new Date(Date.now()+3600000)}});
  });
  return {ok:true,data:await service(OPENID,event.action,event.data)};
 } catch(e) {if (!e.userFacing) console.error('gymApi failure',e.errCode || e.code || 'unknown');return {ok:false,error:e.userFacing?e.message:'服务暂时不可用，请稍后重试'};}
};
