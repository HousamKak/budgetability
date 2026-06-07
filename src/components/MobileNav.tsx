import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Wallet, PiggyBank, BarChart3, TrendingUp, Table2 } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/analytics', label: 'Stats', icon: BarChart3 },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp },
  { to: '/spreadsheet', label: 'Sheet', icon: Table2 },
] as const

/**
 * Mobile bottom tab bar. Shown only below `lg` (where the floating left sidebar
 * is hidden) so the web app feels like the native app on phones.
 */
export function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-sm border-t-2 border-amber-300 shadow-lg safe-area-inset-bottom">
      <div className="flex">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
                active ? 'text-amber-700' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
