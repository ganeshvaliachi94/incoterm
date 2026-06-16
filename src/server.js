const path = require('path')
const { Provider } = require('ltijs')

const LTI_KEY    = process.env.LTI_KEY        || 'INCOTERM_LTI_SECRET_KEY_CHANGE_ME'
const DB_URL     = process.env.DATABASE_URL    || 'mongodb://localhost:27017/lti-incoterm'
const PORT       = parseInt(process.env.PORT)  || 3000
const CLIENT_ID  = process.env.LTI_CLIENT_ID  || ''
const ISS        = process.env.LTI_ISS         || ''
const AUTH_URL   = process.env.LTI_AUTH_URL    || ''
const ACCESSTKN  = process.env.LTI_ACCESSTKN   || ''
const KEYSET_URL = process.env.LTI_KEYSET_URL  || ''

Provider.setup(
  LTI_KEY,
  { url: DB_URL },
  {
    appRoute: '/lti',
    loginRoute: '/login',
    keysetRoute: '/keys',
    staticPath: path.join(__dirname, '../public'),
    cookies: { secure: true, sameSite: 'None' },
    devMode: process.env.NODE_ENV !== 'production'
  }
)

// Health check — must respond BEFORE ltijs takes over
Provider.app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Incoterms LTI Tool', version: '1.0.0' })
})

// Root route — serves the simulation directly (also accessible without LTI)
Provider.app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// LTI launch route
Provider.onConnect(async (token, req, res) => {
  const studentName  = token.userInfo?.name  || 'Student'
  const studentEmail = token.userInfo?.email || ''
  const courseId     = token.platformContext?.context?.id || ''
  const resourceId   = token.platformContext?.resource?.id || ''

  const injection = `<script>
    window.__LTI_USER__ = {
      name: ${JSON.stringify(studentName)},
      email: ${JSON.stringify(studentEmail)},
      courseId: ${JSON.stringify(courseId)},
      resourceId: ${JSON.stringify(resourceId)},
      ltijs: true
    };
  </script>`

  let html = require('fs').readFileSync(
    path.join(__dirname, '../public/index.html'), 'utf8'
  )
  html = html.replace('</head>', injection + '</head>')
  return res.send(html)
})

// Grade submission
Provider.app.post('/submit-grade', async (req, res) => {
  try {
    const { score, maxScore, studentName } = req.body
    const idtoken = res.locals.token
    if (!idtoken) return res.status(401).json({ error: 'No LTI token.' })
    const grade = {
      userId: idtoken.user,
      scoreGiven: parseFloat(score),
      scoreMaximum: parseFloat(maxScore) || 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString()
    }
    await Provider.Grade.scorePublish(idtoken, grade)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

async function registerPlatform () {
  if (!ISS || !CLIENT_ID) {
    console.warn('⚠️  LTI_ISS or LTI_CLIENT_ID not set — skipping platform registration.')
    return
  }
  try {
    await Provider.registerPlatform({
      url: ISS,
      name: 'HBI LMS',
      clientId: CLIENT_ID,
      authenticationEndpoint: AUTH_URL,
      accesstokenEndpoint: ACCESSTKN,
      authConfig: { method: 'JWK_SET', key: KEYSET_URL }
    })
    console.log('✅ HBI platform registered.')
  } catch (e) {
    console.error('Platform registration error:', e.message)
  }
}

Provider.deploy({ port: PORT, silent: false }).then(async () => {
  console.log(`🚀 Incoterms LTI Tool running on port ${PORT}`)
  await registerPlatform()
})
