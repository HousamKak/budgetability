import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { paperTheme, paperStyles, dialogStyles } from '@/styles'

type ResetStatus = 'checking' | 'ready' | 'success' | 'no-session'

export function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<ResetStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setStatus('no-session')
      return
    }

    let cancelled = false

    // detectSessionInUrl exchanges the recovery token automatically on page
    // load. Listen for PASSWORD_RECOVERY (and SIGNED_IN) as the signal that
    // recovery mode is active, and also check for an existing session in case
    // the event fired before we subscribed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setStatus((prev) => (prev === 'checking' || prev === 'no-session' ? 'ready' : prev))
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        setStatus((prev) => (prev === 'checking' ? 'ready' : prev))
      } else {
        // Give detectSessionInUrl a moment to finish the token exchange
        // before declaring the link expired.
        setTimeout(() => {
          if (!cancelled) {
            setStatus((prev) => (prev === 'checking' ? 'no-session' : prev))
          }
        }, 2500)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!supabase) {
      setError('Supabase is not available')
      return
    }

    setIsSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        setStatus('success')
        setTimeout(() => navigate('/', { replace: true }), 2000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

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
            {/* Key icon */}
            <div className="flex justify-center">
              <div className={`${paperTheme.colors.background.sticker} ${paperTheme.radius.lg} p-4`}>
                <svg className={`w-8 h-8 ${paperTheme.colors.text.primary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
            </div>

            <h1 className={`text-3xl font-bold ${paperTheme.colors.text.accent} ${paperTheme.fonts.handwriting}`}>
              Set a New Password 🔑
            </h1>

            {status === 'checking' && (
              <p className={`text-base sm:text-lg ${paperTheme.colors.text.secondary}`}>
                Checking your reset link... ✨
              </p>
            )}

            {status === 'no-session' && (
              <div className="space-y-4">
                <p className={`text-base sm:text-lg ${paperTheme.colors.text.secondary}`}>
                  This password reset link is invalid or has expired.
                </p>
                <p className={`text-sm ${paperTheme.colors.text.muted}`}>
                  Please request a new reset link from the sign-in screen ("Forgot Password?").
                </p>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    onClick={handleReturnHome}
                    className={`${paperStyles.primaryButton} px-6 py-2 text-base`}
                  >
                    Return to Home
                  </Button>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <p className={`text-base sm:text-lg ${paperTheme.colors.text.secondary}`}>
                  Your password has been updated! 🎉
                </p>
                <p className={`text-sm ${paperTheme.colors.text.muted}`}>
                  Taking you back to your budget...
                </p>
              </div>
            )}

            {status === 'ready' && (
              <form onSubmit={handleSubmit} className={`${dialogStyles.form.container} text-left`}>
                <div className={dialogStyles.form.fieldContainer}>
                  <Label htmlFor="new-password" className={dialogStyles.form.label}>
                    New Password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSaving}
                    autoComplete="new-password"
                    className={`h-11 sm:h-10 ${dialogStyles.form.input}`}
                    placeholder="Enter your new password"
                  />
                </div>

                <div className={dialogStyles.form.fieldContainer}>
                  <Label htmlFor="confirm-new-password" className={dialogStyles.form.label}>
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSaving}
                    autoComplete="new-password"
                    className={`h-11 sm:h-10 ${dialogStyles.form.input}`}
                    placeholder="Type it once more"
                  />
                </div>

                {error && <div className={dialogStyles.messages.error}>{error}</div>}

                <Button
                  type="submit"
                  disabled={isSaving}
                  className={`${paperStyles.primaryButton} w-full h-11 sm:h-10 text-base`}
                >
                  {isSaving ? '🔄 Saving...' : '💾 Save New Password'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
