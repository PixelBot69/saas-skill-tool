import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SkillDashboard() {
  const { slug } = useParams()
  const [skill, setSkill] = useState(null)

  useEffect(() => {
    const fetchSkill = async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('slug', slug)
        .single()

      if (data) setSkill(data)
    }

    fetchSkill()
  }, [slug])

  if (!skill) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <h1>{skill.name}</h1>
      <p>{skill.description}</p>
      <p><strong>Price:</strong> {skill.price}</p>
    </div>
  )
}
