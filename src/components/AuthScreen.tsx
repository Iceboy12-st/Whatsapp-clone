import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { MessageCircle, Lock, Mail, User, Eye, EyeOff } from 'lucide-react'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setError('Please enter your name')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }
    }

    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName.trim())

    if (result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-wa-teal-dark via-wa-teal to-wa-green-dark p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-wa-green/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-wa-green-light/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="px-8 pt-10 pb-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-wa-green rounded-full flex items-center justify-center mb-4 shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-wa-text">WhatsApp Clone</h1>
            <p className="text-wa-text-secondary text-sm mt-1">
              {mode === 'signin' ? 'Welcome back! Please sign in.' : 'Create an account to start chatting.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
                  Display Name
                </label>
                <div className="mt-1 relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
                Email
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
                Password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-wa-green hover:bg-wa-green-dark text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="text-sm text-wa-teal hover:text-wa-green-dark transition-colors font-medium"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400">
            Secure messaging powered by end-to-end encryption
          </p>
        </div>
      </div>
    </div>
  )
}
