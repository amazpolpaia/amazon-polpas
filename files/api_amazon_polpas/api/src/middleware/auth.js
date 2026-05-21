const jwt = require('jsonwebtoken')

// Verifica se o token JWT é válido
function autenticar(req, res, next) {
  const header = req.headers['authorization']
  if (!header) return res.status(401).json({ erro: 'Token não fornecido.' })

  const token = header.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Formato inválido. Use: Bearer <token>' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload   // { id, nome, email, perfil }
    next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' })
  }
}

// Restringe acesso por perfil
// Uso: autorizar('gerente', 'comprador')
function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({
        erro: `Acesso negado. Perfil '${req.usuario.perfil}' não tem permissão para esta ação.`
      })
    }
    next()
  }
}

module.exports = { autenticar, autorizar }
