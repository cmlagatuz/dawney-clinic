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
import { AppointmentsPage } from './pages/AppointmentsPage'
import { configured } from './lib/supabase'

function Guard() {
  const { checking, user, error, refresh } = useAuth()
  if(checking) return <main className="center-state" role="status"><span className="spinner" aria-hidden="true" />Verifying your secure session…</main>
  if(error) return <main className="center-state"><p role="alert">{error}</p><button className="button button-primary" onClick={()=>void refresh()}>Retry</button></main>
  return user ? <Outlet /> : <Navigate to="/auth/signin" replace />
}
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
      <Route path="/app/pets" element={<PetsPage/>}/>
      <Route path="/app/appointments" element={<AppointmentsPage/>}/></Route></Route>
</Routes></AuthProvider></BrowserRouter>
}