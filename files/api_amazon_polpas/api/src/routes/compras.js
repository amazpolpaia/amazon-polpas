const router = require('express').Router()
const pool = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

// --- Regiao: grafia unica ---------------------------------------------------
// Nao aceitamos mais caixa alta. Antes de gravar, a regiao e comparada com as
// que ja existem ignorando acento e maiuscula; se achar, grava com a grafia que
// ja esta no banco (CAMETA -> Cameta'). Se for regiao nova, vira Caixa Alta So
// Nas Iniciais (MOURA E BAQUIA -> Moura e Baquia).
const MINUSCULAS = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'o', 'a', 'em'])

const chaveRegiao = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^0-9A-Za-z]+/g, ' ')
  .trim().toUpperCase()

const tituloRegiao = (s) => String(s == null ? '' : s)
  .replace(/\s+/g, ' ').trim().toLowerCase()
  .split(' ')
  .map((p, i) => (i > 0 && MINUSCULAS.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1))
  .join(' ')

// Entre duas grafias da mesma regiao, prefere a que nao esta em caixa alta,
// depois a que tem acento, depois a mais usada.
const notaGrafia = (regiao, n) => {
  const texto = String(regiao || '')
  const caixaAlta = (texto === texto.toUpperCase() && /[A-Za-z]/.test(texto)) ? 1 : 0
  const acento = /[^\x00-\x7F]/.test(texto) ? 1 : 0
  return Number(n || 0) + acento * 1000 - caixaAlta * 1000000
}

async function grafiasRegiao () {
  const { rows } = await pool.query(
    `SELECT TRIM(regiao) AS regiao, COUNT(*)::int AS n
       FROM compras
      WHERE regiao IS NOT NULL AND TRIM(regiao) <> ''
      GROUP BY 1`
  )
  return rows
}

async function canonizaRegiao (entrada) {
  const bruto = String(entrada == null ? '' : entrada).replace(/\s+/g, ' ').trim()
  if (!bruto) return null
  const k = chaveRegiao(bruto)
  if (!k) return null
  try {
    let melhor = null
    for (const r of await grafiasRegiao()) {
      if (chaveRegiao(r.regiao) !== k) continue
      const nota = notaGrafia(r.regiao, r.n)
      if (!melhor || nota > melhor.nota) melhor = { regiao: r.regiao, nota }
    }
    if (melhor) return melhor.regiao
  } catch (e) {
    // se a consulta falhar, ao menos arruma a caixa alta
  }
  return tituloRegiao(bruto)
}

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
    const regiaoOk = await canonizaRegiao(regiao)
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
        regiaoOk, tipo_frete, valor_frete || 0, unidade_fabril || 'amazon_polpas', observacoes, req.usuario.id,
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

// GET /compras/regioes - lista as regioes ja usadas, para o autocompletar
router.get('/regioes', autenticar, async (_req, res) => {
  try {
    // Uma entrada por regiao: se houver duas grafias, mostra a melhor.
    const melhor = new Map()
    for (const r of await grafiasRegiao()) {
      const k = chaveRegiao(r.regiao)
      if (!k) continue
      const nota = notaGrafia(r.regiao, r.n)
      const atual = melhor.get(k)
      if (!atual || nota > atual.nota) melhor.set(k, { regiao: r.regiao, nota })
    }
    res.json([...melhor.values()].map((x) => x.regiao).sort((a, b) => a.localeCompare(b, 'pt-BR')))
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar regioes.' })
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
  const { qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete, unidade_fabril, placa, frete_no_saldo, observacoes, data_entrega_prev } = req.body
  try {
    // Campo nao enviado (undefined) preserva o valor atual; string vazia limpa.
    const manter = (v) => (v === undefined ? null : String(v))
    const { rows } = await pool.query(
      `UPDATE compras SET qtd_latas_prevista=$1, preco_por_lata=$2, regiao=$3, tipo_frete=$4, valor_frete=$5, unidade_fabril=$6,
              placa            = CASE WHEN $8::text  IS NULL THEN placa            ELSE NULLIF(UPPER(TRIM($8::text)),'') END,
              observacoes      = CASE WHEN $10::text IS NULL THEN observacoes      ELSE NULLIF(TRIM($10::text),'')       END,
              data_entrega_prev= CASE WHEN $11::text IS NULL THEN data_entrega_prev ELSE NULLIF($11::text,'')::date      END,
              frete_no_saldo=COALESCE($9, frete_no_saldo),
              total_ajustado = CASE WHEN qtd_latas_prevista IS DISTINCT FROM $1::int OR ROUND(preco_por_lata,2) IS DISTINCT FROM ROUND($2::numeric,2) THEN NULL ELSE total_ajustado END
       WHERE lote_id=$7 RETURNING *`,
      [qtd_latas_prevista, preco_por_lata, await canonizaRegiao(regiao), tipo_frete, valor_frete || 0, unidade_fabril || 'amazon_polpas', req.params.lote_id,
       manter(placa),
       frete_no_saldo === undefined ? null : !!frete_no_saldo,
       manter(observacoes), manter(data_entrega_prev)]
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
