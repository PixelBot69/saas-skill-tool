import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserData()
  }, [])

  const getUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profile)

      // Get user form data
      const { data: forms } = await supabase
        .from('user_forms')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
      
      if (forms && forms.length > 0) {
        setFormData(forms[0])
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Dashboard</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>
          Logout
        </button>
      </div>

      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f8f9fa' }}>
        <h3>Welcome, {profile?.username || user?.email}!</h3>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Member since:</strong> {new Date(user?.created_at).toLocaleDateString()}</p>
      </div>

      {formData && (
        <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#fff' }}>
          <h3>Your Information</h3>
          <div style={{ marginBottom: '10px' }}>
            <strong>Full Name:</strong> {formData.name}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Phone:</strong> {formData.phone || 'Not provided'}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Address:</strong> {formData.address || 'Not provided'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '15px' }}>
            <strong>Submitted:</strong> {new Date(formData.created_at).toLocaleDateString()}
          </div>
        </div>
      )}

      {!formData && (
        <div style={{ padding: '20px', border: '1px solid #ffc107', borderRadius: '5px', backgroundColor: '#fff3cd' }}>
          <p>No additional information found. Please contact support if you need to update your details.</p>
        </div>
      )}
    </div>
  )
}