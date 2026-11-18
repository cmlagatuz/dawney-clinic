import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppLayout } from '../../src/components/Layout'
import { AuthProvider, useAuth } from '../../src/hooks/AuthProvider'
import { OPS_UI_ENABLED } from '../../src/ops/flag'
import { OpsPage } from '../../src/pages/staff/OpsPage'
import '../../src/styles.css'

function FixtureOperations() {
  const { checking, user } = useAuth()
  if (checking) return <p role="status">Verifying your secure session…</p>
  return user ? <OpsPage /> : <p role="alert">Fixture account required</p>
}

if (OPS_UI_ENABLED) throw Error('The staff feature flag must stay off in the browser fixture.')
const root = document.getElementById('root')
if (!root) throw Error('Missing fixture root')
createRoot(root).render(<StrictMode><BrowserRouter><AuthProvider><Routes>
  <Route element={<AppLayout />}>
    <Route path="/app/ops" element={<FixtureOperations />} />
  </Route>
</Routes></AuthProvider></BrowserRouter></StrictMode>)
