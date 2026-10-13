import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
test('two users publish, invite, accept, chat; outsider, block and deletion protections',async()=>{
 const {app,db}=createApp(':memory:');const server=app.listen(0);await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 const req=async(path,method='GET',data,token)=>{const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});return{status:response.status,data:await response.json()};};
 try{
 const signup=async(name)=>{const r=await req('/auth/signup','POST',{email:name+'@example.com',password:'securePassword123',name,city:'上海'});assert.equal(r.status,201);return r.data;};
 const a=await signup('Alice'),b=await signup('Bob'),c=await signup('Carol');
 assert.equal((await req('/auth/login','POST',{email:'Alice@example.com',password:'wrong'})).status,401);
 assert.equal((await req('/workouts')).status,401);
 const w=await req('/workouts','POST',{venue:'测试健身房',city:'上海',parts:['背部','二头肌'],starts:new Date(Date.now()+3600000).toISOString(),note:'一起练'},a.token);assert.equal(w.status,201);
 const found=await req('/workouts','GET',undefined,b.token);assert.equal(found.data.length,1);assert.deepEqual(found.data[0].parts,['背部','二头肌']);assert.equal(found.data[0].venue,'测试健身房');assert.equal(found.data[0].email,undefined);
 assert.equal((await req('/invites','POST',{workoutId:w.data.id},a.token)).status,400);
 const invitation=await req('/invites','POST',{workoutId:w.data.id},b.token);assert.equal(invitation.status,201);const id=invitation.data.id;
 assert.equal((await req('/invites','POST',{workoutId:w.data.id},b.token)).status,409);
 assert.equal((await req('/invites/'+id,'PATCH',{status:'accepted'},b.token)).status,403);
 assert.equal((await req('/invites/'+id+'/messages','GET',undefined,c.token)).status,404);
 assert.equal((await req('/invites/'+id+'/messages','POST',{body:'你好'},b.token)).status,403);
 assert.equal((await req('/invites/'+id,'PATCH',{status:'accepted'},a.token)).status,200);
 assert.equal((await req('/invites/'+id+'/messages','POST',{body:'门口集合'},b.token)).status,201);
 assert.equal((await req('/invites/'+id+'/messages','GET',undefined,a.token)).data[0].body,'门口集合');
 assert.equal((await req('/workouts/'+w.data.id,'DELETE',undefined,b.token)).status,404);
 assert.equal((await req('/reports','POST',{target:a.user.id,reason:'不恰当行为'},b.token)).status,201);
 assert.equal((await req('/blocks','POST',{target:a.user.id},b.token)).status,200);
 assert.equal((await req('/workouts','GET',undefined,b.token)).data.length,0);
 assert.equal((await req('/invites/'+id+'/messages','POST',{body:'blocked'},a.token)).status,403);
 assert.equal((await req('/me','DELETE',undefined,a.token)).status,200);
 assert.equal((await req('/me','GET',undefined,a.token)).status,401);
 assert.equal(db.prepare('SELECT count(*) n FROM messages').get().n,0);
 assert.equal((await req('/admin/reports')).status,403);
 const previous=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN='a'.repeat(32);
 const admin=await fetch(url+'/admin/users/'+c.user.id+'/suspend',{method:'POST',headers:{'x-admin-token':process.env.ADMIN_TOKEN}});assert.equal(admin.status,200);
 assert.equal((await req('/me','GET',undefined,c.token)).status,401);
 assert.equal((await req('/auth/login','POST',{email:'Carol@example.com',password:'securePassword123'})).status,401);
 if(previous===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=previous;
 }finally{await new Promise(r=>server.close(r));db.close();}
});
