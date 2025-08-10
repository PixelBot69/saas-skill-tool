import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SkillContent from './SkillContent'

const SkillDashboard = () => {
  const { slug } = useParams()
  const [skill, setSkill] = useState(null)
  const [subskills, setSubskills] = useState([])
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (slug && user) {
      fetchSkillData()
    }
  }, [slug, user])

  const fetchSkillData = async () => {
    // Fetch skill data by slug
    const { data: skillData, error: skillError } = await supabase
      .from('skills')
      .select('*')
      .eq('slug', slug)
      .single()

    if (skillError) {
      console.error('Error fetching skill:', skillError)
      setLoading(false)
      return
    }

    setSkill(skillData)

    // Fetch subskills for this skill
    const { data: subskillsData, error: subskillsError } = await supabase
      .from('subskills')
      .select('*')
      .eq('skill_id', skillData.skill_id)
      .order('created_at', { ascending: true })

    if (subskillsError) {
      console.error('Error fetching subskills:', subskillsError)
    } else {
      setSubskills(subskillsData || [])
    }

    // Check enrollment after skill is fetched
    checkEnrollment(skillData.skill_id)
    setLoading(false)
  }

  const checkEnrollment = async (currentSkillId) => {
    if (!user || !currentSkillId) return

    const { data, error } = await supabase
      .from('user_skills')
      .select('id')
      .eq('user_id', user.id)
      .eq('skill_id', currentSkillId)
      .limit(1)

    if (error) {
      console.error('Error checking enrollment:', error)
      return
    }

    setIsEnrolled(data && data.length > 0)
  }

  const handleEnroll = async () => {
    if (!user || !skill) return

    setEnrolling(true)

    const { error } = await supabase
      .from('user_skills')
      .insert({
        user_id: user.id,
        skill_id: skill.skill_id
      })

    if (error) {
      console.error('Error enrolling:', error)
      alert('Failed to enroll. Please try again.')
    } else {
      setIsEnrolled(true)
      alert('Successfully enrolled!')
    }

    setEnrolling(false)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div>Loading skill...</div>
      </div>
    )
  }

  if (!skill) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '50px',
        color: '#666'
      }}>
        Skill not found
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Skill Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '30px',
        color: 'white'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {skill.image_url && (
            <img
              src={skill.image_url}
              alt={skill.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                objectFit: 'cover',
                border: '3px solid rgba(255,255,255,0.2)'
              }}
            />
          )}
          <div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '2.5rem', fontWeight: 'bold' }}>
              {skill.name}
            </h1>
            <p style={{ margin: '0', fontSize: '1.1rem', opacity: '0.9' }}>
              {skill.description}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {skill.price && (
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' }}>
                ${skill.price}
              </div>
            )}
            <div style={{ fontSize: '0.9rem', opacity: '0.8' }}>
              {subskills.length} subskill{subskills.length !== 1 ? 's' : ''} available
            </div>
          </div>

          {!isEnrolled ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                background: enrolling ? '#ccc' : '#ff6b6b',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: enrolling ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
              }}
            >
              {enrolling ? 'Enrolling...' : 'Enroll Now'}
            </button>
          ) : (
            <div style={{
              background: '#4caf50',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓</span> Enrolled
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isEnrolled ? (
        <SkillContent
          skillId={skill.skill_id}
          subskills={subskills}
          userId={user?.id}
        />
      ) : (
        <div>
          {/* Preview of Subskills */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px'
          }}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '20px' }}>
              What you'll learn:
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '15px'
            }}>
              {subskills.slice(0, 6).map(subskill => (
                <div key={subskill.id} style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  {subskill.image_url ? (
                    <img
                      src={subskill.image_url}
                      alt={subskill.name}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '8px',
                      background: '#007bff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.2rem'
                    }}>
                      {subskill.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>
                      {subskill.name}
                    </h4>
                    <p style={{
                      margin: 0,
                      color: '#666',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {subskill.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {subskills.length > 6 && (
              <p style={{
                textAlign: 'center',
                marginTop: '20px',
                color: '#666',
                fontStyle: 'italic'
              }}>
                And {subskills.length - 6} more subskills...
              </p>
            )}
          </div>

          {/* Enrollment CTA */}
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#fff',
            borderRadius: '12px',
            border: '2px dashed #ddd'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '20px',
              opacity: '0.5'
            }}>
              🔒
            </div>
            <h3 style={{
              color: '#666',
              marginBottom: '10px'
            }}>
              Enroll to Access All Content
            </h3>
            <p style={{
              color: '#888',
              fontSize: '1.1rem',
              marginBottom: '20px'
            }}>
              Get access to all {subskills.length} subskills and track your learning progress.
            </p>
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {enrolling ? 'Enrolling...' : 'Enroll Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SkillDashboard
