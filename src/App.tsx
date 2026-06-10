import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PaperBudget from './components/PaperBudget'
import SavingsGoals from './components/SavingsGoals'
import AccountsPage from './components/AccountsPage'
import { NavigationPanel } from './components/NavigationPanel'
import { MobileNav } from './components/MobileNav'
import { ProfilePanel } from './components/ProfilePanel'
import { EmailConfirmation } from './components/EmailConfirmation'
import { EmailVerificationWaiting } from './components/EmailVerificationWaiting'
import { ResetPassword } from './components/ResetPassword'

// Heavy, non-default routes are code-split so the main bundle stays small
const Analytics = lazy(() => import('./components/Analytics'))
const SpreadsheetPage = lazy(() => import('./components/spreadsheet/SpreadsheetPage'))
const ForecastPage = lazy(() => import('./components/ForecastPage'))

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="handwriting text-2xl text-stone-500">Loading...</span>
    </div>
  )
}

// Get the base path from Vite config (strips trailing slash for Router)
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '')

function App() {
  return (
    <AuthProvider>
      <Router basename={basename}>
        <div className="relative">
          <NavigationPanel />
          <MobileNav />
          <ProfilePanel />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<PaperBudget />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/savings" element={<SavingsGoals />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/spreadsheet" element={<SpreadsheetPage />} />
              <Route path="/forecast" element={<ForecastPage />} />
              <Route path="/auth/confirm" element={<EmailConfirmation />} />
              <Route path="/auth/verify-email" element={<EmailVerificationWaiting />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App