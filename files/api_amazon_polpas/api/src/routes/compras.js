const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')

// GET /compras?data=2025-05-20
router.get('/', autenticar, async (req, res) => {
  const { data, fornecedor_id } = req.query
  let query = `
    SELECT c.*, f.nome AS fornecedor, l.codigo AS lote_codigo, l.status AS lote_status
    FROM compras c
    JOIN fornecedores f ON f.id = c.fornecedor_id
    JOIN lotes l ON l.id = c.lote_id
    WHERE 1=1`
  const params = []
  if (data) { params.push(data); query += ` AND c.data_negociacao = $${params.length}` }
  if (fornecedor_id) { params.push(fornecedor_id); query += ` AND c.fornecedor_id = $${params.length}` }
  query += ' ORDER BY c.criado_em DESC'

  try {
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar compras.' })
  }
})

// POST /compras — comprador ou gerente
router.post('/', autenticar, autorizar('gerente', 'comprador'), async (req, res) => {
  const {
    lote_id, fornecedor_id, data_negociacao, data_entrega_prev,
    qtd_latas_prevista, preco_por_lata, condicao_acordada, observacoes
  } = req.body

  if (!lote_id || !fornecedor_id || !qtd_latas_prevista || !preco_por_lata)
    return res.status(400).json({ erro: 'lote_id, fornecedor_id, qtd_latas_prevista e preco_por_lata são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO compras
         (lote_id, fornecedor_id, data_negociacao, data_entrega_prev,
          qtd_latas_prevista, preco_por_lata, condicao_acordada, observacoes, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        lote_id, fornecedor_id,
        data_negociacao || new Date().toISOString().split('T')[0],
        data_entrega_prev, qtd_latas_prevista, preco_por_lata,
        condicao_acordada, observacoes, req.usuario.id
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Este lote já tem uma compra registrada.' })
    res.status(500).json({ erro: 'Erro ao registrar compra.' })
  }
})

// GET /compras/resumo-dia?data=2025-05-20
router.get('/resumo-dia', autenticar, async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0]
  try {
    const { rows } = await pool.query(
      `SELECT
         f.nome AS fornecedor,
         c.qtd_latas_prevista,
         c.preco_por_lata,
         c.total_estimado,
         l.status AS lote_status
       FROM compras c
       JOIN fornecedores f ON f.id = c.fornecedor_id
       JOIN lotes l ON l.id = c.lote_id
       WHERE c.data_negociacao = $1
       ORDER BY c.criado_em`,
      [data]
    )
    const total = rows.reduce((s, r) => s + Number(r.total_estimado), 0)
    const latas = rows.reduce((s, r) => s + Number(r.qtd_latas_prevista), 0)
    res.json({ itens: rows, total_estimado: total, total_latas: latas })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar resumo do dia.' })
  }
})

module.exports = router
