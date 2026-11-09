const api = require('../../utils/api');
const parts = ['胸部','背部','肩部','腿部','臀部','二头肌','三头肌','核心','全身'];
const dateString = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const format = ms => {const d=new Date(ms);return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
Page({
 data:{tab:'discover',configured:false,busy:false,user:null,city:'上海',name:'',parts,selected:[],selectedMap:{},filter:'全部',workouts:[],invites:[],messages:[],chatId:'',chatName:'',message:'',venue:'',note:'',date:dateString(new Date()),time:'19:00',minDate:dateString(new Date()),statusNames:{pending:'等待回复',accepted:'已接受',declined:'已婉拒',cancelled:'已取消'}},
 async onLoad(){this.setData({configured:getApp().globalData.configured});if(!this.data.configured)return;await this.perform(async()=>{const user=await api('me');if(user)this.setData({user,name:user.name,city:user.city});await this.refresh();});},
 onShow(){this.startPolling();},
 onHide(){this.stopPolling();},
 onUnload(){this.stopPolling();},
 stopPolling(){if(this.pollTimer)clearInterval(this.pollTimer);this.pollTimer=null;},
 startPolling(){this.stopPolling();this.pollTimer=setInterval(()=>{if(this.data.chatId&&!this.polling){this.polling=true;this.loadMessages().catch(()=>this.stopPolling()).finally(()=>{this.polling=false;});}},10000);},
 async perform(fn){if(this.data.busy)return;this.setData({busy:true});try{await fn();}catch(e){wx.showToast({title:e.message||'操作失败，请重试',icon:'none',duration:3000});}finally{this.setData({busy:false});}},
 field(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
 switchTab(e){this.setData({tab:e.currentTarget.dataset.tab,chatId:'',messages:[]});if(this.data.user)this.perform(()=>this.refresh());},
 togglePart(e){const p=e.currentTarget.dataset.part, selected=this.data.selected;const next=selected.includes(p)?selected.filter(x=>x!==p):selected.length<5?[...selected,p]:selected;this.setData({selected:next,selectedMap:next.reduce((map,x)=>{map[x]=true;return map;},{})});},
 setFilter(e){this.setData({filter:e.currentTarget.dataset.part});this.applyFilter();},
 applyFilter(){this.setData({workouts:(this.allWorkouts||[]).filter(w=>this.data.filter==='全部'||w.parts.includes(this.data.filter))});},
 async refresh(){if(!this.data.user)return;if(this.data.tab==='discover'){this.allWorkouts=(await api('workouts',{city:this.data.city})).map(w=>({...w,when:format(w.starts),partText:w.parts.join(' · ')}));this.applyFilter();}if(this.data.tab==='invites'){this.setData({invites:(await api('invites')).map(i=>({...i,when:format(i.starts),partText:i.parts.join(' · '),statusText:this.data.statusNames[i.status]}))});}},
 search(){this.perform(()=>this.refresh());},
 saveProfile(){this.perform(async()=>{const user=await api('profile',{name:this.data.name,city:this.data.city});this.setData({user});wx.showToast({title:'已保存',icon:'success'});});},
 publish(){this.perform(async()=>{await api('publish',{venue:this.data.venue,city:this.data.city,parts:this.data.selected,note:this.data.note,starts:new Date(`${this.data.date}T${this.data.time}:00+08:00`).getTime()});this.setData({tab:'discover',venue:'',note:'',selected:[],selectedMap:{}});await this.refresh();wx.showToast({title:'训练已发布'});});},
 invite(e){this.perform(async()=>{await api('invite',{id:e.currentTarget.dataset.id});wx.showToast({title:'邀约已发送'});});},
 removeWorkout(e){wx.showModal({title:'删除这次训练？',content:'删除后其他人将无法再邀请你参加这次训练。',success:r=>{if(r.confirm)this.perform(async()=>{await api('removeWorkout',{id:e.currentTarget.dataset.id});await this.refresh();});}});},
 respond(e){this.perform(async()=>{await api('respond',{id:e.currentTarget.dataset.id,status:e.currentTarget.dataset.status});await this.refresh();});},
 openChat(e){this.perform(async()=>{this.setData({chatId:e.currentTarget.dataset.id,chatName:e.currentTarget.dataset.name,messages:[]});await this.loadMessages();this.startPolling();});},
 closeChat(){this.setData({chatId:'',messages:[]});},
 async loadMessages(){const id=this.data.chatId;if(!id)return;const messages=await api('messages',{id});if(this.data.chatId===id)this.setData({messages:messages.map(m=>({...m,when:format(m.created),mine:m.userId===this.data.user.id})),lastMessage:messages.length?'msg-'+messages[messages.length-1]._id:''});},
 send(){if(!this.data.message.trim())return;this.perform(async()=>{await api('send',{id:this.data.chatId,body:this.data.message});this.setData({message:''});await this.loadMessages();});},
 deleteAccount(){wx.showModal({title:'永久删除账号？',content:'你的名片、训练、邀约及关联聊天记录将被删除，无法恢复。',success:r=>{if(r.confirm)this.perform(async()=>{await api('deleteAccount');this.allWorkouts=[];this.setData({user:null,name:'',workouts:[],invites:[],messages:[],chatId:''});wx.showToast({title:'账号已删除'});});}});},
 report(e){const target=e.currentTarget.dataset.target;wx.showModal({title:'举报用户',editable:true,placeholderText:'请填写原因（至少3个字）',success:r=>{if(r.confirm)this.perform(async()=>{await api('report',{target,reason:r.content});wx.showToast({title:'举报已提交'});});}});},
 block(e){const target=e.currentTarget.dataset.target;wx.showModal({title:'拉黑这位用户？',content:'彼此将无法查看训练或继续约练聊天。',success:r=>{if(r.confirm)this.perform(async()=>{await api('block',{target});this.setData({chatId:''});await this.refresh();});}});}
});
