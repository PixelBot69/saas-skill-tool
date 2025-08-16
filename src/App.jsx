import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout/Layout'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import AuthCallback from './components/Auth/AuthCallback'
import Dashboard from './components/Dashboard/Dashboard'
import UserForm from './components/Form/UserForm'
import SkillDashboard from './components/Dashboard/SkillDashboard'
import ProtectedRoute from './components/Auth/ProtectedRoute'
function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasFilledForm, setHasFilledForm] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkIfFormFilled(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkIfFormFilled(session.user.id)
      } else {
        setHasFilledForm(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkIfFormFilled = async (userId) => {
    const { data } = await supabase
      .from('user_forms')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
    
    setHasFilledForm(data && data.length > 0)
    setLoading(false)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route 
            path="/login" 
            element={session ? <Navigate to={hasFilledForm ? "/dashboard" : "/form"} /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={session ? <Navigate to={hasFilledForm ? "/dashboard" : "/form"} /> : <Register />} 
          />
          <Route 
            path="/dashboard" 
            element={session ? (hasFilledForm ? <Dashboard /> : <Navigate to="/form" />) : <Navigate to="/login" />} 
          />

          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route 
            path="/form" 
            element={session ? (!hasFilledForm ? <UserForm /> : <Navigate to="/dashboard" />) : <Navigate to="/login" />} 
          />
          <Route path="/dashboard/skill/:slug" element={<SkillDashboard />} />
          <Route 
            path="/" 
            element={<Navigate to={session ? (hasFilledForm ? "/dashboard" : "/form") : "/login"} />} 
          />

          <Route
            path="/dashboard"
            element={ <ProtectedRoute>  <Dashboard /> </ProtectedRoute> }
          />

        </Routes>
      </Layout>
    </Router>
  )
}

export default App