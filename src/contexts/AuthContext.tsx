import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabase) {
      // onAuthStateChange fires INITIAL_SESSION with the current session on
      // subscribe (supabase-js v2), so a separate getSession() call is not
      // needed and would race this listener on setLoading(false).
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          // Clear cached financial data so the previous user's budgets and
          // expenses don't bleed into the next account on a shared browser.
          // Mirrors STORAGE_KEY in src/lib/data-service.ts.
          localStorage.removeItem('paper-budget-cartoon-v2')
        }
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } else {
      // No Supabase available, set loading to false
      setLoading(false)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not available') }
    }

    setLoading(true)
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    return result
  }

  const signUp = async (email: string, password: string) => {
  if (!supabase) {
    return { error: new Error('Supabase not available') }
  }

  const emailRedirectTo =
    typeof window !== 'undefined'
      ? (() => {
          const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
          const confirmationPath = `${basePath}/auth/confirm`
          return `${window.location.origin}${confirmationPath}`
        })()
      : undefined

  setLoading(true)
  
  const signUpParams: {
    email: string
    password: string
    options?: { emailRedirectTo: string }
  } = {
    email,
    password,
  }

  if (emailRedirectTo) {
    signUpParams.options = { emailRedirectTo }
  }

  const result = await supabase.auth.signUp(signUpParams)
  setLoading(false)
  return result
}
  const signOut = async () => {
    if (!supabase) return

    setLoading(true)
    await supabase.auth.signOut()
    setLoading(false)
  }

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not available') }
    }

    // Send the user back to our reset page so they can actually set a new
    // password. Includes the Vite base path (same pattern as signUp above).
    const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${basePath}/auth/reset-password`,
    })
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}