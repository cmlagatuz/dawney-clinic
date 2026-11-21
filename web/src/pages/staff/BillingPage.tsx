import {useMemo} from 'react'
import {useAuth} from '../../hooks/AuthProvider'
import {createBillingPort} from '../../billing/port'
import {BillingStaffWorkspace} from '../../billing/Workspace'

/** Feature-OFF source route; all finance reads remain blocked until audited ASTRA APIs. */
export function BillingPage(){
 const {user}=useAuth()
 const id=user?.id??null
 const port=useMemo(()=>user?createBillingPort(user):null,[id])
 if(!id||!port)return <p role="alert">A verified staff session is required for clinic billing.</p>
 return <BillingStaffWorkspace key={id} accountId={id} port={port}/>
}
