import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PaperBudget from './components/PaperBudget'
import Analytics from './components/Analytics'
import SavingsGoals from './components/SavingsGoals'
import AccountsPage from './components/AccountsPage'
import { NavigationPanel } from './components/NavigationPanel'
import { EmailConfirmation } from './components/EmailConfirmation'
import { EmailVerificationWaiting } from './components/EmailVerificationWaiting'
import { paperTheme } from './styles'

// Get the base path from Vite config
const basename = ''

function App() {
  return (
    <AuthProvider>
      <Router basename={basename}>
        <div className="relative">
          {/* Beta Flag */}
          <div className="fixed top-4 right-4 z-50">
            <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.md} px-3 py-2 ${paperTheme.effects.shadow.md} overflow-hidden transform rotate-12`}>
              {/* Paper texture overlay */}
              <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.md} pointer-events-none`}></div>

              {/* Yellow tape effect */}
              <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-3 ${paperTheme.effects.yellowTape}`}></div>

              {/* Beta text */}
              <div className={`relative z-10 text-xs font-bold ${paperTheme.colors.text.accent} ${paperTheme.fonts.handwriting}`}>
                BETA
              </div>
            </div>
          </div>

          <NavigationPanel />
          <Routes>
            <Route path="/" element={<PaperBudget />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/savings" element={<SavingsGoals />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/auth/confirm" element={<EmailConfirmation />} />
            <Route path="/auth/verify-email" element={<EmailVerificationWaiting />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App