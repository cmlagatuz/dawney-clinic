import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/AuthProvider'
import { isValidNewPassword } from '../domain.mjs'
import { safeBookingReturnPath } from '../booking-contract.mjs'

/** Only the exact public booking path may be returned to after auth (no open redirects). */
function useAfterAuth() {
  const [params] = useSearchParams()
  const toBook = safeBookingReturnPath(params.get('next')) === '/book'
  return { dest: toBook ? '/book' : '/app/overview', suffix: toBook ? '?next=%2Fbook' : '' }
}
import { Brand } from '../components/Layout'

function Panel({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <section className="auth-panel" aria-labelledby="auth-title"><Brand /><div className="eyebrow">Dawney secure access</div><h1 id="auth-title">{title}</h1><p className="subtitle">{intro}</p>{children}</section>
}
function ErrorMessage({ error }: { error: string | null }) {
  return error ? <p role="alert" className="alert alert-error">{error}</p> : null
}
function SuccessMessage({ message }: { message: string | null }) {
  return message ? <p role="status" className="alert alert-success">{message}</p> : null
}
function normalizeError(error: unknown) {
  const text = error instanceof Error ? error.message : ''
  if (text.toLowerCase().includes('rate limit') || text.includes('429')) return 'Too many requests. Wait until the email limit resets before trying again.'
  if (text.toLowerCase().includes('weak password') || text.toLowerCase().includes('weak_password')) return 'The password does not meet the server security policy. Try a longer, unique password.'
  if (text.includes('Email not confirmed')) return 'Check your inbox and verify your email first.'
  if (text.includes('Invalid login credentials')) return 'Email or password is incorrect.'
  return 'We could not complete the request. Please check your details and connection.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { dest, suffix } = useAfterAuth()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setError(null); setPending(true)
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      if (!result.data.user?.email_confirmed_at || result.data.user.is_anonymous) {
        await supabase.auth.signOut({ scope: 'local' })
        setError('Please verify your email before signing in.')
      } else navigate(dest, { replace: true })
    } catch (e) { setError(normalizeError(e)) }
    finally { setPending(false) }
  }
  if (user) return <Navigate to={dest} replace />
  return <Panel title="Welcome back" intro="Sign in to securely manage your veterinary profile.">
    <ErrorMessage error={error}/>
    <form onSubmit={e => void submit(e)} className="form-stack">
      <label>Email address<input autoComplete="email" name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input autoComplete="current-password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="button button-primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="form-links"><Link to="/auth/forgot">Forgot password?</Link><span>New to Dawney? <Link to={`/auth/signup${suffix}`}>Create an account</Link></span></p>
  </Panel>
}

