import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PaperBudget from './components/PaperBudget'
import Analytics from './components/Analytics'
import SavingsGoals from './components/SavingsGoals'
import AccountsPage from './components/AccountsPage'
import SpreadsheetPage from './components/spreadsheet/SpreadsheetPage'
import { NavigationPanel } from './components/NavigationPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { EmailConfirmation } from './components/EmailConfirmation'
import { EmailVerificationWaiting } from './components/EmailVerificationWaiting'

// Get the base path from Vite config
const basename = ''

function App() {
  return (
    <AuthProvider>
      <Router basename={basename}>
        <div className="relative">
          <NavigationPanel />
          <ProfilePanel />
          <Routes>
            <Route path="/" element={<PaperBudget />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/savings" element={<SavingsGoals />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/spreadsheet" element={<SpreadsheetPage />} />
            <Route path="/auth/confirm" element={<EmailConfirmation />} />
            <Route path="/auth/verify-email" element={<EmailVerificationWaiting />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App