import {useEffect} from 'react'

/** Memory-only warning. Never prevents forced sign-out or authorization loss. */
export function useUnresolvedOperationWarning(pending:boolean){
 useEffect(()=>{
  if(!pending)return
  const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
  const link=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target.closest('a[href]'):null
   if(!target)return
   if(!window.confirm('An operation may already have committed. Leaving loses its in-memory retry identity. Reconcile with an authorized supervisor before submitting again. Leave anyway?')){
    event.preventDefault();event.stopPropagation()
   }
  }
  window.addEventListener('beforeunload',unload)
  document.addEventListener('click',link,true)
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',link,true)}
 },[pending])
}
