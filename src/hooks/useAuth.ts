import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours
const LAST_ACTIVITY_KEY = 'last-activity'

function updateLastActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
}

function isSessionExpired(): boolean {
  const last = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (!last) return false
  return Date.now() - parseInt(last, 10) > SESSION_TIMEOUT_MS
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Session timeout: sign out after 24h of inactivity
  useEffect(() => {
    if (!user) return

    // Check if session is already expired on mount (e.g. app reopened after long pause)
    if (isSessionExpired()) {
      supabase.auth.signOut()
      return
    }

    // Track user activity
    updateLastActivity()
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach(e => window.addEventListener(e, updateLastActivity, { passive: true }))

    // Check timeout every 5 minutes
    const interval = setInterval(() => {
      if (isSessionExpired()) {
        supabase.auth.signOut()
      }
    }, 5 * 60 * 1000)

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, updateLastActivity))
      clearInterval(interval)
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) updateLastActivity()
    return { error }
  }

  const signUp = async (email: string, password: string, nombre: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    })
    return { error }
  }

  const signOut = async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    await supabase.auth.signOut()
    // Force full page reload to clear all in-memory store state
    // and guarantee the user lands on the login screen
    window.location.replace(window.location.origin)
  }

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://myincontrol.vercel.app',
    })
    return { error }
  }

  return { user, loading, signIn, signUp, signOut, resetPassword, resendConfirmation }
}
