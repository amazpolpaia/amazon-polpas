const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

// ─── DESPOLPAMENTO (módulo 5) ────────────────────────────────

// POST /producao/despolpamento
router.post('/despolpamento', autenticar, autorizar('gerente', 'producao'), async (req, res) => {
  const {
    lote_id, latas_processadas, litros_extraidos,
    turno, operador_nome, hora_inicio, hora_fim, observacoes, lote_produto, solidos_totais, marca
  } = req.body

  if (!lote_id || !latas_processadas || !litros_extraidos)
    return res.status(400).json({ erro: 'lote_id, latas_processadas e litros_extraidos são obrigatórios.' })

  if (litros_extraidos <= 0 || latas_processadas <= 0)
    return res.status(400).json({ erro: 'Valores devem ser maiores que zero.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO despolpamentos
         (lote_id, latas_processadas, litros_extraidos, turno,
          operador_nome, hora_inicio, hora_fim, observacoes, lote_produto, solidos_totais, marca, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        lote_id, latas_processadas, litros_extraidos, turno||null,
        operador_nome, hora_inicio, hora_fim, observacoes, lote_produto||null, solidos_totais||null, marca||null, req.usuario.id
      ]
    )

    // Atualiza status do lote
    await pool.query(
      "UPDATE lotes SET status='despolpado', atualizado_em=NOW() WHERE id=$1",
      [lote_id]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Despolpamento já registrado para este lote.' })
    res.status(500).json({ erro: 'Erro ao registrar despolpamento.' })
  }
})

// GET /producao/despolpamento/:lote_id
router.get('/despolpamento/:lote_id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, f.nome AS fornecedor, l.codigo
       FROM despolpamentos d
       JOIN lotes l ON l.id = d.lote_id
       JOIN fornecedores f ON f.id = l.fornecedor_id
       WHERE d.lote_id=$1`,
      [req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Despolpamento não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar despolpamento.' })
  }
})

// GET /producao/historico?fornecedor_id=1&limite=10
router.get('/historico', autenticar, async (req, res) => {
  const { fornecedor_id, limite = 10 } = req.query
  try {
    let query = `
      SELECT d.rendimento_l_lata, d.litros_extraidos, d.latas_processadas,
             l.data_operacao, f.nome AS fornecedor
      FROM despolpamentos d
      JOIN lotes l ON l.id = d.lote_id
      JOIN fornecedores f ON f.id = l.fornecedor_id
      WHERE 1=1`
    const params = []
    if (fornecedor_id) { params.push(fornecedor_id); query += ` AND l.fornecedor_id=$${params.length}` }
    params.push(limite); query += ` ORDER BY l.data_operacao DESC LIMIT $${params.length}`
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico.' })
  }
})

// ─── RENDIMENTO (módulo 6) ───────────────────────────────────

// POST /producao/rendimento
// Consolida dados do lote e calcula custo/litro
router.post('/rendimento', autenticar, autorizar('gerente', 'producao'), async (req, res) => {
  const { lote_id } = req.body
  if (!lote_id) return res.status(400).json({ erro: 'lote_id é obrigatório.' })

  try {
    // Busca todos os dados do lote numa query só
    const { rows: [dados] } = await pool.query(
      `SELECT
         l.fornecedor_id,
         l.data_operacao,
         c.preco_por_lata,
         r.qtd_latas_recebidas    AS latas_recebidas,
         d.litros_extraidos,
         d.rendimento_l_lata
       FROM lotes l
       JOIN compras        c ON c.lote_id = l.id
       JOIN recepcoes      r ON r.lote_id = l.id
       JOIN despolpamentos d ON d.lote_id = l.id
       WHERE l.id = $1`,
      [lote_id]
    )

    if (!dados)
      return res.status(400).json({
        erro: 'Lote incompleto. Verifique: compra, recepção e despolpamento registrados.'
      })

    const { rows } = await pool.query(
      `INSERT INTO rendimentos
         (lote_id, fornecedor_id, data_operacao, latas_recebidas,
          preco_por_lata, litros_extraidos, rendimento_l_lata, calculado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        lote_id, dados.fornecedor_id, dados.data_operacao,
        dados.latas_recebidas, dados.preco_por_lata,
        dados.litros_extraidos, dados.rendimento_l_lata,
        req.usuario.id
      ]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Rendimento já calculado para este lote.' })
    res.status(500).json({ erro: 'Erro ao calcular rendimento.' })
  }
})

// GET /producao/rendimento/:lote_id
router.get('/rendimento/:lote_id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rd.*, f.nome AS fornecedor
       FROM rendimentos rd
       JOIN fornecedores f ON f.id = rd.fornecedor_id
       WHERE rd.lote_id=$1`,
      [req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Rendimento não calculado ainda.' })
    respostaComValores(req, res, rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar rendimento.' })
  }
})

// GET /producao/comparativo-dia?data=2025-05-20
router.get('/comparativo-dia', autenticar, async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0]
  try {
    const { rows } = await pool.query(
      `SELECT f.nome AS fornecedor,
              rd.latas_recebidas, rd.preco_por_lata, rd.total_pago,
              rd.litros_extraidos, rd.rendimento_l_lata, rd.custo_por_litro
       FROM rendimentos rd
       JOIN fornecedores f ON f.id = rd.fornecedor_id
       WHERE rd.data_operacao=$1
       ORDER BY rd.custo_por_litro ASC`,
      [data]
    )
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar comparativo.' })
  }
})


// PUT /producao/despolpamento/:lote_id — editar despolpamento existente
router.put('/despolpamento/:lote_id', autenticar, autorizar('gerente', 'producao'), async (req, res) => {
  const { lote_id } = req.params
  const { latas_processadas, litros_extraidos, operador_nome, solidos_totais, marca, lote_produto } = req.body

  if (!latas_processadas || !litros_extraidos)
    return res.status(400).json({ erro: 'latas_processadas e litros_extraidos são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `UPDATE despolpamentos
       SET latas_processadas=$1, litros_extraidos=$2,
           rendimento_l_lata=ROUND($2::numeric/$1::numeric,4),
           operador_nome=$3, solidos_totais=$4, marca=$5, lote_produto=$6
       WHERE lote_id=$7
       RETURNING *`,
      [latas_processadas, litros_extraidos, operador_nome||null, solidos_totais||null, marca||null, lote_produto||null, lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Despolpamento não encontrado para este lote.' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao atualizar despolpamento.' })
  }
})

module.exports = router
