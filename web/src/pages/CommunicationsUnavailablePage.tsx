import {Link} from 'react-router'
import {PageHeading} from '../components/ui'

/** No transport, outbox, subscription or consent assumption exists.
 * This page never invokes an API, reads a recipient, or sends a message. */
export function CommunicationsUnavailablePage(){
  return <section className="page clinic-communications" aria-labelledby="communications-title">
    <PageHeading id="communications-title" eyebrow="Owner account · protected"
      title="Clinic communications">
      Private messages, notifications and campaigns require an independently approved
      identity, consent, delivery and retention contract. This account has not been enrolled in messaging.
    </PageHeading>
    <div className="card" role="status">
      <h2>Secure messages are not available</h2>
      <p>There is no connected inbox, approved consent record, or verified outbound delivery service.
        No message has been queued, sent, read or delivered from this page.</p>
      <div className="cta-row">
        <button type="button" className="button button-secondary" disabled>Compose message · unavailable</button>
        <button type="button" className="button button-secondary" disabled>Send reminder · unavailable</button>
        <button type="button" className="button button-secondary" disabled>Manage message consent · unavailable</button>
        <Link className="button button-quiet" to="/app/workflows">Return to clinic journeys</Link>
      </div>
    </div>
  </section>
}
