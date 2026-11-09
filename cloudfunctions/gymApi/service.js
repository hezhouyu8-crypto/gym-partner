const { createHash, randomUUID } = require('node:crypto');
const PARTS = ['胸部','背部','肩部','腿部','臀部','二头肌','三头肌','核心','全身'];
const fail = message => { const e = new Error(message); e.userFacing = true; throw e; };
const text = (v, min, max, label) => {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) fail(label + '格式不正确');
  return v.trim();
};
const idFor = (...values) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
function createService(store, moderate = async () => {}) {
 return async (openid, action, data = {}) => {
  if (!openid) fail('请从微信小程序访问');
  const uid = idFor('user', openid);
  const user = await store.get('users', uid);
  if (action === 'deleteAccount' && user) {
   await store.set('users',uid,{...user,deleting:true});
   await store.removeWhere('messages',{userId:uid});
   const ownInvites = await store.all('invites',{or:[{sender:uid},{receiver:uid}]});
   for (const i of ownInvites) await store.removeWhere('messages',{inviteId:i._id});
   await store.removeWhere('invites',{or:[{sender:uid},{receiver:uid}]});
   await store.removeWhere('workouts',{userId:uid});
   await store.removeWhere('blocks',{or:[{userId:uid},{target:uid}]});
   await store.removeWhere('reports',{or:[{userId:uid},{target:uid}]});
   await store.remove('users',uid);return {ok:true};
  }
  if (user && user.deleting) fail('账号正在删除，请重试删除操作');
  if (user && user.suspended) fail('账号已暂停使用');
  if (action === 'me') return user ? { id: uid, name: user.name, city: user.city } : null;
  if (action === 'profile') {
   const name = text(data.name, 1, 30, '昵称'), city = text(data.city, 1, 50, '城市');
   await moderate(name + ' ' + city, openid);
   await store.set('users', uid, { name, city, suspended: false });
   return { id: uid, name, city };
  }
  if (!user) fail('请先在“我的”完善昵称和城市');
  const blocked = async (a,b) => !!(await store.get('blocks',idFor(a,b)) || await store.get('blocks',idFor(b,a)));
  const available = async id => {const u = await store.get('users',id);return u && !u.suspended && !u.deleting ? u : null;};
  const invitation = async id => {
   const i = await store.get('invites', text(id,1,100,'邀约'));
   if (!i || ![i.sender,i.receiver].includes(uid)) fail('邀约不存在');
   if (!await available(i.sender) || !await available(i.receiver) || await blocked(i.sender,i.receiver)) fail('无法访问该邀约');
   return i;
  };
  if (action === 'workouts') {
   const rows = await store.list('workouts', { city: text(data.city || user.city,1,50,'城市'), starts: {gt: Date.now()} }, 'starts','asc',100);
   const result = [];
   for (const w of rows) {const u = await available(w.userId);if (u && !await blocked(uid,w.userId)) result.push({...w,name:u.name});}
   return result;
  }
  if (action === 'publish') {
   const venue = text(data.venue,2,100,'场馆'), city = text(data.city,1,50,'城市'), note = text(data.note || '一起训练',1,300,'备注');
   if (!Array.isArray(data.parts) || !data.parts.length || data.parts.length > 5 || data.parts.some(p=>!PARTS.includes(p))) fail('请选择1至5个训练部位');
   const starts = Number(data.starts);
   if (!Number.isFinite(starts) || starts <= Date.now() || starts > Date.now()+30*86400000) fail('请选择未来30天内的时间');
   await moderate(venue+' '+city+' '+note,openid);
   const id = randomUUID();await store.create('workouts',id,{userId:uid,venue,city,note,parts:[...new Set(data.parts)],starts});return {id};
  }
  if (action === 'removeWorkout') {
   const w = await store.get('workouts', text(data.id,1,100,'训练'));
   if (!w || w.userId !== uid) fail('训练不存在');
   await store.remove('workouts',w._id);return {ok:true};
  }
  if (action === 'invite') {
   const w = await store.get('workouts',text(data.id,1,100,'训练'));
   if (!w || w.starts <= Date.now()) fail('训练已结束或不存在');
   if (w.userId === uid) fail('不能邀请自己');
   if (!await available(w.userId) || await blocked(uid,w.userId)) fail('无法发出邀约');
   const id = idFor(w._id,uid);
   if (!await store.create('invites',id,{workoutId:w._id,sender:uid,receiver:w.userId,status:'pending',venue:w.venue,parts:w.parts,starts:w.starts,created:Date.now()})) fail('已发送过邀约');
   return {id};
  }
  if (action === 'invites') {
   const rows = await store.list('invites', {or:[{sender:uid},{receiver:uid}]},'created','desc',100), result=[];
   for (const i of rows) {
    const sender = await available(i.sender), receiver = await available(i.receiver);
    if (sender && receiver && !await blocked(i.sender,i.receiver)) result.push({...i,otherId:i.sender===uid?i.receiver:i.sender,otherName:i.sender===uid?receiver.name:sender.name});
   }
   return result;
  }
  if (action === 'respond') {
   const i = await invitation(data.id), status = data.status;
   if (status === 'cancelled') {if (!['pending','accepted'].includes(i.status)) fail('邀约已经结束');}
   else if (['accepted','declined'].includes(status)) {
    if (i.receiver !== uid || i.status !== 'pending') fail('不能更改该邀约');
    if (i.starts <= Date.now() || !await store.get('workouts',i.workoutId)) fail('训练已结束或被删除');
   } else fail('无效状态');
   if (!await store.updateIf('invites',i._id,{status:i.status},{status})) fail('邀约已更新，请刷新');
   return {ok:true};
  }
  if (action === 'messages' || action === 'send') {
   const i = await invitation(data.id);
   if (i.status !== 'accepted') fail('接受邀约后才能聊天');
   if (action === 'messages') return (await store.list('messages',{inviteId:i._id},'created','desc',100)).reverse();
   const body = text(data.body,1,1000,'消息');await moderate(body,openid);
   const id = randomUUID();await store.create('messages',id,{inviteId:i._id,userId:uid,name:user.name,body,created:Date.now()});return {id};
  }
  if (action === 'block' || action === 'report') {
   const target = text(data.target,1,100,'用户');
   if (target === uid || !await available(target)) fail('无效用户');
   if (action === 'block') await store.set('blocks',idFor(uid,target),{userId:uid,target});
   else {const reason=text(data.reason,3,500,'举报原因');await store.create('reports',randomUUID(),{userId:uid,target,reason,created:Date.now()});}
   return {ok:true};
  }
  fail('不支持的操作');
 };
}
module.exports = { createService, PARTS };
