// Browser-only synthetic membership service. No request leaves the fixture origin.
export function backupCenterFixture(){
 const params=new URL(location.href).searchParams
 const remote='https://backup-preview-fixture.supabase.co'
 const branch='50000000-0000-4000-8000-000000000001'
 const uid=n=>'50000000-0000-4000-8000-'+String(n).padStart(12,'0')
 let counter=2,role=params.get('role')||'administrator',hold=null,fail=params.get('fail')==='1'
 const makeUser=()=>({id:uid(counter),aud:'authenticated',role:'authenticated',
  email:'synthetic-backup-operator@example.test',email_confirmed_at:'2025-01-01T00:00:00Z',
  created_at:'2025-01-01T00:00:00Z',app_metadata:{},user_metadata:{role:'administrator'}})
 let user=makeUser()
 const session=()=>{
  const expires_at=Math.floor(Date.now()/1000)+86400
  const access_token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:user.id,exp:expires_at}),'fixture'].map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  return {access_token,refresh_token:'synthetic-backup-session',expires_at,token_type:'bearer',user}
 }
 if(role==='visitor')localStorage.removeItem('dawney.auth.v1')
 else localStorage.setItem('dawney.auth.v1',JSON.stringify(session()))
 localStorage.setItem('dawney-theme',params.get('theme')==='dark'?'dark':'light')
 const calls={unexpected:[],assertions:0,held:false,released:false,
  switchAccount(next){
   role=next;counter++;user=makeUser()
   const nextSession=session()
   localStorage.setItem('dawney.auth.v1',JSON.stringify(nextSession))
   const channel=new BroadcastChannel('dawney.auth.v1')
   channel.postMessage({event:'SIGNED_IN',session:nextSession});channel.close()
  },
  holdMembership(){let release;const promise=new Promise(resolve=>{release=resolve});hold={promise,release,account:user.id};calls.held=false;calls.released=false},
  releaseMembership(){hold?.release();hold=null;calls.released=true},
  recover(){fail=false}
 }
 window.__backupFixture=calls
 const nativeFetch=window.fetch.bind(window)
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})
 window.fetch=async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url)
  if(url.origin===location.origin)return nativeFetch(input,init)
  if(url.origin!==remote){calls.unexpected.push('unexpected origin');throw Error('Offline synthetic fixture only')}
  const path=url.pathname
  if(request.method==='GET'&&path==='/auth/v1/user')return role==='visitor'?json({message:'No session'},401):json(user)
  if(request.method==='GET'&&path==='/rest/v1/staff_memberships'){
   const actor=user.id,actorRole=role
   const data=['administrator','veterinarian','receptionist','accountant'].includes(actorRole)?[{user_id:actor,role:actorRole,is_active:true}]:[]
   if(hold?.account===actor){calls.held=true;await hold.promise}
   if(fail)return json({code:'08006',message:'Synthetic access reader failed'},503)
   return json(data)
  }
  if(request.method==='GET'&&path==='/rest/v1/staff_branch_memberships')
   return json(['administrator','veterinarian','receptionist'].includes(role)?[{user_id:user.id,branch_id:branch,role,is_active:true}]:[])
  if(request.method==='GET'&&path==='/rest/v1/clinic_branches')return json([{id:branch,slug:'naga',display_name:'Synthetic clinic'}])
  if(request.method==='POST'&&path==='/rest/v1/rpc/assert_staff_branch'){
   calls.assertions++
   return (await request.json()).p_branch===branch&&['administrator','veterinarian','receptionist'].includes(role)?json(branch):json({code:'42501'},403)
  }
  calls.unexpected.push(request.method+' '+path)
  return json({code:'42501',message:'Not part of synthetic backup preview'},403)
 }
}
