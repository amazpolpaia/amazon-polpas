const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')

// ─── CHEGADA ────────────────────────────────────────────────

// POST /pesagens/chegada
router.post('/chegada', autenticar, autorizar('gerente', 'balanca'), async (req, res) => {
  const { lote_id, placa_veiculo, hora_chegada, peso_bruto_kg, tara_kg, observacoes } = req.body

  if (!lote_id || !peso_bruto_kg)
    return res.status(400).json({ erro: 'lote_id e peso_bruto_kg são obrigatórios.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO pesagens_chegada
         (lote_id, placa_veiculo, hora_chegada, peso_bruto_kg, tara_kg, observacoes, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        lote_id, placa_veiculo,
        hora_chegada || new Date(),
        peso_bruto_kg, tara_kg, observacoes, req.usuario.id
      ]
    )

    // Atualiza status do lote para em_descarga
    await pool.query(
      "UPDATE lotes SET status='em_descarga', atualizado_em=NOW() WHERE id=$1",
      [lote_id]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Pesagem de chegada já registrada para este lote.' })
    res.status(500).json({ erro: 'Erro ao registrar pesagem de chegada.' })
  }
})

// GET /pesagens/chegada/:lote_id
router.get('/chegada/:lote_id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pesagens_chegada WHERE lote_id=$1',
      [req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Pesagem de chegada não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pesagem.' })
  }
})

// ─── SAÍDA ───────────────────────────────────────────────────

// POST /pesagens/saida
// O trigger fn_calc_peso_liquido calcula peso_liquido_kg automaticamente
router.post('/saida', autenticar, autorizar('gerente', 'balanca'), async (req, res) => {
  const { lote_id, peso_saida_kg, observacoes } = req.body

  if (!lote_id || !peso_saida_kg)
    return res.status(400).json({ erro: 'lote_id e peso_saida_kg são obrigatórios.' })

  try {
    // Verifica se a pesagem de chegada existe
    const { rows: [chegada] } = await pool.query(
      'SELECT peso_bruto_kg FROM pesagens_chegada WHERE lote_id=$1',
      [lote_id]
    )
    if (!chegada)
      return res.status(400).json({ erro: 'Registre a pesagem de chegada antes da saída.' })

    if (Number(peso_saida_kg) >= Number(chegada.peso_bruto_kg))
      return res.status(400).json({ erro: 'Peso de saída deve ser menor que o peso bruto de chegada.' })

    // Calcula divergência em relação às latas recebidas
    const { rows: [recepcao] } = await pool.query(
      'SELECT qtd_latas_recebidas FROM recepcoes WHERE lote_id=$1',
      [lote_id]
    )
    let divergencia = null
    if (recepcao) {
      const pesoEsperado = recepcao.qtd_latas_recebidas * 14
      const pesoLiquido  = chegada.peso_bruto_kg - peso_saida_kg
      divergencia        = pesoLiquido - pesoEsperado
    }

    const { rows } = await pool.query(
      `INSERT INTO pesagens_saida
         (lote_id, peso_saida_kg, divergencia_kg, observacoes, registrado_por)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [lote_id, peso_saida_kg, divergencia, observacoes, req.usuario.id]
    )

    // Atualiza status
    await pool.query(
      "UPDATE lotes SET status='descarregado', atualizado_em=NOW() WHERE id=$1",
      [lote_id]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ erro: 'Pesagem de saída já registrada para este lote.' })
    res.status(500).json({ erro: 'Erro ao registrar pesagem de saída.' })
  }
})

// GET /pesagens/saida/:lote_id
router.get('/saida/:lote_id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ps.*, pc.peso_bruto_kg,
              pc.peso_bruto_kg - ps.peso_saida_kg AS peso_liquido_kg
       FROM pesagens_saida ps
       JOIN pesagens_chegada pc ON pc.lote_id = ps.lote_id
       WHERE ps.lote_id=$1`,
      [req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Pesagem de saída não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pesagem.' })
  }
})

// GET /pesagens/comparativo?data=2025-05-20
router.get('/comparativo', autenticar, async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0]
  try {
    const { rows } = await pool.query(
      `SELECT
         f.nome AS fornecedor,
         l.codigo AS lote,
         pc.peso_bruto_kg,
         ps.peso_saida_kg,
         pc.peso_bruto_kg - ps.peso_saida_kg AS peso_liquido_kg,
         ps.divergencia_kg
       FROM lotes l
       JOIN fornecedores f ON f.id = l.fornecedor_id
       LEFT JOIN pesagens_chegada pc ON pc.lote_id = l.id
       LEFT JOIN pesagens_saida   ps ON ps.lote_id = l.id
       WHERE l.data_operacao = $1
       ORDER BY pc.hora_chegada`,
      [data]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar comparativo.' })
  }
})

module.exports = router
