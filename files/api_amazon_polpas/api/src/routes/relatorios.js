const router = require('express').Router()
const pool   = require('../db/pool')
const { autenticar, autorizar } = require('../middleware/auth')
const { respostaComValores } = require('../utils/valores')

// GET /relatorios?data=2025-05-20 — relatório do dia (prévia ou fechado)
router.get('/', autenticar, async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0]

  try {
    // Verifica se já foi fechado
    const { rows: [fechado] } = await pool.query(
      `SELECT rd.*, f.nome AS melhor_fornecedor_nome
       FROM relatorios_diarios rd
       LEFT JOIN fornecedores f ON f.id = rd.melhor_fornecedor_id
       WHERE rd.data_operacao=$1`,
      [data]
    )

    if (fechado) {
      // Retorna o relatório fechado com seus itens
      const { rows: itens } = await pool.query(
        `SELECT ri.*, f.nome AS fornecedor
         FROM relatorio_itens ri
         JOIN fornecedores f ON f.id = ri.fornecedor_id
         WHERE ri.relatorio_id=$1
         ORDER BY ri.custo_por_litro ASC`,
        [fechado.id]
      )
      return respostaComValores(req, res, { status: 'fechado', relatorio: fechado, itens })
    }

    // Prévia em tempo real (usando a view)
    const { rows: previa } = await pool.query(
      `SELECT
         f.nome AS fornecedor,
         rd.latas_recebidas, rd.preco_por_lata, rd.total_pago,
         rd.litros_extraidos, rd.rendimento_l_lata, rd.custo_por_litro
       FROM rendimentos rd
       JOIN fornecedores f ON f.id = rd.fornecedor_id
       WHERE rd.data_operacao=$1
       ORDER BY rd.custo_por_litro ASC`,
      [data]
    )

    // Calcula média ponderada da prévia
    const totalPago   = previa.reduce((s, r) => s + Number(r.total_pago || 0), 0)
    const totalLitros = previa.reduce((s, r) => s + Number(r.litros_extraidos || 0), 0)
    const totalLatas  = previa.reduce((s, r) => s + Number(r.latas_recebidas || 0), 0)
    const custoMedio  = totalLitros > 0 ? (totalPago / totalLitros).toFixed(4) : null
    const rendMedio   = totalLatas  > 0 ? (totalLitros / totalLatas).toFixed(4) : null

    respostaComValores(req, res, {
      status: 'aberto',
      data,
      resumo: {
        qtd_fornecedores:      previa.length,
        total_latas:           totalLatas,
        total_litros:          totalLitros,
        total_valor_pago:      totalPago.toFixed(2),
        custo_medio_litro:     custoMedio,
        rendimento_medio:      rendMedio,
      },
      itens: previa
    })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar relatório.' })
  }
})

// POST /relatorios/fechar — fecha o dia (somente gerente)
router.post('/fechar', autenticar, autorizar('gerente'), async (req, res) => {
  const data = req.body.data || new Date().toISOString().split('T')[0]

  try {
    const { rows } = await pool.query(
      'SELECT fn_fechar_dia($1, $2) AS relatorio_id',
      [data, req.usuario.id]
    )
    const relatorio_id = rows[0].relatorio_id

    // Retorna o relatório recém-criado
    const { rows: [relatorio] } = await pool.query(
      `SELECT rd.*, f.nome AS melhor_fornecedor_nome
       FROM relatorios_diarios rd
       LEFT JOIN fornecedores f ON f.id = rd.melhor_fornecedor_id
       WHERE rd.id=$1`,
      [relatorio_id]
    )

    const { rows: itens } = await pool.query(
      `SELECT ri.*, f.nome AS fornecedor
       FROM relatorio_itens ri
       JOIN fornecedores f ON f.id = ri.fornecedor_id
       WHERE ri.relatorio_id=$1
       ORDER BY ri.custo_por_litro ASC`,
      [relatorio_id]
    )

    res.status(201)
    respostaComValores(req, res, { relatorio, itens })
  } catch (err) {
    if (err.message.includes('já foi gerado'))
      return res.status(409).json({ erro: err.message })
    res.status(500).json({ erro: 'Erro ao fechar o dia.' })
  }
})

// GET /relatorios/historico?dias=30 — histórico de relatórios
router.get('/historico', autenticar, async (req, res) => {
  const dias = req.query.dias || 30
  try {
    const { rows } = await pool.query(
      `SELECT rd.*, f.nome AS melhor_fornecedor_nome
       FROM relatorios_diarios rd
       LEFT JOIN fornecedores f ON f.id = rd.melhor_fornecedor_id
       WHERE rd.data_operacao >= CURRENT_DATE - INTERVAL '${Number(dias)} days'
       ORDER BY rd.data_operacao DESC`
    )
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico.' })
  }
})

// GET /relatorios/periodo?inicio=2025-05-01&fim=2025-05-20 — relatórios fechados no intervalo
router.get('/periodo', autenticar, async (req, res) => {
  const inicio = req.query.inicio
  const fim = req.query.fim || inicio

  if (!inicio)
    return res.status(400).json({ erro: 'Informe inicio (YYYY-MM-DD).' })

  try {
    const { rows } = await pool.query(
      `SELECT rd.*, f.nome AS melhor_fornecedor_nome
       FROM relatorios_diarios rd
       LEFT JOIN fornecedores f ON f.id = rd.melhor_fornecedor_id
       WHERE rd.data_operacao >= $1::date AND rd.data_operacao <= $2::date
       ORDER BY rd.data_operacao DESC`,
      [inicio, fim]
    )

    const totais = rows.reduce(
      (acc, r) => {
        acc.dias += 1
        acc.total_latas += Number(r.total_latas || 0)
        acc.total_litros += Number(r.total_litros || 0)
        acc.total_valor_pago += Number(r.total_valor_pago || 0)
        return acc
      },
      { dias: 0, total_latas: 0, total_litros: 0, total_valor_pago: 0 }
    )

    totais.custo_medio_litro =
      totais.total_litros > 0
        ? (totais.total_valor_pago / totais.total_litros).toFixed(4)
        : null

    respostaComValores(req, res, {
      inicio,
      fim,
      resumo: {
        dias_fechados: totais.dias,
        total_latas: totais.total_latas,
        total_litros: totais.total_litros,
        total_valor_pago: totais.total_valor_pago.toFixed(2),
        custo_medio_litro: totais.custo_medio_litro,
      },
      relatorios: rows,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro ao buscar relatórios do período.' })
  }
})

// GET /relatorios/desempenho-fornecedores — ranking geral
router.get('/desempenho-fornecedores', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_desempenho_fornecedores')
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar desempenho.' })
  }
})

module.exports = router
