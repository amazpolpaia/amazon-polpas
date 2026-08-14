const router = require('express').Router()
const pool = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

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
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar compras.' })
  }
})

// POST /compras — comprador ou gerente
router.post('/', autenticar, autorizar('gerente', 'comprador'), async (req, res) => {
  const {
    lote_id, fornecedor_id, data_negociacao, data_entrega_prev,
    qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete, unidade_fabril, observacoes,
    placa, frete_no_saldo
  } = req.body

  if (!lote_id || !fornecedor_id || !qtd_latas_prevista || !preco_por_lata)
    return res.status(400).json({ erro: 'lote_id, fornecedor_id, qtd_latas_prevista e preco_por_lata são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO compras
        (lote_id, fornecedor_id, data_negociacao, data_entrega_prev,
         qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete, unidade_fabril, observacoes, registrado_por,
         placa, frete_no_saldo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        lote_id, fornecedor_id,
        data_negociacao || new Date().toISOString().split('T')[0],
        data_entrega_prev, qtd_latas_prevista, preco_por_lata,
        regiao, tipo_frete, valor_frete || 0, unidade_fabril || 'amazon_polpas', observacoes, req.usuario.id,
        placa ? String(placa).toUpperCase().trim() : null, !!frete_no_saldo
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
         l.id AS lote_id,
         l.codigo,
         f.nome AS fornecedor,
         c.qtd_latas_prevista,
         c.preco_por_lata,
         c.total_estimado,
         c.regiao,
         c.tipo_frete,
         c.valor_frete,
         c.unidade_fabril,
         l.status AS lote_status
       FROM compras c
       JOIN fornecedores f ON f.id = c.fornecedor_id
       JOIN lotes l ON l.id = c.lote_id
       WHERE c.data_negociacao = $1
       ORDER BY c.criado_em`,
      [data]
    )
    const total = rows.reduce((s, r) => s + Number(r.total_estimado) + Number(r.valor_frete || 0), 0)
    const latas = rows.reduce((s, r) => s + Number(r.qtd_latas_prevista), 0)
    respostaComValores(req, res, { itens: rows, total_estimado: total, total_latas: latas })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar resumo do dia.' })
  }
})

// PUT /compras/:lote_id — edição de compra (gerente)
router.put('/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete, unidade_fabril, placa, frete_no_saldo } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE compras SET qtd_latas_prevista=$1, preco_por_lata=$2, regiao=$3, tipo_frete=$4, valor_frete=$5, unidade_fabril=$6,
              placa=$8, frete_no_saldo=COALESCE($9, frete_no_saldo),
              total_ajustado = CASE WHEN qtd_latas_prevista IS DISTINCT FROM $1::int OR ROUND(preco_por_lata,2) IS DISTINCT FROM ROUND($2::numeric,2) THEN NULL ELSE total_ajustado END
       WHERE lote_id=$7 RETURNING *`,
      [qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete || 0, unidade_fabril || 'amazon_polpas', req.params.lote_id,
       placa ? String(placa).toUpperCase().trim() : null,
       frete_no_saldo === undefined ? null : !!frete_no_saldo]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Compra não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar compra.' })
  }
})

// PUT /compras/:lote_id/ajuste — ajusta o total pago do lote p/ bater com a NF (gerente)
router.put('/:lote_id/ajuste', autenticar, autorizar('gerente'), async (req, res) => {
  let { total_ajustado } = req.body
  if (total_ajustado === '' || total_ajustado === undefined) total_ajustado = null
  try {
    const { rows } = await pool.query(
      `UPDATE compras SET total_ajustado=$1 WHERE lote_id=$2 RETURNING lote_id, total_estimado, total_ajustado`,
      [total_ajustado, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Compra não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao ajustar total.' })
  }
})

module.exports = router
