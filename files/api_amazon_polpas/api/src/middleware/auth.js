const jwt = require('jsonwebtoken')

const EMAIL_ADMIN_MASTER = (process.env.ADMIN_MASTER_EMAIL || 'igor.queiroz@amazonpolpas.com.br').toLowerCase()

function autenticar(req, res, next) {
  const header = req.headers['authorization']
  if (!header) return res.status(401).json({ erro: 'Token não fornecido.' })

  const token = header.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Formato inválido. Use: Bearer <token>' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' })
  }
}

function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({
        erro: `Acesso negado. Perfil '${req.usuario.perfil}' não tem permissão para esta ação.`,
      })
    }
    next()
  }
}

function podeGerenciarUsuarios(usuario) {
  if (!usuario) return false
  if ((usuario.email || '').toLowerCase() === EMAIL_ADMIN_MASTER) return true
  return !!usuario.pode_gerenciar_usuarios
}

function podeVerFinanceiro(usuario) {
  if (!usuario) return false
  if ((usuario.email || '').toLowerCase() === EMAIL_ADMIN_MASTER) return true
  return !!usuario.pode_ver_financeiro
}

function autorizarFinanceiro(req, res, next) {
  if (!podeVerFinanceiro(req.usuario)) {
    return res.status(403).json({
      erro: 'Acesso negado. Voce nao tem permissao para o modulo financeiro.',
    })
  }
  next()
}

function autorizarGerenciaUsuarios(req, res, next) {
  if (!podeGerenciarUsuarios(req.usuario)) {
    return res.status(403).json({
      erro: 'Acesso negado. Somente administradores autorizados podem gerenciar usuários.',
    })
  }
  next()
}

module.exports = {
  autenticar,
  autorizar,
  autorizarGerenciaUsuarios,
  podeGerenciarUsuarios,
  autorizarFinanceiro,
  podeVerFinanceiro,
  EMAIL_ADMIN_MASTER,
}
