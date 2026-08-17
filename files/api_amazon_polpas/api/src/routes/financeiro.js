// Modulo financeiro: frete por placa, saldo de fornecedores e pagamentos.
// Acesso restrito a usuarios com pode_ver_financeiro (ou admin master).
const router = require('express').Router()
const pool = require('../db/pool')
const { autenticar, autorizarFinanceiro } = require('../middleware/auth')

// Valor devido de um lote ao fornecedor.
// total_ajustado ja inclui o frete; sem ele, latas recebidas x preco.
// O frete so entra no saldo quando marcado em frete_no_saldo.
const SQL_DEVIDO = `
  COALESCE(
    c.total_ajustado,
    COALESCE(r.qtd_latas_recebidas, c.qtd_latas_prevista) * c.preco_por_lata
      + CASE WHEN COALESCE(c.frete_no_saldo, FALSE) THEN COALESCE(c.valor_frete, 0) ELSE 0 END
  )
`

// GET /financeiro/fretes-placa?inicio=&fim=
// Agrupa pela placa registrada na balanca de chegada (pesagens_chegada).
router.get('/fretes-placa', autenticar, autorizarFinanceiro, async (req, res) => {
  const { inicio, fim } = req.query
  try {
    const params = []
    let filtro = "WHERE pc.placa_veiculo IS NOT NULL AND TRIM(pc.placa_veiculo) <> ''"
    if (inicio && fim) {
      params.push(inicio, fim)
      filtro += ` AND DATE(l.data_operacao) BETWEEN $1 AND $2`
    }
    const { rows } = await pool.query(
      `SELECT
         UPPER(TRIM(pc.placa_veiculo))                     AS placa,
         COUNT(DISTINCT l.id)                              AS lotes,
         COUNT(DISTINCT DATE(l.data_operacao))             AS viagens,
         COALESCE(SUM(COALESCE(r.qtd_latas_recebidas, c.qtd_latas_prevista)), 0) AS latas,
         COALESCE(SUM(COALESCE(c.valor_frete, 0)), 0)      AS total_frete,
         MIN(DATE(l.data_operacao))                        AS primeira_viagem,
         MAX(DATE(l.data_operacao))                        AS ultima_viagem,
         STRING_AGG(DISTINCT f.nome, ', ')                 AS fornecedores
       FROM lotes l
       JOIN compras c ON c.lote_id = l.id
       JOIN fornecedores f ON f.id = l.fornecedor_id
       LEFT JOIN recepcoes r ON r.lote_id = l.id
       JOIN pesagens_chegada pc ON pc.lote_id = l.id
       ${filtro}
       GROUP BY UPPER(TRIM(pc.placa_veiculo))
       ORDER BY total_frete DESC`,
      params
    )
    res.json(
      rows.map((p) => ({
        ...p,
        latas: Number(p.latas),
        total_frete: Number(p.total_frete),
        frete_por_lata:
          Number(p.latas) > 0 ? Number((Number(p.total_frete) / Number(p.latas)).toFixed(2)) : null,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao buscar fretes por placa.' })
  }
})

// GET /financeiro/saldos
// Devido x pago por fornecedor.
router.get('/saldos', autenticar, autorizarFinanceiro, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `WITH devido AS (
         SELECT l.fornecedor_id,
                COUNT(*)                    AS lotes,
                COALESCE(SUM(${SQL_DEVIDO}), 0) AS total_devido,
                MAX(DATE(l.data_operacao))  AS ultimo_lote
         FROM lotes l
         JOIN compras c ON c.lote_id = l.id
         LEFT JOIN recepcoes r ON r.lote_id = l.id
         WHERE COALESCE(l.status, '') <> 'cancelado'
         GROUP BY l.fornecedor_id
       ),
       pago AS (
         SELECT fornecedor_id,
                COALESCE(SUM(valor), 0)  AS total_pago,
                MAX(data_pagamento)      AS ultimo_pagamento
         FROM pagamentos
         GROUP BY fornecedor_id
       )
       SELECT f.id                                   AS fornecedor_id,
              f.nome                                 AS fornecedor,
              COALESCE(d.lotes, 0)                   AS lotes,
              COALESCE(d.total_devido, 0)            AS total_devido,
              COALESCE(p.total_pago, 0)              AS total_pago,
              COALESCE(d.total_devido, 0) - COALESCE(p.total_pago, 0) AS saldo,
              d.ultimo_lote,
              p.ultimo_pagamento
       FROM fornecedores f
       LEFT JOIN devido d ON d.fornecedor_id = f.id
       LEFT JOIN pago   p ON p.fornecedor_id = f.id
       WHERE COALESCE(d.lotes, 0) > 0 OR COALESCE(p.total_pago, 0) > 0
       ORDER BY saldo DESC, f.nome`
    )
    const lista = rows.map((x) => ({
      ...x,
      total_devido: Number(x.total_devido),
      total_pago: Number(x.total_pago),
      saldo: Number(x.saldo),
    }))
    res.json({
      fornecedores: lista,
      resumo: {
        total_devido: Number(lista.reduce((s, x) => s + x.total_devido, 0).toFixed(2)),
        total_pago: Number(lista.reduce((s, x) => s + x.total_pago, 0).toFixed(2)),
        saldo_aberto: Number(
          lista.reduce((s, x) => s + (x.saldo > 0 ? x.saldo : 0), 0).toFixed(2)
        ),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao calcular saldos.' })
  }
})

// GET /financeiro/pagamentos?fornecedor_id=
router.get('/pagamentos', autenticar, autorizarFinanceiro, async (req, res) => {
  const { fornecedor_id } = req.query
  try {
    const params = []
    let filtro = ''
    if (fornecedor_id) {
      params.push(fornecedor_id)
      filtro = 'WHERE pg.fornecedor_id = $1'
    }
    const { rows } = await pool.query(
      `SELECT pg.id, pg.fornecedor_id, f.nome AS fornecedor,
              pg.data_pagamento, pg.valor, pg.observacoes, pg.criado_em,
              u.nome AS registrado_por_nome
       FROM pagamentos pg
       JOIN fornecedores f ON f.id = pg.fornecedor_id
       LEFT JOIN usuarios u ON u.id = pg.registrado_por
       ${filtro}
       ORDER BY pg.data_pagamento DESC, pg.criado_em DESC`,
      params
    )
    res.json(rows.map((x) => ({ ...x, valor: Number(x.valor) })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao listar pagamentos.' })
  }
})

// POST /financeiro/pagamentos
router.post('/pagamentos', autenticar, autorizarFinanceiro, async (req, res) => {
  const { fornecedor_id, data_pagamento, valor, observacoes } = req.body
  if (!fornecedor_id || !valor)
    return res.status(400).json({ erro: 'Fornecedor e valor sao obrigatorios.' })
  if (Number(valor) <= 0)
    return res.status(400).json({ erro: 'O valor deve ser maior que zero.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO pagamentos (fornecedor_id, data_pagamento, valor, observacoes, registrado_por)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5)
       RETURNING *`,
      [fornecedor_id, data_pagamento || null, valor, observacoes || null, req.usuario.id]
    )
    res.status(201).json({ ...rows[0], valor: Number(rows[0].valor) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao registrar pagamento.' })
  }
})

// DELETE /financeiro/pagamentos/:id
router.delete('/pagamentos/:id', autenticar, autorizarFinanceiro, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM pagamentos WHERE id=$1 RETURNING id', [
      req.params.id,
    ])
    if (!rows.length) return res.status(404).json({ erro: 'Pagamento nao encontrado.' })
    res.json({ ok: true, id: rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao excluir pagamento.' })
  }
})

module.exports = router
