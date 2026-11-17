import { Link } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { EmptyState } from '../../components/ui'

export function NotFoundPage() {
  usePageMeta('Page not found — Dawney Animal Clinic', 'This page does not exist.')
  return <div className="page"><EmptyState icon="paw" title="We couldn’t find that page" action={<div className="cta-row"><Link className="button button-primary" to="/">Go to the home page</Link><Link className="button button-secondary" to="/services">Services</Link></div>}>
    The address may be mistyped or the page may have moved.</EmptyState></div>
}
