const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

// Mesma definição da view vw_lotes_resumo, porém SEM o LIMIT 100 (a view original
// tem um LIMIT que restringe as listas a 100 linhas arbitrárias). Apenas leitura.
const VW_LOTES = `(SELECT l.id AS lote_id, l.codigo, l.data_operacao, l.status, f.nome AS fornecedor, f.municipio, c.qtd_latas_prevista, c.preco_por_lata, c.total_estimado, pc.hora_chegada, pc.peso_bruto_kg, pc.placa_veiculo, r.qtd_latas_recebidas, r.condicao_fruto, ps.hora_saida, ps.peso_saida_kg, COALESCE(ps.peso_liquido_kg, pc.peso_bruto_kg - pc.tara_kg) AS peso_liquido_kg, d.litros_extraidos, d.rendimento_l_lata, d.turno, rd.custo_por_litro, rd.total_pago, c.regiao, c.tipo_frete, c.valor_frete, c.unidade_fabril FROM lotes l JOIN fornecedores f ON f.id = l.fornecedor_id LEFT JOIN compras c ON c.lote_id = l.id LEFT JOIN pesagens_chegada pc ON pc.lote_id = l.id LEFT JOIN recepcoes r ON r.lote_id = l.id LEFT JOIN pesagens_saida ps ON ps.lote_id = l.id LEFT JOIN despolpamentos d ON d.lote_id = l.id LEFT JOIN rendimentos rd ON rd.lote_id = l.id) AS vw`

// Gera código do lote: LOTE-20250520-SL-001
async function gerarCodigo(fornecedor_id, data) {
  const { rows: [f] } = await pool.query(
    'SELECT nome FROM fornecedores WHERE id=$1', [fornecedor_id]
  )
  const sigla = f.nome.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 3)
  const dataStr = data.replace(/-/g, '')
  const { rows: [cnt] } = await pool.query(
    `SELECT COUNT(*) FROM lotes
     WHERE fornecedor_id=$1 AND data_operacao=$2`,
    [fornecedor_id, data]
  )
  const seq = String(Number(cnt.count) + 1).padStart(3, '0')
  return `LOTE-${dataStr}-${sigla}-${seq}`
}

// GET /lotes?data=2025-05-20&fornecedor_id=1&status=aberto
router.get('/', autenticar, async (req, res) => {
  const { data, fornecedor_id, status, pendente } = req.query
  let query = 'SELECT * FROM ' + VW_LOTES + ' WHERE 1=1'
  const params = []

  if (data) { params.push(data); query += ` AND data_operacao = $${params.length}` }
  if (fornecedor_id) { params.push(fornecedor_id); query += ` AND fornecedor_id = $${params.length}` }
  if (status) { params.push(status); query += ` AND status = $${params.length}` }
  if (pendente === 'recepcao') { query += ' AND lote_id NOT IN (SELECT lote_id FROM recepcoes)' }

  query += ' ORDER BY data_operacao DESC, hora_chegada DESC'

  try {
    const { rows } = await pool.query(query, params)
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar lotes.' })
  }
})

// GET /lotes/:id — resumo completo do lote
router.get('/:id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ' + VW_LOTES + ' WHERE lote_id = $1',
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Lote não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar lote.' })
  }
})

// POST /lotes — cria lote (comprador ou gerente)
router.post('/', autenticar, autorizar('gerente', 'comprador'), async (req, res) => {
  const { fornecedor_id, data_operacao, observacoes } = req.body
  if (!fornecedor_id) return res.status(400).json({ erro: 'fornecedor_id é obrigatório.' })

  const data = data_operacao || new Date().toISOString().split('T')[0]

  try {
    const codigo = await gerarCodigo(fornecedor_id, data)
    const { rows } = await pool.query(
      `INSERT INTO lotes (codigo, fornecedor_id, data_operacao, observacoes, criado_por)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [codigo, fornecedor_id, data, observacoes, req.usuario.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar lote.' })
  }
})

// PATCH /lotes/:id/status
router.patch('/:id/status', autenticar, autorizar('gerente'), async (req, res) => {
  const { status } = req.body
  const validos = ['aberto','em_descarga','descarregado','despolpado','encerrado']
  if (!validos.includes(status))
    return res.status(400).json({ erro: `Status inválido. Use: ${validos.join(', ')}` })

  try {
    const { rows } = await pool.query(
      `UPDATE lotes SET status=$1, atualizado_em=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Lote não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status.' })
  }
})

module.exports = router
