import {Link} from 'react-router'
import {PageHeading} from '../components/ui'
import {useAuth} from '../hooks/AuthProvider'
import './billing.css'

/**
 * No reviewed owner invoice/receipt reader exists in the inherited backend.
 * Do not try legacy orders, staff finance tables or user-editable metadata.
 * This route intentionally performs zero network financial reads.
 */
export function OwnerBillingPage(){
 const {user}=useAuth()
 if(!user)return <p role="alert">Sign in to inspect your own account.</p>
 return <section className="page billing-owner" aria-labelledby="owner-billing-title">
   <PageHeading id="owner-billing-title" eyebrow="Pet owner portal · unavailable"
     title="My invoices & receipts">
     Only invoices and receipts that the clinic explicitly authorizes for your verified owner account can appear here.
   </PageHeading>
   <div className="card billing-owner-shell" role="status">
     <h2>Owner billing records are not available yet</h2>
     <p>No secure owner-scoped finance reader or approved invoice/receipt publication policy has been integrated.
       This is not a statement that you have no charges or that any payment succeeded.</p>
     <p>When available, only records bound to your verified owner identity may be shown.
       No financial records have been requested or inferred for this account.</p>
     <div className="billing-actions">
       <button type="button" className="button button-secondary" disabled>View receipt · unavailable</button>
       <button type="button" className="button button-secondary" disabled>Download invoice · unavailable</button>
       <button type="button" className="button button-secondary" disabled>Pay online · unavailable</button>
       <Link className="button button-primary" to="/app/appointments">My appointments</Link>
     </div>
   </div>
 </section>
}