export function SignUpPage() {
  const { suffix } = useAfterAuth()
  const [values, setValues] = useState({ email: '', password: '', first: '', last: '' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return
    if (!isValidNewPassword(values.password)) {
      setError('Use at least 8 characters, including a letter and a number. Longer passwords are recommended.')
      return
    }
    setPending(true); setError(null)
    try {
      const { error } = await supabase.auth.signUp({ email: values.email.trim(), password: values.password,
        options: { data: { first_name: values.first.trim(), last_name: values.last.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
      setSent(true)
    } catch (e) { setError(normalizeError(e)) }
    finally { setPending(false) }
  }
  function field(k: keyof typeof values, value: string) { setValues(old => ({...old, [k]: value})) }
  return <Panel title="Create an account" intro="Register as a pet owner. Staff access requires separate clinic approval.">
    {sent ? <><SuccessMessage message="If the address can receive mail, we sent a confirmation link. Verify your email before signing in."/><Link className="button button-primary" to={`/auth/signin${suffix}`}>Return to sign in</Link></> : <>
      <ErrorMessage error={error}/><form className="form-stack" onSubmit={e => void submit(e)}>
        <div className="form-row"><label>First name<input required maxLength={150} autoComplete="given-name" value={values.first} onChange={e=>field('first',e.target.value)} /></label>
          <label>Last name<input required maxLength={150} autoComplete="family-name" value={values.last} onChange={e=>field('last',e.target.value)} /></label></div>
        <label>Email address<input required type="email" autoComplete="email" value={values.email} onChange={e=>field('email',e.target.value)}/></label>
        <label>Password <small>(8+ characters, with letters and numbers; 12+ recommended)</small><input required minLength={8} maxLength={1024} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,1024}" title="At least 8 characters including a letter and a number" type="password" autoComplete="new-password" value={values.password} onChange={e=>field('password',e.target.value)}/></label>
        <button className="button button-primary" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
      </form><p className="form-links">Already registered? <Link to={`/auth/signin${suffix}`}>Sign in</Link></p></>}
  </Panel>
}

export function VerifyPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return
    setError(null); setPending(true)
    try {
      const result = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
      if (result.error) throw result.error
      navigate('/app/overview', { replace: true })
    } catch(e) { setError(normalizeError(e)) }
    finally { setPending(false) }
  }
  async function resend() {
    if (!supabase) return
    setPending(true);setError(null);setStatus(null)
    try {
      const {error} = await supabase.auth.resend({type:'signup',email: email.trim()})
      if(error) throw error
      setStatus('If eligible, a new confirmation message has been sent.')
    } catch(e) {setError(normalizeError(e))}
    finally {setPending(false)}
  }
  return <Panel title="Verify your email" intro="Follow the link in your email or enter the confirmation code if your email contains one.">
    <ErrorMessage error={error}/><SuccessMessage message={status}/>
    <form className="form-stack" onSubmit={e=>void submit(e)}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Confirmation code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" value={token} onChange={e=>setToken(e.target.value)} /></label>
      <button className="button button-primary" disabled={pending}>Verify email</button>
    </form><button className="button-quiet" disabled={pending || !email} onClick={()=>void resend()} type="button">Resend confirmation</button>
  </Panel>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [pending, setPending] = useState(false)
  async function submit(e:FormEvent) {
    e.preventDefault();if(!supabase) return
    setPending(true);setError(null)
    try { const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {redirectTo: `${window.location.origin}/auth/recovery`})
      if(error) throw error
      setStatus('If this account exists, a password-reset email will arrive shortly.')
    } catch(e) {setError(normalizeError(e))} finally {setPending(false)}
  }
  return <Panel title="Reset your password" intro="We will send a recovery link if your email address has an account.">
    <ErrorMessage error={error}/><SuccessMessage message={status}/><form className="form-stack" onSubmit={e=>void submit(e)}>
      <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button className="button button-primary" disabled={pending}>Send recovery link</button></form>
  </Panel>
}

export function RecoveryPage() {
  const navigate = useNavigate()
  const { user, checking, recovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [pending, setPending] = useState(false)
  async function submit(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    if (!isValidNewPassword(password)) {
      setError('Use at least 8 characters, including a letter and a number. Longer passwords are recommended.')
      return
    }
    setPending(true);setError(null)
    try {const {error}=await supabase.auth.updateUser({password})
      if(error) throw error
      await supabase.auth.signOut({scope:'local'})
      navigate('/auth/signin', {replace:true})
    }catch(e){setError(normalizeError(e))}finally{setPending(false)}
  }
  return <Panel title="Set a new password" intro="Choose a strong, unique password for your clinic account.">
    <ErrorMessage error={error}/>{checking ? <p role="status">Checking recovery link…</p> : !user && !recovery ?
      <p className="alert alert-error">Recovery link has expired or has not been verified. <Link to="/auth/forgot">Request a new link</Link>.</p> :
      <form className="form-stack" onSubmit={e=>void submit(e)}><label>New password <small>(8+ characters, with letters and numbers; 12+ recommended)</small><input type="password" minLength={8} maxLength={1024} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,1024}" title="At least 8 characters including a letter and a number" required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="button button-primary" disabled={pending}>Update password</button></form>}
  </Panel>
}

export function CallbackPage() {
  const { user, checking, error } = useAuth()
  if (checking) return <Panel title="Confirming account" intro="Verifying your secure email link…"><p role="status">Connecting to Supabase Auth.</p></Panel>
  return <Panel title="Email confirmation" intro="Secure sign-in confirmation from Supabase.">
    {user ? <><SuccessMessage message="Your account is verified."/><Link className="button button-primary" to="/app/overview">Continue to your overview</Link></>
    : <><ErrorMessage error={error ?? 'We could not verify this link. It may have expired.'}/><Link to="/auth/verify">Try confirmation code or resend</Link></>}
  </Panel>
}