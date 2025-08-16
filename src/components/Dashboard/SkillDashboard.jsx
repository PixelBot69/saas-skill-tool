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
  const [paymentStatus, setPaymentStatus] = useState('')

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      console.log('Razorpay script loaded successfully')
    }
    script.onerror = () => {
      console.error('Failed to load Razorpay script')
    }
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

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
    try {
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

      // Check enrollment and purchase status
      await checkEnrollmentAndPurchase(skillData.skill_id)
      setLoading(false)
    } catch (error) {
      console.error('Error in fetchSkillData:', error)
      setLoading(false)
    }
  }

  const checkEnrollmentAndPurchase = async (currentSkillId) => {
    if (!user || !currentSkillId) return

    try {
      // Check if user is enrolled
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('user_skills')
        .select('id')
        .eq('user_id', user.id)
        .eq('skill_id', currentSkillId)
        .limit(1)

      if (enrollmentError) {
        console.error('Error checking enrollment:', enrollmentError)
        return
      }

      const enrolled = enrollmentData && enrollmentData.length > 0
      setIsEnrolled(enrolled)

      // If not enrolled and skill is paid, check purchase status
      if (!enrolled && !isFreeSkill()) {
        const { data: purchaseData, error: purchaseError } = await supabase
          .from('purchases')
          .select('status, verified')
          .eq('user_id', user.id)
          .eq('skill_id', currentSkillId)
          .eq('status', 'success')
          .eq('verified', true)
          .limit(1)

        if (!purchaseError && purchaseData && purchaseData.length > 0) {
          // User has a successful purchase but not enrolled - auto enroll
          await autoEnrollAfterPurchase(currentSkillId)
        }
      }
    } catch (error) {
      console.error('Error in checkEnrollmentAndPurchase:', error)
    }
  }

  const autoEnrollAfterPurchase = async (currentSkillId) => {
    try {
      const { error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user.id,
          skill_id: currentSkillId
        })

      if (!error) {
        setIsEnrolled(true)
      }
    } catch (error) {
      console.error('Error in autoEnrollAfterPurchase:', error)
    }
  }

  // Check if skill is free
  const isFreeSkill = () => {
    return !skill?.price || skill.price === 0 || skill.price === 'Free' || skill.price === 'free'
  }

  // Handle free enrollment
  const handleFreeEnroll = async () => {
    if (!user || !skill) return

    setEnrolling(true)
    setPaymentStatus('Processing...')

    try {
      const { error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user.id,
          skill_id: skill.skill_id
        })

      if (error) {
        console.error('Error enrolling:', error)
        setPaymentStatus('Enrollment failed. Please try again.')
        return
      }

      setIsEnrolled(true)
      setPaymentStatus('Successfully enrolled!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setPaymentStatus(''), 3000)
    } catch (error) {
      console.error('Error in handleFreeEnroll:', error)
      setPaymentStatus('Enrollment failed. Please try again.')
    } finally {
      setEnrolling(false)
    }
  }

  // Create purchase record
  const createPurchaseRecord = async (orderData) => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          skill_id: skill.skill_id,
          amount: parseFloat(skill.price),
          currency: 'INR',
          payment_gateway: 'razorpay',
          status: 'pending',
          razorpay_order_id: orderData.id,
          metadata: {
            skill_name: skill.name,
            order_data: orderData
          }
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating purchase record:', error)
        throw new Error('Failed to create purchase record')
      }

      return data
    } catch (error) {
      console.error('Error in createPurchaseRecord:', error)
      throw error
    }
  }

  // Update purchase record after payment
  const updatePurchaseRecord = async (purchaseId, paymentData, status, verified = false) => {
    try {
      const { error } = await supabase
        .from('purchases')
        .update({
          status: status,
          verified: verified,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          payment_reference: paymentData.razorpay_payment_id,
          updated_at: new Date().toISOString(),
          metadata: {
            skill_name: skill.name,
            payment_response: paymentData
          }
        })
        .eq('purchase_id', purchaseId)

      if (error) {
        console.error('Error updating purchase record:', error)
        throw new Error('Failed to update purchase record')
      }
    } catch (error) {
      console.error('Error in updatePurchaseRecord:', error)
      throw error
    }
  }

  // Handle paid enrollment with Razorpay
  const handlePaidEnroll = async () => {
    if (!user || !skill) return

    setEnrolling(true)
    setPaymentStatus('Initializing payment...')

    try {
      // Create order using Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: Math.round(parseFloat(skill.price) * 100), // Convert to paise
          currency: 'INR',
          skill_id: skill.skill_id,
          user_id: user.id,
          skill_name: skill.name
        },
      })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Failed to create order')
      }

      if (!data.success) {
        throw new Error(data.message || 'Failed to create order')
      }

      // Create purchase record
      const purchaseRecord = await createPurchaseRecord(data.order)

      // Check if Razorpay is loaded
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh and try again.')
      }

      setPaymentStatus('Opening payment gateway...')

      // Initialize Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'Your Learning Platform',
        description: `Enrollment for ${skill.name}`,
        order_id: data.order.id,
        handler: async (response) => {
          setPaymentStatus('Verifying payment...')
          
          try {
            // Update purchase record with payment details
            await updatePurchaseRecord(purchaseRecord.purchase_id, response, 'pending', false)

            // Verify payment using Supabase Edge Function
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                skill_id: skill.skill_id,
                user_id: user.id,
                purchase_id: purchaseRecord.purchase_id
              },
            })

            if (verifyError) {
              console.error('Verify payment error:', verifyError)
              await updatePurchaseRecord(purchaseRecord.purchase_id, response, 'failed', false)
              throw new Error(verifyError.message || 'Payment verification failed')
            }

            if (verifyData.success) {
              // Update purchase record as verified
              await updatePurchaseRecord(purchaseRecord.purchase_id, response, 'success', true)
              
              // Enroll user after successful payment
              const { error: enrollError } = await supabase
                .from('user_skills')
                .insert({
                  user_id: user.id,
                  skill_id: skill.skill_id
                })

              if (!enrollError) {
                setIsEnrolled(true)
                setPaymentStatus('Payment successful! You are now enrolled.')
                setTimeout(() => setPaymentStatus(''), 5000)
              } else {
                console.error('Error enrolling after payment:', enrollError)
                setPaymentStatus('Payment successful but enrollment failed. Please contact support.')
              }
            } else {
              await updatePurchaseRecord(purchaseRecord.purchase_id, response, 'failed', false)
              setPaymentStatus('Payment verification failed. Please contact support.')
            }
          } catch (error) {
            console.error('Payment verification error:', error)
            setPaymentStatus(`Payment verification failed: ${error.message}`)
          } finally {
            setEnrolling(false)
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          email: user.email || '',
          contact: user.user_metadata?.phone || '',
        },
        notes: {
          skill_id: skill.skill_id,
          user_id: user.id,
          skill_name: skill.name
        },
        theme: {
          color: '#007bff',
        },
        modal: {
          ondismiss: async () => {
            setEnrolling(false)
            setPaymentStatus('Payment cancelled')
            
            // Update purchase record as cancelled
            if (purchaseRecord?.purchase_id) {
              await updatePurchaseRecord(purchaseRecord.purchase_id, {}, 'cancelled', false)
            }
            
            setTimeout(() => setPaymentStatus(''), 3000)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      
      // Handle payment failure
      rzp.on('payment.failed', async (response) => {
        console.error('Payment failed:', response.error)
        setPaymentStatus(`Payment failed: ${response.error.description}`)
        
        if (purchaseRecord?.purchase_id) {
          await updatePurchaseRecord(purchaseRecord.purchase_id, response, 'failed', false)
        }
        
        setEnrolling(false)
      })

      rzp.open()
    } catch (error) {
      console.error('Error initiating payment:', error)
      setPaymentStatus(`Failed to initiate payment: ${error.message}`)
      setEnrolling(false)
    }
  }

  // Main enrollment handler
  const handleEnroll = () => {
    if (isFreeSkill()) {
      handleFreeEnroll()
    } else {
      handlePaidEnroll()
    }
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
      {/* Payment Status Message */}
      {paymentStatus && (
        <div style={{
          background: paymentStatus.includes('failed') || paymentStatus.includes('cancelled') 
            ? '#ff4757' 
            : paymentStatus.includes('successful') 
              ? '#2ed573' 
              : '#3742fa',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {paymentStatus}
        </div>
      )}

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
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' }}>
              {isFreeSkill() ? (
                <span style={{ color: '#4caf50' }}>FREE</span>
              ) : (
                <span>₹{skill.price}</span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: '0.8' }}>
              {subskills.length} subskill{subskills.length !== 1 ? 's' : ''} available
            </div>
          </div>

          {!isEnrolled ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                background: enrolling ? '#ccc' : (isFreeSkill() ? '#4caf50' : '#ff6b6b'),
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
              {enrolling ? (
                isFreeSkill() ? 'Enrolling...' : 'Processing...'
              ) : (
                isFreeSkill() ? 'Enroll Now' : `Pay ₹${skill.price} & Enroll`
              )}
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
              {isFreeSkill() ? '🆓' : '🔒'}
            </div>
            <h3 style={{
              color: '#666',
              marginBottom: '10px'
            }}>
              {isFreeSkill() ? 'Enroll for Free!' : 'Purchase to Access All Content'}
            </h3>
            <p style={{
              color: '#888',
              fontSize: '1.1rem',
              marginBottom: '20px'
            }}>
              Get access to all {subskills.length} subskills and track your learning progress.
              {!isFreeSkill() && (
                <>
                  <br />
                  <strong>Price: ₹{skill.price}</strong>
                </>
              )}
            </p>
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                background: isFreeSkill() ? '#4caf50' : '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: enrolling ? 'not-allowed' : 'pointer'
              }}
            >
              {enrolling ? (
                isFreeSkill() ? 'Enrolling...' : 'Processing...'
              ) : (
                isFreeSkill() ? 'Enroll Now' : `Pay ₹${skill.price} & Enroll`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SkillDashboard