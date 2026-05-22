const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

// GET /fornecedores
router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*,
        COUNT(l.id)              AS total_lotes,
        ROUND(AVG(r.rendimento_l_lata), 2) AS media_rendimento,
        ROUND(AVG(r.custo_por_litro), 4)   AS media_custo_litro,
        MAX(r.data_operacao)               AS ultimo_lote
       FROM fornecedores f
       LEFT JOIN lotes l      ON l.fornecedor_id = f.id
       LEFT JOIN rendimentos r ON r.fornecedor_id = f.id
       WHERE f.ativo = TRUE
       GROUP BY f.id
       ORDER BY f.nome`
    )
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar fornecedores.' })
  }
})

// GET /fornecedores/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM fornecedores WHERE id = $1',
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar fornecedor.' })
  }
})

// POST /fornecedores — gerente
router.post('/', autenticar, autorizar('gerente'), async (req, res) => {
  const { nome, municipio, estado, contato_nome, contato_fone, contato_email, observacoes } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO fornecedores (nome, municipio, estado, contato_nome, contato_fone, contato_email, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nome, municipio, estado || 'PA', contato_nome, contato_fone, contato_email, observacoes]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar fornecedor.' })
  }
})

// PUT /fornecedores/:id — gerente
router.put('/:id', autenticar, autorizar('gerente'), async (req, res) => {
  const { nome, municipio, estado, contato_nome, contato_fone, contato_email, observacoes, ativo } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE fornecedores SET
         nome=$1, municipio=$2, estado=$3, contato_nome=$4,
         contato_fone=$5, contato_email=$6, observacoes=$7,
         ativo=$8, atualizado_em=NOW()
       WHERE id=$9 RETURNING *`,
      [nome, municipio, estado, contato_nome, contato_fone, contato_email, observacoes, ativo, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor.' })
  }
})

module.exports = router
