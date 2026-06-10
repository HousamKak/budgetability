import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { paperTheme, paperStyles } from '@/styles'

export function EmailVerificationWaiting() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Email arrives via router state (keeps PII out of the URL); fall back to
  // the legacy ?email= query param so old links still work.
  const email =
    (location.state as { email?: string } | null)?.email ||
    searchParams.get('email') ||
    'your email'

  const handleReturnHome = () => {
    navigate('/', { replace: true })
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${paperTheme.colors.background.whiteTransparent}`}>
      <div className="relative w-full max-w-xl">
        <div className={`${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-8 shadow-xl overflow-hidden`}>
          <div className={`${paperTheme.effects.paperTexture} absolute inset-0 opacity-15 pointer-events-none ${paperTheme.radius.lg}`}></div>
          <div className={`${paperTheme.effects.tornEdge} absolute -top-1 left-6 right-6 h-3`}></div>

          <div className="relative z-10 space-y-6 text-center">
            {/* Mail icon */}
            <div className="flex justify-center">
              <div className={`${paperTheme.colors.background.sticker} ${paperTheme.radius.lg} p-4`}>
                <svg className={`w-8 h-8 ${paperTheme.colors.text.primary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
            </div>

            <h1 className={`text-3xl font-bold ${paperTheme.colors.text.accent} ${paperTheme.fonts.handwriting}`}>
              Check Your Email! 📧
            </h1>

            <div className="space-y-4">
              <p className={`text-base sm:text-lg ${paperTheme.colors.text.secondary}`}>
                We've sent a verification email to <strong>{email}</strong>
              </p>

              <p className={`text-sm ${paperTheme.colors.text.muted}`}>
                Click the link in the email to verify your account and complete your registration.
                The link will redirect you back to the app automatically.
              </p>

              <div className={`${paperTheme.colors.background.sticker} ${paperTheme.radius.md} p-4 mt-4`}>
                <p className={`text-sm ${paperTheme.colors.text.secondary}`}>
                  <strong>💡 Tip:</strong> Check your spam folder if you don't see the email within a few minutes.
                </p>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <Button
                type="button"
                onClick={handleReturnHome}
                className={`${paperStyles.primaryButton} px-6 py-2 text-base`}
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationWaiting