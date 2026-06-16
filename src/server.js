const path = require('path')
const fs = require('fs')
const express = require('express')
const { Provider } = require('ltijs')

const LTI_KEY    = process.env.LTI_KEY        || 'INCOTERM_LTI_SECRET_KEY_CHANGE_ME'
const DB_URL     = process.env.DATABASE_URL    || 'mongodb://localhost:27017/lti-incoterm'
const PORT       = parseInt(process.env.PORT)  || 3000
const LTI_PORT   = PORT + 1  // ltijs runs on next port internally
const CLIENT_ID  = process.env.LTI_CLIENT_ID  || ''
const ISS        = process.env.LTI_ISS         || ''
const AUTH_URL   = process.env.LTI_AUTH_URL    || ''
const ACCESSTKN  = process.env.LTI_ACCESSTKN   || ''
const KEYSET_URL = process.env.LTI_KEYSET_URL  || ''
const PUBLIC_DIR = path.join(__dirname, '../public')

// ── 1. Public Express server (main PORT — what Railway exposes) ──
const app = express()
app.use(express.json())
app.use(express.static(PUBLIC_DIR))

// Serve simulation to anyone
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Incoterms LTI Tool' })
})

// Proxy LTI routes to internal ltijs server
const { createProxyMiddleware } = require('http-proxy-middleware')
const ltiProxy = createProxyMiddleware({
  target: `http://localhost:${LTI_PORT}`,
  changeOrigin: true
})
app.use('/login', ltiProxy)
app.use('/keys', ltiProxy)
app.use('/lti', ltiProxy)

app.listen(PORT, () => {
  console.log(`🌐 Public server running on port ${PORT}`)
})

// ── 2. ltijs server (internal LTI_PORT) ──────────────────────
Provider.setup(
  LTI_KEY,
  { url: DB_URL },
  {
    appRoute: '/lti',
    loginRoute: '/login',
    keysetRoute: '/keys',
    cookies: { secure: true, sameSite: 'None' },
    devMode: process.env.NODE_ENV !== 'production'
  }
)

Provider.onConnect(async (token, req, res) => {
  const studentName  = token.userInfo?.name  || 'Student'
  const studentEmail = token.userInfo?.email || ''
  const injection = `<script>
    window.__LTI_USER__ = {
      name: ${JSON.stringify(studentName)},
      email: ${JSON.stringify(studentEmail)},
      ltijs: true
    };
  </script>`
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
  html = html.replace('</head>', injection + '</head>')
  return res.send(html)
})

Provider.app.post('/submit-grade', async (req, res) => {
  try {
    const { score, maxScore } = req.body
    const idtoken = res.locals.token
    if (!idtoken) return res.status(401).json({ error: 'No LTI token.' })
    await Provider.Grade.scorePublish(idtoken, {
      userId: idtoken.user,
      scoreGiven: parseFloat(score),
      scoreMaximum: parseFloat(maxScore) || 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString()
    })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

async function registerPlatform () {
  if (!ISS || !CLIENT_ID) return
  try {
    await Provider.registerPlatform({
      url: ISS, name: 'HBI LMS', clientId: CLIENT_ID,
      authenticationEndpoint: AUTH_URL,
      accesstokenEndpoint: ACCESSTKN,
      authConfig: { method: 'JWK_SET', key: KEYSET_URL }
    })
    console.log('✅ HBI platform registered.')
  } catch (e) {
    console.error('Platform registration error:', e.message)
  }
}

Provider.deploy({ port: LTI_PORT, silent: false }).then(async () => {
  console.log(`🔒 LTI server running on port ${LTI_PORT}`)
  await registerPlatform()
})
