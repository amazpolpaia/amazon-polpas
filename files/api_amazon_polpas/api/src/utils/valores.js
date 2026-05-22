const CAMPOS_VALOR = new Set([
  'preco_por_lata',
  'total_estimado',
  'total_pago',
  'custo_por_litro',
  'custo_medio_litro',
  'media_custo_litro',
  'total_valor_pago',
  'valor_total',
  'valor',
])

const MASCARA = '***'

function mascararValor(_v) {
  return MASCARA
}

function mascararDados(data) {
  if (data == null) return data
  if (Array.isArray(data)) return data.map(mascararDados)
  if (typeof data !== 'object') return data

  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (CAMPOS_VALOR.has(k) && v != null && v !== '') {
      out[k] = MASCARA
    } else if (v && typeof v === 'object') {
      out[k] = mascararDados(v)
    } else {
      out[k] = v
    }
  }
  return out
}

function respostaComValores(req, res, data) {
  const body = req.usuario?.ocultar_valores ? mascararDados(data) : data
  res.json(body)
}

module.exports = { mascararDados, respostaComValores, MASCARA }
