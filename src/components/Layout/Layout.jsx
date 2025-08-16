import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Layout({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
  }

  return (
    <div>
      
      {session && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px',
            background: '#eee',
          }}
        >
          <h1>My App</h1>
          <button onClick={handleLogout}>Logout</button>
        </header>
      )}

      <main>{children}</main>
    </div>
  )


}