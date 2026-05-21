const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const pool    = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')

// POST /auth/login
// Body: { email, senha }
router.post('/login', async (req, res) => {
  const { email, senha } = req.body

  if (!email || !senha)
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.senha_hash, u.ativo, p.nome AS perfil
       FROM usuarios u
       JOIN perfis p ON p.id = u.perfil_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    )

    const usuario = rows[0]
    if (!usuario)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })

    if (!usuario.ativo)
      return res.status(403).json({ erro: 'Usuário inativo. Fale com o gerente.' })

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash)
    if (!senhaCorreta)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })

    // Atualiza último acesso
    await pool.query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
      [usuario.id]
    )

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno ao fazer login.' })
  }
})

// GET /auth/me — retorna dados do usuário logado
router.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario })
})

// GET /auth/usuarios — lista usuários (somente gerente)
router.get('/usuarios', autenticar, autorizar('gerente'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.ativo, u.ultimo_acesso, p.nome AS perfil
       FROM usuarios u JOIN perfis p ON p.id = u.perfil_id
       ORDER BY u.nome`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar usuários.' })
  }
})

// POST /auth/usuarios — cria usuário (somente gerente)
router.post('/usuarios', autenticar, autorizar('gerente'), async (req, res) => {
  const { nome, email, senha, perfil_id } = req.body
  if (!nome || !email || !senha || !perfil_id)
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' })

  try {
    const hash = await bcrypt.hash(senha, 10)
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email`,
      [nome, email.toLowerCase(), hash, perfil_id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'E-mail já cadastrado.' })
    res.status(500).json({ erro: 'Erro ao criar usuário.' })
  }
})

module.exports = router
