const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')

// POST /recepcoes
router.post('/', autenticar, autorizar('gerente', 'recepcao'), async (req, res) => {
  const {
    lote_id, qtd_latas_recebidas,
    condicao_fruto, hora_inicio, hora_fim, observacoes
  } = req.body

  if (!lote_id || qtd_latas_recebidas === undefined)
    return res.status(400).json({ erro: 'lote_id e qtd_latas_recebidas são obrigatórios.' })

  try {
    // Busca quantidade prevista na compra para calcular divergência
    const { rows: [compra] } = await pool.query(
      'SELECT qtd_latas_prevista, preco_por_lata FROM compras WHERE lote_id=$1',
      [lote_id]
    )

    const { rows } = await pool.query(
      `INSERT INTO recepcoes
         (lote_id, qtd_latas_recebidas, condicao_fruto, hora_inicio, hora_fim, observacoes, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        lote_id, qtd_latas_recebidas, condicao_fruto,
        hora_inicio || new Date(), hora_fim, observacoes, req.usuario.id
      ]
    )

    const resultado = { ...rows[0] }

    if (compra) {
      resultado.qtd_latas_prevista = compra.qtd_latas_prevista
      resultado.divergencia_latas  = qtd_latas_recebidas - compra.qtd_latas_prevista
      resultado.preco_por_lata     = compra.preco_por_lata
      resultado.total_real         = (qtd_latas_recebidas * compra.preco_por_lata).toFixed(2)
    }

    res.status(201).json(resultado)
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Recepção já registrada para este lote.' })
    res.status(500).json({ erro: 'Erro ao registrar recepção.' })
  }
})

// GET /recepcoes/:lote_id
router.get('/:lote_id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              c.qtd_latas_prevista,
              c.preco_por_lata,
              r.qtd_latas_recebidas - c.qtd_latas_prevista AS divergencia_latas,
              f.nome AS fornecedor
       FROM recepcoes r
       JOIN lotes l ON l.id = r.lote_id
       JOIN fornecedores f ON f.id = l.fornecedor_id
       LEFT JOIN compras c ON c.lote_id = r.lote_id
       WHERE r.lote_id = $1`,
      [req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Recepção não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar recepção.' })
  }
})

// GET /recepcoes/resumo-dia?data=2025-05-20
router.get('/resumo-dia', autenticar, async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0]
  try {
    const { rows } = await pool.query(
      `SELECT
         f.nome AS fornecedor,
         l.codigo AS lote,
         c.qtd_latas_prevista,
         r.qtd_latas_recebidas,
         r.qtd_latas_recebidas - c.qtd_latas_prevista AS divergencia,
         r.condicao_fruto,
         l.status
       FROM lotes l
       JOIN fornecedores f ON f.id = l.fornecedor_id
       LEFT JOIN compras   c ON c.lote_id = l.id
       LEFT JOIN recepcoes r ON r.lote_id = l.id
       WHERE l.data_operacao = $1
       ORDER BY r.hora_inicio NULLS LAST`,
      [data]
    )
    const totalPrevistas  = rows.reduce((s, r) => s + (Number(r.qtd_latas_prevista) || 0), 0)
    const totalRecebidas  = rows.reduce((s, r) => s + (Number(r.qtd_latas_recebidas) || 0), 0)
    res.json({ itens: rows, total_previstas: totalPrevistas, total_recebidas: totalRecebidas })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar resumo.' })
  }
})

module.exports = router
