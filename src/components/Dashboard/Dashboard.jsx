import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [formData, setFormData] = useState(null)
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {
    getUserData()
    fetchSkills()
  }, [])

  const getUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

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

  const fetchSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')

    if (data) {
      setSkills(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSkillClick = (slug) => {
    navigate(`/dashboard/skill/${slug}`)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px' }}>
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
          <div style={{ marginBottom: '10px' }}><strong>Full Name:</strong> {formData.name}</div>
          <div style={{ marginBottom: '10px' }}><strong>Phone:</strong> {formData.phone || 'Not provided'}</div>
          <div style={{ marginBottom: '10px' }}><strong>Address:</strong> {formData.address || 'Not provided'}</div>
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

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Choose a Skill</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {skills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => handleSkillClick(skill.slug)}
              style={{
                width: '220px',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '6px',
                padding: '12px',
                backgroundColor: '#fafafa'
              }}
            >
              {skill.image_url && (
                <img
                  src={skill.image_url}
                  alt={skill.name}
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                />
              )}
              <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0' }}>{skill.name}</h3>
              <p style={{ fontSize: '13px', color: '#555' }}>{skill.description}</p>
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>{skill.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
