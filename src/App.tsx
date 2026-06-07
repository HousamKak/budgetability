import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PaperBudget from './components/PaperBudget'
import Analytics from './components/Analytics'
import SavingsGoals from './components/SavingsGoals'
import AccountsPage from './components/AccountsPage'
import SpreadsheetPage from './components/spreadsheet/SpreadsheetPage'
import ForecastPage from './components/ForecastPage'
import { NavigationPanel } from './components/NavigationPanel'
import { MobileNav } from './components/MobileNav'
import { ProfilePanel } from './components/ProfilePanel'
import { EmailConfirmation } from './components/EmailConfirmation'
import { EmailVerificationWaiting } from './components/EmailVerificationWaiting'

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
          <Routes>
            <Route path="/" element={<PaperBudget />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/savings" element={<SavingsGoals />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/spreadsheet" element={<SpreadsheetPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/auth/confirm" element={<EmailConfirmation />} />
            <Route path="/auth/verify-email" element={<EmailVerificationWaiting />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App