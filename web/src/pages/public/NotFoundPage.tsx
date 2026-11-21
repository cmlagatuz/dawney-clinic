import { Link } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { EmptyState, PageHeading } from '../../components/ui'

export function NotFoundPage() {
  usePageMeta('Page not found — Dawney Animal Clinic', 'This page does not exist.')
  return <div className="page"><PageHeading id="not-found-heading" title="Page not found" eyebrow="Dawney Animal Clinic">This address does not match a public page.</PageHeading><EmptyState icon="paw" title="We couldn’t find that page" action={<div className="cta-row"><Link className="button button-primary" to="/">Go to the home page</Link><Link className="button button-secondary" to="/services">Services</Link></div>}>
    The address may be mistyped or the page may have moved.</EmptyState></div>
}
