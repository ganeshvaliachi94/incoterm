const path = require('path')
const { Provider } = require('ltijs')

// ─── Environment Variables ────────────────────────────────────────────────────
const LTI_KEY    = process.env.LTI_KEY    || 'INCOTERM_LTI_SECRET_KEY_CHANGE_ME'
const DB_URL     = process.env.DATABASE_URL || 'mongodb://localhost:27017/lti-incoterm'
const PORT       = process.env.PORT        || 3000
const CLIENT_ID  = process.env.LTI_CLIENT_ID  || ''   // filled by HBI/LMS admin
const ISS        = process.env.LTI_ISS         || ''   // LMS Issuer URL from HBI
const AUTH_URL   = process.env.LTI_AUTH_URL    || ''   // LMS OIDC Auth endpoint
const ACCESSTKN  = process.env.LTI_ACCESSTKN   || ''   // LMS Access Token URL
const KEYSET_URL = process.env.LTI_KEYSET_URL  || ''   // LMS Public Keyset URL

// ─── Setup ltijs Provider ─────────────────────────────────────────────────────
Provider.setup(
  LTI_KEY,
  { url: DB_URL },
  {
    appRoute: '/',
    loginRoute: '/login',
    keysetRoute: '/keys',
    staticPath: path.join(__dirname, '../public'),
    cookies: { secure: true, sameSite: 'None' },
    devMode: process.env.NODE_ENV !== 'production'
  }
)

// ─── Main Launch Route ────────────────────────────────────────────────────────
// Called after successful LTI launch from HBI's LMS
Provider.onConnect(async (token, req, res) => {
  // Attach student context to the session so the simulation can read it
  const studentName  = token.userInfo?.name  || 'Student'
  const studentEmail = token.userInfo?.email || ''
  const courseId     = token.platformContext?.context?.id || ''
  const resourceId   = token.platformContext?.resource?.id || ''

  // Inject student info into the simulation page
  // The HTML reads window.__LTI_USER__ on load if present
  const injection = `
    <script>
      window.__LTI_USER__ = {
        name:  ${JSON.stringify(studentName)},
        email: ${JSON.stringify(studentEmail)},
        courseId: ${JSON.stringify(courseId)},
        resourceId: ${JSON.stringify(resourceId)},
        ltijs: true
      };
    </script>
  `

  let html = require('fs').readFileSync(
    path.join(__dirname, '../public/index.html'), 'utf8'
  )
  // Inject before </head>
  html = html.replace('</head>', injection + '</head>')

  return res.send(html)
})

// ─── Grade Submission Route ───────────────────────────────────────────────────
// The simulation POSTs here when a student finishes
Provider.app.post('/submit-grade', async (req, res) => {
  try {
    const { score, maxScore, studentName } = req.body
    const idtoken = res.locals.token

    if (!idtoken) {
      return res.status(401).json({ error: 'No LTI token found. Launch via LMS.' })
    }

    // Build the grade object for the LMS gradebook
    const grade = {
      userId: idtoken.user,
      scoreGiven: parseFloat(score),
      scoreMaximum: parseFloat(maxScore) || 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString()
    }

    // Send grade back to HBI's LMS via AGS (Assignment & Grade Services)
    await Provider.Grade.scorePublish(idtoken, grade)

    console.log(`✅ Grade submitted: ${studentName} → ${score}/${maxScore}`)
    return res.json({ success: true, message: 'Grade submitted to LMS.' })

  } catch (err) {
    console.error('Grade submission error:', err)
    return res.status(500).json({ error: 'Failed to submit grade.', detail: err.message })
  }
})

// ─── Health Check ─────────────────────────────────────────────────────────────
Provider.app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Incoterms LTI Tool', version: '1.0.0' })
})

// ─── Register Platform (HBI's LMS) ───────────────────────────────────────────
// This runs once on startup to register HBI as a trusted platform
async function registerPlatform () {
  if (!ISS || !CLIENT_ID) {
    console.warn('⚠️  LTI_ISS or LTI_CLIENT_ID not set — skipping platform registration.')
    console.warn('   Set these env vars with values provided by HBI LMS admin.')
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
    console.log('✅ HBI platform registered successfully.')
  } catch (e) {
    console.error('Platform registration error:', e.message)
  }
}

// ─── Deploy ───────────────────────────────────────────────────────────────────
Provider.deploy({ port: PORT }).then(async () => {
  console.log(`🚀 Incoterms LTI Tool running on port ${PORT}`)
  await registerPlatform()
})
