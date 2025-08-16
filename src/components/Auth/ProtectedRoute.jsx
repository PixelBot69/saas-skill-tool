import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState(null)
 

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setChecking(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (checking) return null
  return session ? children : <Navigate to="/login" replace />
}