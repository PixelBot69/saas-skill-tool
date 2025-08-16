import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        }
      }
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Registration successful! Please check your email for verification, then login to continue.')
      navigate('/login')
    }
    setLoading(false)
  }


  const handleGoogleLogin = async () => {
  try {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  } catch (err) {
    setError(err.message)
    setLoading(false)
  }
}

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Register</h2>
       <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          background: '#fff',
          color: '#333',
          border: '1px solid #ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '12px'
        }}
      >
        {/* Google "G" icon */}
        <svg width="18" height="18" viewBox="0 0 533.5 544.3" aria-hidden>
          <path d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.3H272v95.2h146.9c-6.3 34-25 62.8-53.3 82.1v68h86.2c50.5-46.5 81.7-115.1 81.7-194.9z" />
          <path d="M272 544.3c72.8 0 134-24.1 178.6-65.5l-86.2-68c-24 16.1-54.8 25.7-92.4 25.7-71 0-131.2-47.9-152.7-112.3H30.9v70.7c44.4 88 135.9 149.4 241.1 149.4z" />
          <path d="M119.3 324.2c-10.5-31.4-10.5-65.4 0-96.8V156.7H30.9c-43.2 86.3-43.2 187.2 0 273.5l88.4-106z" />
          <path d="M272 107.7c39.6-.6 77.5 14.9 106.3 43.2l79.4-79.4C405.8 24.9 344.9 0 272 0 167 0 75.5 61.4 31 149.5l88.4 70.7C140.9 155.8 201 107.7 272 107.7z" />
        </svg>
        Continue with Google
      </button>


      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '15px' }}>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none' }}
        >
          {loading ? 'Loading...' : 'Register'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  )
}