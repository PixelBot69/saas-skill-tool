import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if a session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true })
      }
    })

    // Listen for session changes (happens right after redirect)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/dashboard', { replace: true })
    })

    return () => sub.subscription.unsubscribe()
  }, [navigate])

  return (
    <div style={{ maxWidth: 400, margin: '50px auto', padding: 20 }}>
      <h2>Finishing sign-in…</h2>
    </div>
  )
}
