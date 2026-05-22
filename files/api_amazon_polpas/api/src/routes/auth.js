const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool')
const { autenticar, autorizarGerenciaUsuarios, podeGerenciarUsuarios } = require('../middleware/auth')

function payloadToken(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ocultar_valores: !!usuario.ocultar_valores,
    pode_gerenciar_usuarios: podeGerenciarUsuarios(usuario),
  }
}

function respostaUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    ocultar_valores: !!usuario.ocultar_valores,
    pode_gerenciar_usuarios: podeGerenciarUsuarios(usuario),
    ultimo_acesso: usuario.ultimo_acesso,
  }
}

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body

  if (!email || !senha)
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.senha_hash, u.ativo,
              COALESCE(u.ocultar_valores, FALSE) AS ocultar_valores,
              COALESCE(u.pode_gerenciar_usuarios, FALSE) AS pode_gerenciar_usuarios,
              p.nome AS perfil
       FROM usuarios u
       JOIN perfis p ON p.id = u.perfil_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    )

    const usuario = rows[0]
    if (!usuario)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })

    if (!usuario.ativo)
      return res.status(403).json({ erro: 'Usuário inativo. Fale com o administrador.' })

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash)
    if (!senhaCorreta)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })

    await pool.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [usuario.id])

    const token = jwt.sign(payloadToken(usuario), process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    })

    res.json({ token, usuario: respostaUsuario(usuario) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno ao fazer login.' })
  }
})

router.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario })
})

// GET /auth/perfis
router.get('/perfis', autenticar, autorizarGerenciaUsuarios, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome, descricao FROM perfis ORDER BY nome'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao listar perfis.' })
  }
})

// GET /auth/usuarios
router.get('/usuarios', autenticar, autorizarGerenciaUsuarios, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.ativo, u.ultimo_acesso,
              COALESCE(u.ocultar_valores, FALSE) AS ocultar_valores,
              COALESCE(u.pode_gerenciar_usuarios, FALSE) AS pode_gerenciar_usuarios,
              p.id AS perfil_id, p.nome AS perfil
       FROM usuarios u
       JOIN perfis p ON p.id = u.perfil_id
       ORDER BY u.nome`
    )
    res.json(
      rows.map((u) => ({
        ...u,
        pode_gerenciar_usuarios: podeGerenciarUsuarios(u),
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao listar usuários.' })
  }
})

// POST /auth/usuarios
router.post('/usuarios', autenticar, autorizarGerenciaUsuarios, async (req, res) => {
  const {
    nome,
    email,
    senha,
    perfil_id,
    ocultar_valores = false,
    pode_gerenciar_usuarios = false,
  } = req.body

  if (!nome || !email || !senha || !perfil_id)
    return res.status(400).json({ erro: 'Nome, e-mail, senha e perfil são obrigatórios.' })

  try {
    const hash = await bcrypt.hash(senha, 10)
    const { rows } = await pool.query(
      `INSERT INTO usuarios
         (nome, email, senha_hash, perfil_id, ocultar_valores, pode_gerenciar_usuarios)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, ativo,
                 COALESCE(ocultar_valores, FALSE) AS ocultar_valores,
                 COALESCE(pode_gerenciar_usuarios, FALSE) AS pode_gerenciar_usuarios`,
      [
        nome,
        email.toLowerCase(),
        hash,
        perfil_id,
        !!ocultar_valores,
        !!pode_gerenciar_usuarios,
      ]
    )

    const { rows: perfilRows } = await pool.query(
      'SELECT nome FROM perfis WHERE id = $1',
      [perfil_id]
    )

    const u = { ...rows[0], perfil: perfilRows[0]?.nome }
    res.status(201).json(respostaUsuario(u))
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'E-mail já cadastrado.' })
    console.error(err)
    res.status(500).json({ erro: 'Erro ao criar usuário.' })
  }
})

// PUT /auth/usuarios/:id
router.put('/usuarios/:id', autenticar, autorizarGerenciaUsuarios, async (req, res) => {
  const { id } = req.params
  const {
    nome,
    email,
    senha,
    perfil_id,
    ativo,
    ocultar_valores,
    pode_gerenciar_usuarios,
  } = req.body

  if (!nome || !email || !perfil_id)
    return res.status(400).json({ erro: 'Nome, e-mail e perfil são obrigatórios.' })

  try {
    let query = `UPDATE usuarios SET
      nome = $1,
      email = $2,
      perfil_id = $3,
      ativo = COALESCE($4, ativo),
      ocultar_valores = COALESCE($5, ocultar_valores),
      pode_gerenciar_usuarios = COALESCE($6, pode_gerenciar_usuarios),
      atualizado_em = NOW()`
    const params = [
      nome,
      email.toLowerCase(),
      perfil_id,
      ativo,
      ocultar_valores,
      pode_gerenciar_usuarios,
    ]

    if (senha) {
      const hash = await bcrypt.hash(senha, 10)
      query += `, senha_hash = $${params.length + 1}`
      params.push(hash)
    }

    query += ` WHERE id = $${params.length + 1} RETURNING id`
    params.push(id)

    const { rows } = await pool.query(query, params)
    if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' })

    const { rows: full } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.ativo, u.ultimo_acesso,
              COALESCE(u.ocultar_valores, FALSE) AS ocultar_valores,
              COALESCE(u.pode_gerenciar_usuarios, FALSE) AS pode_gerenciar_usuarios,
              p.nome AS perfil
       FROM usuarios u
       JOIN perfis p ON p.id = u.perfil_id
       WHERE u.id = $1`,
      [id]
    )

    res.json(respostaUsuario(full[0]))
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'E-mail já cadastrado.' })
    console.error(err)
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' })
  }
})

module.exports = router
