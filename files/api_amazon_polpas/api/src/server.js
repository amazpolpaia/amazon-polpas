require('dotenv').config()
const path    = require('path')
const express = require('express')
const cors    = require('cors')

const authRoutes         = require('./routes/auth')
const fornecedoresRoutes = require('./routes/fornecedores')
const lotesRoutes        = require('./routes/lotes')
const comprasRoutes      = require('./routes/compras')
const pesagensRoutes     = require('./routes/pesagens')
const recepcoesRoutes    = require('./routes/recepcoes')
const producaoRoutes     = require('./routes/producao')
const relatoriosRoutes   = require('./routes/relatorios')
const masterRoutes       = require('./routes/master')

const app = express()
const PORT = process.env.PORT || 3000
const publicDir = path.join(__dirname, '../public')

app.use(cors())
app.use(express.json())

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
    next()
  })
}

app.use('/auth',         authRoutes)
app.use('/auth',         masterRoutes)
app.use('/fornecedores', fornecedoresRoutes)
app.use('/lotes',        lotesRoutes)
app.use('/compras',      comprasRoutes)
app.use('/compras',      masterRoutes)
app.use('/pesagens',     pesagensRoutes)
app.use('/pesagens',     masterRoutes)
app.use('/recepcoes',    recepcoesRoutes)
app.use('/recepcoes',    masterRoutes)
app.use('/producao',     producaoRoutes)
app.use('/producao',     masterRoutes)
app.use('/relatorios',   relatoriosRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', versao: '1.0.0', sistema: 'Amazon Polpas' })
})

app.use(express.static(publicDir))
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next()
  res.sendFile(path.join(publicDir, 'index.html'))
})

app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ erro: 'Erro interno do servidor.' })
})

app.listen(PORT, () => {
  console.log(`\nAmazon Polpas rodando na porta ${PORT}`)
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Tela + API: http://localhost:${PORT}\n`)
})
