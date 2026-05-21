const { Pool } = require('pg')

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
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
