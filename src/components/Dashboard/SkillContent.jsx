import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const SkillContent = ({ skillId, subskills, userId }) => {
  const [contents, setContents] = useState({})
  const [progress, setProgress] = useState({})
  const [activeContent, setActiveContent] = useState(null)
  const [expandedSubskills, setExpandedSubskills] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('SkillContent useEffect triggered:', { skillId, userId, subskills })
    if (skillId && userId && subskills && subskills.length > 0) {
      fetchContents()
      fetchProgress()
      if (subskills[0] && subskills[0].subskill_id) {
        setExpandedSubskills({ [subskills[0].subskill_id]: true })
      }
    } else {
      setLoading(false)
    }
  }, [skillId, userId, subskills])

  const fetchContents = async () => {
    try {
      // Filter out undefined/null subskill IDs and use the correct property name
      const validSubskills = subskills.filter(s => s && (s.subskill_id || s.id))
      const subskillIds = validSubskills.map(s => s.subskill_id || s.id)
      
      console.log('Valid subskills:', validSubskills)
      console.log('Fetching contents for subskill IDs:', subskillIds)
      
      if (subskillIds.length === 0) {
        console.log('No valid subskill IDs found')
        setLoading(false)
        return
      }
      
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .in('subskill_id', subskillIds)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching contents:', error)
        console.error('Error details:', error.message, error.details, error.hint)
      } else {
        console.log('Fetched contents:', data)
        const groupedContents = {}
        data?.forEach(content => {
          if (!groupedContents[content.subskill_id]) {
            groupedContents[content.subskill_id] = []
          }
          groupedContents[content.subskill_id].push(content)
        })
        setContents(groupedContents)
      }
    } catch (err) {
      console.error('Unexpected error fetching contents:', err)
    }
    setLoading(false)
  }

  const fetchProgress = async () => {
    try {
      console.log('Fetching progress for user:', userId)
      
      const { data, error } = await supabase
        .from('user_progress')
        .select('content_id, progress')
        .eq('user_id', userId)

      if (error) {
        console.error('Error fetching progress:', error)
        console.error('Progress error details:', error.message, error.details, error.hint)
      } else {
        console.log('Fetched progress data:', data)
        const progressMap = {}
        data?.forEach(item => {
          progressMap[item.content_id] = item.progress
        })
        console.log('Progress map:', progressMap)
        setProgress(progressMap)
      }
    } catch (err) {
      console.error('Unexpected error fetching progress:', err)
    }
  }

  const toggleSubskill = (subskillId) => {
    setExpandedSubskills(prev => ({
      ...prev,
      [subskillId]: !prev[subskillId]
    }))
  }

  const updateProgress = async (contentId, newProgress) => {
    try {
      console.log('Updating progress:', { contentId, newProgress, userId })
      
      const { data: existing, error: selectError } = await supabase
        .from('user_progress')
        .select('progress_id, progress')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking existing progress:', selectError)
        return
      }

      let result
      if (existing) {
        console.log('Updating existing progress record:', existing)
        result = await supabase
          .from('user_progress')
          .update({
            progress: newProgress,
            updated_at: new Date().toISOString()
          })
          .eq('progress_id', existing.progress_id)
          .select()

        if (result.error) {
          console.error('Error updating progress:', result.error)
        } else {
          console.log('Progress updated successfully:', result.data)
        }
      } else {
        console.log('Creating new progress record')
        result = await supabase
          .from('user_progress')
          .insert({
            user_id: userId,
            content_id: contentId,
            progress: newProgress,
            updated_at: new Date().toISOString()
          })
          .select()

        if (result.error) {
          console.error('Error inserting progress:', result.error)
        } else {
          console.log('Progress inserted successfully:', result.data)
        }
      }

      // Update local state regardless of database operation result
      if (!result.error) {
        setProgress(prev => ({
          ...prev,
          [contentId]: newProgress
        }))
        console.log('Local progress state updated:', { contentId, newProgress })
      }
    } catch (err) {
      console.error('Unexpected error updating progress:', err)
    }
  }

  const toggleComplete = (contentId) => {
    const currentProgress = progress[contentId] || 0
    const newProgress = currentProgress === 100 ? 0 : 100
    console.log('Toggling complete:', { contentId, currentProgress, newProgress })
    updateProgress(contentId, newProgress)
  }

  const openContent = (content) => {
    console.log('Opening content:', content)
    setActiveContent(content)
    const contentId = content.content_id || content.id
    console.log('Content ID:', contentId, 'Current progress:', progress[contentId])
    
    // Only update progress if it's not already set
    if (!progress[contentId] || progress[contentId] === 0) {
      console.log('Setting initial progress to 25')
      updateProgress(contentId, 25)
    }
  }

  const getProgressIcon = (contentId) => {
    const prog = progress[contentId] || 0
    console.log('Getting progress icon for:', contentId, 'Progress:', prog)
    if (prog === 0) return '⚪'
    if (prog === 100) return '✅'
    return '⏳'
  }

  const getProgressColor = (contentId) => {
    const prog = progress[contentId] || 0
    if (prog === 0) return '#dee2e6'
    if (prog === 100) return '#28a745'
    return '#ffc107'
  }

  const getProgressPercentage = (contentId) => {
    return progress[contentId] || 0
  }

  const getCompletionStats = () => {
    let totalContents = 0
    let completedContents = 0
    Object.values(contents).forEach(subskillContents => {
      subskillContents.forEach(content => {
        totalContents++
        const contentId = content.content_id || content.id
        if (progress[contentId] === 100) {
          completedContents++
        }
      })
    })
    return { completed: completedContents, total: totalContents }
  }

  const getSubskillProgress = (subskillId) => {
    const subskillContents = contents[subskillId] || []
    if (subskillContents.length === 0) return 0
    const completed = subskillContents.filter(content => {
      const contentId = content.content_id || content.id
      return progress[contentId] === 100
    }).length
    return Math.round((completed / subskillContents.length) * 100)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading content...</div>
  }

  // Check if subskills data is valid
  if (!subskills || subskills.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: '#6c757d' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
        <h3>No subskills found</h3>
        <p>Please make sure subskills are properly loaded.</p>
      </div>
    )
  }

  const noContent = Object.values(contents).flat().length === 0
  if (noContent) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: '#6c757d' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📭</div>
        <h3>No content found</h3>
        <p>Content will be added soon. Please check back later.</p>
      </div>
    )
  }

  const stats = getCompletionStats()

  return (
    <div style={{ display: 'flex', gap: '20px', minHeight: '600px' }}>
      {/* Sidebar */}
      <div style={{
        width: '400px',
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxHeight: '800px',
        overflowY: 'auto'
      }}>
        {/* Overall Progress */}
        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
            Overall Progress: {stats.completed}/{stats.total}
          </div>
          <div style={{
            background: '#e9ecef',
            borderRadius: '10px',
            height: '8px',
            marginTop: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#28a745',
              height: '100%',
              width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
              borderRadius: '10px',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>

        {/* Subskills */}
        <div>
          {subskills.map(subskill => {
            const subskillId = subskill.subskill_id || subskill.id
            if (!subskillId) return null // Skip invalid subskills
            
            const subskillContents = contents[subskillId] || []
            const subskillProgressPercent = getSubskillProgress(subskillId)

            return (
              <div key={subskillId} style={{ marginBottom: '15px' }}>
                {/* Header */}
                <div
                  onClick={() => toggleSubskill(subskillId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '15px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid #dee2e6',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1
                  }}>
                    {subskill.image_url ? (
                      <img 
                        src={subskill.image_url} 
                        alt={subskill.name}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '6px',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '6px',
                        background: '#007bff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {subskill.name ? subskill.name.charAt(0) : '?'}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '2px' }}>
                        {subskill.name || 'Unknown Subskill'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {subskillContents.length} content{subskillContents.length !== 1 ? 's' : ''} • {subskillProgressPercent}% complete
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    {expandedSubskills[subskillId] ? '▼' : '▶'}
                  </span>
                </div>

                {/* Contents or empty message */}
                {expandedSubskills[subskillId] && (
                  <div style={{ marginLeft: '15px', marginTop: '8px' }}>
                    {subskillContents.length === 0 ? (
                      <div style={{
                        padding: '12px',
                        fontSize: '0.9rem',
                        color: '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        📭 No content yet — coming soon!
                      </div>
                    ) : (
                      subskillContents.map(content => {
                        const contentId = content.content_id || content.id
                        const progressPercent = getProgressPercentage(contentId)
                        return (
                          <div
                            key={contentId}
                            onClick={() => openContent(content)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 15px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              marginBottom: '4px',
                              background: activeContent?.content_id === contentId || activeContent?.id === contentId ? '#e3f2fd' : 'transparent',
                              border: activeContent?.content_id === contentId || activeContent?.id === contentId ? '2px solid #007bff' : '1px solid transparent'
                            }}
                          >
                            <span 
                              style={{ marginRight: '12px', fontSize: '1.2rem' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleComplete(contentId)
                              }}
                            >
                              {getProgressIcon(contentId)}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', color: '#333' }}>
                                {content.title}
                              </div>
                              {content.description && (
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                  {content.description.length > 60 
                                    ? content.description.substring(0, 60) + '...'
                                    : content.description}
                                </div>
                              )}
                              {/* Progress percentage display */}
                              <div style={{ fontSize: '0.75rem', color: '#007bff', fontWeight: 'bold', marginTop: '2px' }}>
                                {progressPercent}% complete
                              </div>
                            </div>
                            <div style={{
                              width: '4px',
                              height: '30px',
                              background: getProgressColor(contentId),
                              borderRadius: '2px',
                              marginLeft: '8px'
                            }}></div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        background: '#fff',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {activeContent ? (
          <div>
            {/* Content Header with Progress */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '1px solid #eee'
            }}>
              <h2 style={{ margin: 0 }}>{activeContent.title}</h2>
              <div style={{
                background: '#f8f9fa',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#007bff'
              }}>
                {getProgressPercentage(activeContent.content_id || activeContent.id)}% Complete
              </div>
            </div>
            
            {activeContent.description && (
              <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '25px' }}>
                {activeContent.description}
              </p>
            )}
            
            {activeContent.content_url ? (
              activeContent.content_url.includes('youtube.com') || activeContent.content_url.includes('youtu.be') ? (
                <iframe
                  src={activeContent.content_url.replace('watch?v=', 'embed/')}
                  style={{
                    width: '100%',
                    height: '400px',
                    borderRadius: '8px',
                    border: 'none'
                  }}
                  allowFullScreen
                ></iframe>
              ) : (
                <a
                  href={activeContent.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    background: '#007bff',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 'bold'
                  }}
                >
                  Open Resource →
                </a>
              )
            ) : (
              <div style={{
                textAlign: 'center',
                color: '#6c757d',
                padding: '60px 20px'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📝</div>
                <p>Content resource will be added soon...</p>
              </div>
            )}

            {/* Progress Actions */}
            <div style={{
              marginTop: '30px',
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Mark your progress:</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => updateProgress(activeContent.content_id || activeContent.id, 50)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#ffc107',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  50% Done
                </button>
                <button
                  onClick={() => updateProgress(activeContent.content_id || activeContent.id, 75)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#17a2b8',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  75% Done
                </button>
                <button
                  onClick={() => toggleComplete(activeContent.content_id || activeContent.id)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: progress[activeContent.content_id || activeContent.id] === 100 ? '#dc3545' : '#28a745',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {progress[activeContent.content_id || activeContent.id] === 100 ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            padding: '100px 20px'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📚</div>
            <h3>Select a content to start learning</h3>
            <p>Choose any content from the sidebar to begin your learning journey.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillContent