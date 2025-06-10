'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [isLogin, setIsLogin] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (token && userData) {
      router.push('/success')
      return
    }
    
    setCheckingAuth(false)
  }, [router])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!isLogin) {
      // Registration logic
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long')
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            firstName, 
            lastName, 
            email, 
            phoneNumber, 
            department, 
            password 
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setSuccess('Account created successfully! Redirecting...')
          localStorage.setItem('token', data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
          setTimeout(() => {
            router.push('/success')
          }, 1500)
        } else {
          setError(data.error || 'Registration failed')
        }
      } catch (err) {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      // Login logic
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()

        if (response.ok) {
          setSuccess('Signed in successfully! Redirecting...')
          localStorage.setItem('token', data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
          setTimeout(() => {
            router.push('/success')
          }, 1500)
        } else {
          setError(data.error || 'Sign in failed')
        }
      } catch (err) {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/80 to-indigo-900/90 z-10"></div>
        <img
          src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
          alt="Professional AI Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="relative z-20 min-h-screen flex">
        {/* Left Side - Content */}
        <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
          <div className="max-w-2xl">
            <div className="mb-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-white/80 text-lg font-medium">AI Assistant</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Win More
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Deals Faster
                </span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-white/80 mb-8 leading-relaxed">
                Leverage AI-powered insights to accelerate your sales process, 
                understand customer needs better, and close deals with confidence.
              </p>
              
              <div className="flex flex-wrap gap-4 mb-12">
                <div className="flex items-center text-white/70">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI-Powered Analytics
                </div>
                <div className="flex items-center text-white/70">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Real-time Insights
                </div>
                <div className="flex items-center text-white/70">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Smart Recommendations
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login/Register Form */}
        <div className="w-full lg:w-[600px] xl:w-[680px] flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="backdrop-blur-lg bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
              
              {/* Toggle Buttons */}
              <div className="flex bg-white/5 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    !isLogin 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Register
                </button>
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    isLogin 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Sign In
                </button>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isLogin ? 'Welcome Back' : 'Join Our Platform'}
                </h2>
                <p className="text-white/70">
                  {isLogin ? 'Sign in to your AI Deal Assistant' : 'Start winning more deals today'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-3 rounded-lg text-sm backdrop-blur-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/20 border border-green-400/50 text-green-100 px-4 py-3 rounded-lg text-sm backdrop-blur-sm">
                    {success}
                  </div>
                )}

                {!isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                        placeholder="First Name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                        placeholder="Last Name"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                    placeholder="Email Address"
                  />
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                        placeholder="Phone Number (Optional)"
                      />
                    </div>

                    <div>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 1rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5rem 1.5rem'
                        }}
                      >
                        <option value="" className="bg-gray-900 text-white">
                          Select Department (Optional)
                        </option>
                        <option value="Sales" className="bg-gray-900 text-white">
                          Sales
                        </option>
                        <option value="Marketing" className="bg-gray-900 text-white">
                          Marketing
                        </option>
                        <option value="Business Development" className="bg-gray-900 text-white">
                          Business Development
                        </option>
                        <option value="Customer Success" className="bg-gray-900 text-white">
                          Customer Success
                        </option>
                        <option value="Operations" className="bg-gray-900 text-white">
                          Operations
                        </option>
                        <option value="Management" className="bg-gray-900 text-white">
                          Management
                        </option>
                        <option value="Other" className="bg-gray-900 text-white">
                          Other
                        </option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                    placeholder="Password"
                  />
                </div>

                {!isLogin && (
                  <div>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-5 py-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-lg"
                      placeholder="Confirm Password"
                    />
                  </div>
                )}

                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 text-blue-400 focus:ring-blue-400/50 border-white/20 rounded bg-white/10"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-white/70">
                        Remember me
                      </label>
                    </div>
                    <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      Forgot password?
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isLogin ? 'Signing in...' : 'Creating Account...'}
                    </div>
                  ) : (
                    isLogin ? 'Sign In' : 'Get Started Now'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}