import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './hooks/AuthProvider'
import { AppLayout, PublicLayout } from './components/Layout'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/public/HomePage'
import { ServicesPage } from './pages/public/ServicesPage'
import { AboutPage } from './pages/public/AboutPage'
import { BookPage } from './pages/public/BookPage'
import { NotFoundPage } from './pages/public/NotFoundPage'
import { CallbackPage, ForgotPasswordPage, LoginPage, RecoveryPage, SignUpPage, VerifyPage } from './pages/AuthPages'
import { OverviewPage } from './pages/OverviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { PetsPage } from './pages/PetsPage'
import { PetsPageCatalog } from './pages/PetsPageCatalog'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { configured } from './lib/supabase'
import { OPS_UI_ENABLED } from './ops/flag'
import { OpsPage } from './pages/staff/OpsPage'
import { ClinicalWorkspacePage } from './pages/staff/ClinicalWorkspacePage'
import { PharmacyPage } from './pages/staff/PharmacyPage'
import { BillingPage } from './pages/staff/BillingPage'
import { OwnerBillingPage } from './billing/OwnerBillingPage'
import { ClinicReleasePage, CommunicationsUnavailablePage } from './pages/ClinicReleasePage'

function Guard() {
  const { checking, user, error, refresh } = useAuth()
  if(checking) return <main className="center-state" role="status"><span className="spinner" aria-hidden="true" />Verifying your secure session…</main>
  if(error) return <main className="center-state"><p role="alert">{error}</p><button className="button button-primary" onClick={()=>void refresh()}>Retry</button></main>
  return user ? <Outlet /> : <Navigate to="/auth/signin" replace />
}
/** Off by default: the catalog/attachment form needs the Phase 4 migrations, which are not live yet. */
const phase4PatientForm = import.meta.env.VITE_PHASE4_PATIENT_FORM === 'true'
/** Clinical preview is OFF by default until secure patient+branch contracts and owner approval. */
const clinicalWorkspacePreview = import.meta.env.VITE_CLINICAL_WORKSPACE_UI === 'true'
/** Inventory migration #15 is NOT applied. Staff pharmacy UI stays OFF unless explicitly enabled. */
const pharmacyPreview = import.meta.env.VITE_PHASE5B_PHARMACY_UI === 'true'
/** Financial backend is unapproved; preview stays OFF by default. */
const billingPreview = import.meta.env.VITE_PHASE5C_BILLING_UI === 'true'

export function App() {
  if(!configured) return <main className="config-error"><h1>Clinic setup required</h1>
    <p>This preview needs the public Supabase URL and publishable API key. No secret keys are needed.</p>
    <p>Ask the administrator to configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> before publishing.</p></main>
  return <BrowserRouter><AuthProvider><a className="skip-link" href="#main-content">Skip to main content</a><Routes>
    <Route element={<SiteLayout />}><Route path="/" element={<HomePage/>}/><Route path="/services" element={<ServicesPage/>}/>
      <Route path="/about" element={<AboutPage/>}/><Route path="/location" element={<AboutPage/>}/><Route path="/contact" element={<AboutPage/>}/>
      <Route path="/book" element={<BookPage/>}/><Route path="*" element={<NotFoundPage/>}/></Route>
    <Route element={<PublicLayout />}><Route path="/auth/signin" element={<LoginPage/>}/><Route path="/auth/signup" element={<SignUpPage/>}/>
      <Route path="/auth/verify" element={<VerifyPage/>}/><Route path="/auth/forgot" element={<ForgotPasswordPage/>}/>
      <Route path="/auth/recovery" element={<RecoveryPage/>}/><Route path="/auth/callback" element={<CallbackPage/>}/></Route>
    <Route element={<Guard/>}><Route element={<AppLayout/>}><Route path="/app/overview" element={<OverviewPage/>}/><Route path="/app/profile" element={<ProfilePage/>}/>
      <Route path="/app/pets" element={phase4PatientForm?<PetsPageCatalog/>:<PetsPage/>}/>
      <Route path="/app/appointments" element={<AppointmentsPage/>}/>
      <Route path="/app/clinic" element={<ClinicReleasePage/>}/>
      <Route path="/app/communications" element={<CommunicationsUnavailablePage/>}/>
      {OPS_UI_ENABLED && <Route path="/app/ops" element={<OpsPage/>}/>}
      {clinicalWorkspacePreview && <Route path="/app/clinical" element={<ClinicalWorkspacePage/>}/>}
      {pharmacyPreview && <Route path="/app/pharmacy" element={<PharmacyPage/>}/>}
      {billingPreview && <Route path="/app/billing" element={<BillingPage/>}/>}
      {billingPreview && <Route path="/app/invoices" element={<OwnerBillingPage/>}/>}</Route></Route>
</Routes></AuthProvider></BrowserRouter>
}