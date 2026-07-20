import { upsertActiveUser } from '../server/auth/authService.mjs'

function readArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) {
    return ''
  }

  return process.argv[index + 1] ?? ''
}

const email = readArg('--email')
const password = readArg('--password')
const displayName = readArg('--name')
const role = readArg('--role') || 'admin'

if (!email || !password) {
  console.error(
    'Usage: node scripts/bootstrap-auth-user.mjs --email user@example.com --password secret --name "Display Name" --role admin',
  )
  process.exit(1)
}

try {
  const user = upsertActiveUser({
    email,
    password,
    displayName,
    role,
    acceptedMarketing: true,
  })

  console.log(JSON.stringify({ status: 'ok', user }, null, 2))
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'error',
        error: error.code ?? 'BOOTSTRAP_FAILED',
        details: error.details ?? null,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
