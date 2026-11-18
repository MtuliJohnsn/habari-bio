
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './App.css'

function getUsernameFromPath() {
  const path = window.location.pathname
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()

  const reservedPaths = [
    '',
    'index.html',
    'login',
    'signup',
    'dashboard',
    'auth',
  ]

  if (reservedPaths.includes(path) || path.includes('/')) {
    return ''
  }

  if (!/^[a-z0-9_]{3,30}$/.test(path)) {
    return ''
  }

  return path
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(value)

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }

    return null
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('home')
  const [mode, setMode] = useState('signup')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [profile, setProfile] = useState({
    username: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    background_color: '#f5f0ff',
    button_color: '#8054e8',
  })

  const [links, setLinks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')

  // Public profile state
  const [publicUsername] = useState(getUsernameFromPath)
  const [publicProfile, setPublicProfile] = useState(null)
  const [publicLinks, setPublicLinks] = useState([])
  const [publicLoading, setPublicLoading] = useState(
    () => Boolean(getUsernameFromPath())
  )
  const [publicNotFound, setPublicNotFound] = useState(false)

  // Check the user's login session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load the dashboard when a user is logged in
  useEffect(() => {
    if (user && !publicUsername) {
      loadDashboard()
    } else if (!user) {
      setProfile({
        username: '',
        display_name: '',
        bio: '',
        avatar_url: '',
        background_color: '#f5f0ff',
        button_color: '#8054e8',
      })

      setLinks([])
    }
  }, [user, publicUsername])

  // Load a public profile when someone visits /username
  useEffect(() => {
    if (publicUsername) {
      loadPublicProfile(publicUsername)
    }
  }, [publicUsername])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      if (profileData) {
        setProfile({
          username: profileData.username || '',
          display_name: profileData.display_name || '',
          bio: profileData.bio || '',
          avatar_url: profileData.avatar_url || '',
          background_color: profileData.background_color || '#f5f0ff',
          button_color: profileData.button_color || '#8054e8',
        })
      }

      const { data: linkData, error: linkError } = await supabase
        .from('profile_links')
        .select('*')
        .eq('profile_id', user.id)
        .order('position', { ascending: true })

      if (linkError) throw linkError

      setLinks(linkData || [])
    } catch (err) {
      setError(err.message || 'Could not load your profile.')
    } finally {
      setLoading(false)
    }
  }

  async function loadPublicProfile(username) {
    setPublicLoading(true)
    setPublicNotFound(false)
    setPublicProfile(null)
    setPublicLinks([])
    setError('')

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (profileError) throw profileError

      if (!profileData) {
        setPublicNotFound(true)
        return
      }

      const { data: linkData, error: linkError } = await supabase
        .from('profile_links')
        .select('*')
        .eq('profile_id', profileData.id)
        .eq('is_active', true)
        .order('position', { ascending: true })

      if (linkError) throw linkError

      setPublicProfile(profileData)
      setPublicLinks(linkData || [])
    } catch (err) {
      setPublicNotFound(true)
      setError(err.message || 'Could not load this profile.')
    } finally {
      setPublicLoading(false)
    }
  }

  function openAuth(selectedMode = 'signup') {
    setMode(selectedMode)
    setMessage('')
    setError('')
    setPassword('')
    setView('auth')
  }

  async function handleAuth(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage('Your account has been created successfully!')
        } else {
          setMessage(
            'Account created! Please check your email to confirm your account.'
          )
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        setMessage('You are now logged in!')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordReset() {
    if (!email) {
      setError('Enter your email address first.')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })

      if (error) throw error

      setMessage('Password reset instructions have been sent to your email.')
    } catch (err) {
      setError(err.message || 'Unable to send password reset email.')
    } finally {
      setLoading(false)
    }
  }

  function updateProfile(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addLink(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const title = newTitle.trim()
    const url = newUrl.trim()

    if (!title || !url) {
      setError('Please enter both a link title and URL.')
      return
    }

    const safeUrl = safeHttpUrl(
      /^https?:\/\//i.test(url) ? url : `https://${url}`
    )

    if (!safeUrl) {
      setError('Please enter a valid website URL.')
      return
    }

    setLinks((current) => [
      ...current,
      {
        id: null,
        title,
        url: safeUrl,
        icon: '🔗',
        position: current.length,
        is_active: true,
      },
    ])

    setNewTitle('')
    setNewUrl('')
    setMessage('Link added. Remember to save your profile.')
  }

  function updateLink(index, field, value) {
    setLinks((current) =>
      current.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    )
  }

  async function removeLink(index) {
    const link = links[index]

    if (link.id) {
      const { error } = await supabase
        .from('profile_links')
        .delete()
        .eq('id', link.id)
        .eq('profile_id', user.id)

      if (error) {
        setError(error.message)
        return
      }
    }

    setLinks((current) => current.filter((_, i) => i !== index))
    setMessage('Link removed.')
    setError('')
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const username = profile.username.trim().toLowerCase()

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setError(
        'Username must be 3–30 characters and use only letters, numbers or underscores.'
      )
      setSaving(false)
      return
    }

    try {
      const profileData = {
        id: user.id,
        username,
        display_name: profile.display_name.trim(),
        bio: profile.bio.trim(),
        avatar_url: profile.avatar_url.trim(),
        background_color: profile.background_color,
        button_color: profile.button_color,
        updated_at: new Date().toISOString(),
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) throw profileError

      const savedLinks = []

      for (let index = 0; index < links.length; index++) {
        const link = links[index]
        const safeUrl = safeHttpUrl(link.url)

        if (!safeUrl) {
          throw new Error(`Please check the URL for "${link.title}".`)
        }

        const linkData = {
          profile_id: user.id,
          title: link.title.trim(),
          url: safeUrl,
          icon: link.icon || '🔗',
          position: index,
          is_active: link.is_active !== false,
        }

        if (link.id) {
          const { data, error: updateError } = await supabase
            .from('profile_links')
            .update(linkData)
            .eq('id', link.id)
            .eq('profile_id', user.id)
            .select()
            .single()

          if (updateError) throw updateError
          savedLinks.push(data)
        } else {
          const { data, error: insertError } = await supabase
            .from('profile_links')
            .insert(linkData)
            .select()
            .single()

          if (insertError) throw insertError
          savedLinks.push(data)
        }
      }

      setLinks(savedLinks)
      setProfile((current) => ({ ...current, username }))

      setMessage(
        `Your profile has been saved! Your public address is bio.habari.uk/${username}`
      )
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setView('home')
    setMessage('')
    setError('')
  }

  return (
    <div className="website">
      <nav className="navbar">
        <a
          href="/"
          className="logo"
          onClick={(event) => {
            event.preventDefault()
            window.location.href = '/'
          }}
        >
          HABARI<span>BIO</span>
        </a>

        {user ? (
          <div className="nav-links">
            <span>My Profile</span>
            <button className="nav-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        ) : (
          <>
            <div className="nav-links">
              {!publicUsername && (
                <>
                  <a href="#features">Features</a>
                  <a href="#examples">Examples</a>
                  <a href="#pricing">Pricing</a>
                </>
              )}
            </div>

            {!publicUsername && (
              <button
                className="nav-button"
                onClick={() => openAuth('signup')}
              >
                Get started
              </button>
            )}
          </>
        )}
      </nav>

      {/* PUBLIC PROFILE PAGE */}
      {publicUsername ? (
        <main
          style={{
            minHeight: '80vh',
            backgroundColor: publicProfile?.background_color || '#f5f0ff',
            padding: '55px 20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {publicLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <h2>Loading profile...</h2>
            </div>
          ) : publicNotFound || !publicProfile ? (
            <div
              style={{
                textAlign: 'center',
                maxWidth: '420px',
                margin: '60px auto',
              }}
            >
              <h1>Profile not found</h1>
              <p>
                We couldn't find a HABARI BIO page with the username
                @{publicUsername}.
              </p>
              {error && <p className="auth-error">{error}</p>}
              <a href="/" className="primary-button">
                Back to HABARI BIO
              </a>
            </div>
          ) : (
            <section
              style={{
                width: '100%',
                maxWidth: '460px',
                textAlign: 'center',
                padding: '35px 25px',
                borderRadius: '24px',
                backgroundColor: 'rgba(255,255,255,0.65)',
                boxShadow: '0 15px 45px rgba(40,20,80,0.08)',
                alignSelf: 'flex-start',
              }}
            >
              {publicProfile.avatar_url &&
              safeHttpUrl(publicProfile.avatar_url) ? (
                <img
                  src={safeHttpUrl(publicProfile.avatar_url)}
                  alt={publicProfile.display_name || publicUsername}
                  style={{
                    width: '110px',
                    height: '110px',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    margin: '0 auto 18px',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    backgroundColor: publicProfile.button_color || '#8054e8',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '42px',
                    fontWeight: '700',
                    margin: '0 auto 18px',
                  }}
                >
                  {(publicProfile.display_name || publicUsername)
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <h1 style={{ marginBottom: '6px' }}>
                {publicProfile.display_name || publicUsername}
              </h1>

              <p style={{ opacity: 0.65, marginTop: 0 }}>
                @{publicProfile.username}
              </p>

              {publicProfile.bio && (
                <p
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    margin: '20px 0 25px',
                  }}
                >
                  {publicProfile.bio}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '25px',
                }}
              >
                {publicLinks
                  .filter((link) => safeHttpUrl(link.url))
                  .map((link) => (
                    <a
                      key={link.id}
                      href={safeHttpUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '15px 20px',
                        borderRadius: '12px',
                        color: '#fff',
                        backgroundColor:
                          publicProfile.button_color || '#8054e8',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      {link.icon && link.icon !== '🔗'
                        ? `${link.icon} `
                        : ''}
                      {link.title}
                    </a>
                  ))}
              </div>

              <div
                style={{
                  marginTop: '35px',
                  fontSize: '13px',
                  opacity: 0.65,
                }}
              >
                Made with HABARI BIO
              </div>
            </section>
          )}
        </main>
      ) : view === 'auth' && !user ? (
        <main className="auth-section">
          <div className="auth-card">
            <span className="eyebrow">WELCOME TO HABARI BIO</span>

            <h1>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>

            <p className="auth-description">
              {mode === 'signup'
                ? 'Start building your own beautiful page.'
                : 'Log in to manage your HABARI Bio account.'}
            </p>

            <form onSubmit={handleAuth}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={6}
                required
              />

              <button
                className="primary-button auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'signup'
                    ? 'Create free account'
                    : 'Log in'}
              </button>
            </form>

            {mode === 'login' && (
              <button
                className="text-button"
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
              >
                Forgot your password?
              </button>
            )}

            {message && <p className="auth-message">{message}</p>}
            {error && <p className="auth-error">{error}</p>}

            <div className="auth-switch">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button onClick={() => openAuth('login')}>Log in</button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button onClick={() => openAuth('signup')}>Sign up</button>
                </>
              )}
            </div>

            <button className="back-button" onClick={() => setView('home')}>
              ← Back to homepage
            </button>
          </div>
        </main>
      ) : user ? (
        <main className="editor-section">
          <div className="editor-heading">
            <span className="eyebrow">YOUR CREATOR DASHBOARD</span>
            <h1>Build your HABARI Bio page</h1>
            <p>Bring your online world together in one beautiful profile.</p>
          </div>

          {loading ? (
            <div className="editor-card">
              <p>Loading your profile...</p>
            </div>
          ) : (
            <div className="editor-layout">
              <section className="editor-card">
                <h2>Profile information</h2>
                <p className="editor-description">
                  Tell visitors who you are.
                </p>

                <form onSubmit={saveProfile}>
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    value={profile.username}
                    onChange={(event) =>
                      updateProfile('username', event.target.value)
                    }
                    placeholder="yourname"
                    maxLength={30}
                    required
                  />

                  <p className="field-hint">
                    Your profile address will be bio.habari.uk/yourname.
                    Use 3–30 letters, numbers or underscores.
                  </p>

                  <label htmlFor="displayName">Display name</label>
                  <input
                    id="displayName"
                    value={profile.display_name}
                    onChange={(event) =>
                      updateProfile('display_name', event.target.value)
                    }
                    placeholder="Your name"
                  />

                  <label htmlFor="bio">Short biography</label>
                  <textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(event) =>
                      updateProfile('bio', event.target.value)
                    }
                    placeholder="Tell people a little about yourself..."
                    rows={4}
                    maxLength={300}
                  />

                  <label htmlFor="avatarUrl">Profile image URL</label>
                  <input
                    id="avatarUrl"
                    type="url"
                    value={profile.avatar_url}
                    onChange={(event) =>
                      updateProfile('avatar_url', event.target.value)
                    }
                    placeholder="https://example.com/photo.jpg"
                  />

                  <div className="color-fields">
                    <div>
                      <label htmlFor="backgroundColor">Page background</label>
                      <input
                        id="backgroundColor"
                        type="color"
                        value={profile.background_color}
                        onChange={(event) =>
                          updateProfile('background_color', event.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor="buttonColor">Button color</label>
                      <input
                        id="buttonColor"
                        type="color"
                        value={profile.button_color}
                        onChange={(event) =>
                          updateProfile('button_color', event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <h2 className="links-heading">Your links</h2>

                  <p className="editor-description">
                    Add social media, websites and anything you want to share.
                  </p>

                  {links.map((link, index) => (
                    <div
                      className="link-editor"
                      key={link.id || `new-${index}`}
                    >
                      <label>Link title</label>
                      <input
                        value={link.title}
                        onChange={(event) =>
                          updateLink(index, 'title', event.target.value)
                        }
                        placeholder="Instagram"
                        required
                      />

                      <label>Link URL</label>
                      <input
                        value={link.url}
                        onChange={(event) =>
                          updateLink(index, 'url', event.target.value)
                        }
                        placeholder="https://instagram.com/yourname"
                        required
                      />

                      <button
                        type="button"
                        className="remove-link"
                        onClick={() => removeLink(index)}
                      >
                        Remove link
                      </button>
                    </div>
                  ))}

                  <div className="add-link-box">
                    <h3>Add a new link</h3>

                    <label htmlFor="newTitle">Button title</label>
                    <input
                      id="newTitle"
                      value={newTitle}
                      onChange={(event) => setNewTitle(event.target.value)}
                      placeholder="My Instagram"
                    />

                    <label htmlFor="newUrl">Website address</label>
                    <input
                      id="newUrl"
                      value={newUrl}
                      onChange={(event) => setNewUrl(event.target.value)}
                      placeholder="https://instagram.com/yourname"
                    />

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={addLink}
                    >
                      + Add link
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="primary-button save-button"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save my profile'}
                  </button>
                </form>

                {message && <p className="auth-message">{message}</p>}
                {error && <p className="auth-error">{error}</p>}
              </section>

              <aside className="preview-column">
                <h2>Live preview</h2>

                <div
                  className="live-profile"
                  style={{ backgroundColor: profile.background_color }}
                >
                  {profile.avatar_url &&
                  safeHttpUrl(profile.avatar_url) ? (
                    <img
                      className="live-avatar"
                      src={safeHttpUrl(profile.avatar_url)}
                      alt="Profile"
                    />
                  ) : (
                    <div className="live-avatar-placeholder">
                      {(profile.display_name || 'H')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <h3>{profile.display_name || 'Your name'}</h3>

                  <p className="live-username">
                    {profile.username ? `@${profile.username}` : '@yourname'}
                  </p>

                  <p className="live-bio">
                    {profile.bio || 'Your biography will appear here.'}
                  </p>

                  {links.map((link, index) => (
                    <a
                      key={link.id || `preview-${index}`}
                      href={safeHttpUrl(link.url) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="live-link"
                      style={{ backgroundColor: profile.button_color }}
                    >
                      {link.title || 'Your link'}
                    </a>
                  ))}

                  <div className="live-powered">Made with HABARI BIO</div>
                </div>

                <p className="preview-note">
                  This is a preview. Save your profile to store your changes.
                  Your public profile address will be bio.habari.uk/yourname.
                </p>
              </aside>
            </div>
          )}
        </main>
      ) : (
        <main>
          <section className="hero">
            <div className="hero-content">
              <span className="eyebrow">
                YOUR DIGITAL IDENTITY, SIMPLIFIED
              </span>

              <h1>
                Everything about you.<br />
                <span>One simple link.</span>
              </h1>

              <p>
                Bring all your social media, websites, projects and favorite
                links together in one beautiful page.
              </p>

              <button
                className="primary-button"
                onClick={() => openAuth('signup')}
              >
                Create your free page →
              </button>

              <div className="hero-note">
                Free to start · No coding required
              </div>
            </div>

            <div className="preview-area">
              <div className="profile-card">
                <div className="profile-cover"></div>
                <div className="avatar">J</div>
                <h2>John Smith</h2>
                <p className="username">@johnsmith</p>

                <p className="bio">
                  Creator, entrepreneur and storyteller. Sharing ideas and
                  inspiration.
                </p>

                <a href="#features" className="profile-link">
                  📸 Instagram
                </a>
                <a href="#features" className="profile-link">
                  ▶ YouTube
                </a>
                <a href="#features" className="profile-link">
                  𝕏 Follow me on X
                </a>
                <a href="#features" className="profile-link">
                  🌐 My Website
                </a>

                <div className="powered">Made with HABARI BIO</div>
              </div>
            </div>
          </section>

          <section id="features" className="features">
            <span className="eyebrow">ONE PAGE. MANY POSSIBILITIES.</span>
            <h2>Your online world in one place.</h2>

            <div className="feature-grid">
              <article>
                <span>🔗</span>
                <h3>All your links</h3>
                <p>
                  Share your social media, websites and important links.
                </p>
              </article>

              <article>
                <span>🎨</span>
                <h3>Your own style</h3>
                <p>
                  Build a profile that reflects your personality and brand.
                </p>
              </article>

              <article>
                <span>📊</span>
                <h3>Understand your audience</h3>
                <p>
                  Discover how people interact with your page.
                </p>
              </article>
            </div>
          </section>

          <section id="examples" className="bottom-section">
            <h2>One link. Endless possibilities.</h2>
            <p>Make it easy for people to discover everything you do.</p>
          </section>

          <section id="pricing" className="bottom-section pricing">
            <h2>Start free. Grow with HABARI.</h2>
            <p>Create your personal page without a monthly commitment.</p>

            <button
              className="primary-button"
              onClick={() => openAuth('signup')}
            >
              Get started for free
            </button>
          </section>
        </main>
      )}

      <footer>© 2026 HABARI BIO. All rights reserved.</footer>
    </div>
  )
}

export default App
