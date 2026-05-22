const { Pool } = require('pg')

function createPool() {
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL
    const precisaSsl =
      process.env.PGSSL === 'true' ||
      process.env.NODE_ENV === 'production' ||
      /railway|rlwy|amazonaws|neon|supabase/i.test(url)

    return new Pool({
      connectionString: url,
      ssl: precisaSsl ? { rejectUnauthorized: false } : false,
    })
  }

  return new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
}

const pool = createPool()

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do banco:', err)
})

module.exports = pool
