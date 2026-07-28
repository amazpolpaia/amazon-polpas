// v2.2 - periodo route + redesign
const router = require('express').Router()
const pool = require('../db/pool')
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
        `SELECT ri.*, f.nome AS fornecedor,
                ps.peso_liquido_kg,
                c.tipo_frete, c.valor_frete, c.regiao, c.unidade_fabril
         FROM relatorio_itens ri
         JOIN fornecedores f ON f.id = ri.fornecedor_id
         LEFT JOIN pesagens_saida ps ON ps.lote_id = ri.lote_id
         LEFT JOIN compras c ON c.lote_id = ri.lote_id
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
         rd.litros_extraidos, rd.rendimento_l_lata, rd.custo_por_litro,
         ps.peso_liquido_kg,
         c.tipo_frete, c.valor_frete, c.regiao, c.unidade_fabril
       FROM rendimentos rd
       JOIN fornecedores f ON f.id = rd.fornecedor_id
       LEFT JOIN pesagens_saida ps ON ps.lote_id = rd.lote_id
       LEFT JOIN compras c ON c.lote_id = rd.lote_id
       WHERE rd.data_operacao=$1
       ORDER BY rd.custo_por_litro ASC`,
      [data]
    )

    // Calcula média ponderada da prévia
    const totalPago = previa.reduce((s, r) => s + Number(r.total_pago || 0), 0)
    const totalLitros = previa.reduce((s, r) => s + Number(r.litros_extraidos || 0), 0)
    const totalLatas = previa.reduce((s, r) => s + Number(r.latas_recebidas || 0), 0)
    const custoMedio = totalLitros > 0 ? (totalPago / totalLitros).toFixed(4) : null
    const rendMedio = totalLatas > 0 ? (totalLitros / totalLatas).toFixed(4) : null

    respostaComValores(req, res, {
      status: 'aberto',
      data,
      resumo: {
        qtd_fornecedores: previa.length,
        total_latas: totalLatas,
        total_litros: totalLitros,
        total_valor_pago: totalPago.toFixed(2),
        custo_medio_litro: custoMedio,
        rendimento_medio: rendMedio,
      },
      itens: previa
    })
  } catch (err) {
    console.error(err)
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
      `SELECT ri.*, f.nome AS fornecedor,
              ps.peso_liquido_kg,
              c.tipo_frete, c.valor_frete, c.regiao, c.unidade_fabril
       FROM relatorio_itens ri
       JOIN fornecedores f ON f.id = ri.fornecedor_id
       LEFT JOIN pesagens_saida ps ON ps.lote_id = ri.lote_id
       LEFT JOIN compras c ON c.lote_id = ri.lote_id
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

// (rota /periodo antiga removida — ver nova abaixo)

// GET /relatorios/desempenho-fornecedores — ranking geral
router.get('/desempenho-fornecedores', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_desempenho_fornecedores')
    respostaComValores(req, res, rows)
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar desempenho.' })
  }
})


// GET /relatorios/periodo?inicio=2026-07-21&fim=2026-07-24 — relatório executivo por período
router.get('/periodo', autenticar, async (req, res) => {
  const { inicio, fim } = req.query
  if (!inicio || !fim) return res.status(400).json({ erro: 'Informe inicio e fim.' })
  try {
    // 1. Lotes e rendimentos por período
    const { rows: lotes } = await pool.query(`
      SELECT
        f.nome AS fornecedor,
        c.regiao,
        c.unidade_fabril,
        DATE(l.data_operacao) AS data,
        l.status,
        c.qtd_latas_prevista,
        c.preco_por_lata,
        c.total_estimado,
        c.tipo_frete,
        c.valor_frete,
        pc.peso_bruto_kg,
        ps.peso_saida_kg,
        (COALESCE(pc.peso_bruto_kg,0) - COALESCE(ps.peso_saida_kg,0)) AS peso_liquido_kg,
        r.qtd_latas_recebidas AS latas_recebidas,
        r.condicao_fruto,
        d.latas_processadas,
        d.litros_extraidos,
        d.rendimento_l_lata,
        d.solidos_totais,
        d.marca,
        d.lote_produto,
        d.operador_nome,
        CASE WHEN d.litros_extraidos > 0 THEN ROUND(c.total_estimado::numeric / d.litros_extraidos::numeric, 4) END AS custo_por_litro
      FROM lotes l
      JOIN fornecedores f ON f.id = l.fornecedor_id
      LEFT JOIN compras c ON c.lote_id = l.id
      LEFT JOIN pesagens_chegada pc ON pc.lote_id = l.id
      LEFT JOIN pesagens_saida ps ON ps.lote_id = l.id
      LEFT JOIN recepcoes r ON r.lote_id = l.id
      LEFT JOIN despolpamentos d ON d.lote_id = l.id
      WHERE DATE(l.data_operacao) BETWEEN $1 AND $2
      ORDER BY l.data_operacao, f.nome
    `, [inicio, fim])

    // 2. Totais gerais
    const lotesFin = lotes.filter(l => l.litros_extraidos)
    const totalLatas = lotesFin.reduce((s,l)=>s+Number(l.latas_processadas||0),0)
    const totalLitros = lotesFin.reduce((s,l)=>s+Number(l.litros_extraidos||0),0)
    const totalPago = lotesFin.reduce((s,l)=>s+Number(l.total_estimado||0),0)
    const totalPesoLiq = lotes.reduce((s,l)=>s+Number(l.peso_liquido_kg||0),0)
    const custoMedioLitro = totalLitros>0 ? (totalPago/totalLitros) : 0
    const rendMedioLata = totalLatas>0 ? (totalLitros/totalLatas) : 0

    // 3. Por fornecedor
    const porForn = {}
    for(const l of lotes){
      if(!porForn[l.fornecedor]) porForn[l.fornecedor]={fornecedor:l.fornecedor,lotes:0,latas:0,litros:0,pago:0,pesoLiq:0,regioes:new Set()}
      const f=porForn[l.fornecedor]
      f.lotes++
      f.latas+=Number(l.latas_processadas||0)
      f.litros+=Number(l.litros_extraidos||0)
      f.pago+=Number(l.total_estimado||0)
      f.pesoLiq+=Number(l.peso_liquido_kg||0)
      if(l.regiao)f.regioes.add(l.regiao)
    }
    const fornecedores = Object.values(porForn).map(f=>({
      ...f,
      regioes: [...f.regioes].join(', '),
      rendimento: f.latas>0?(f.litros/f.latas).toFixed(2):null,
      custo_litro: f.litros>0?(f.pago/f.litros).toFixed(4):null
    })).sort((a,b)=>Number(a.custo_litro)-Number(b.custo_litro))

    // 4. Por dia
    const porDia = {}
    for(const l of lotes){
      const d=String(l.data)
      if(!porDia[d]) porDia[d]={data:d,lotes:0,latas:0,litros:0,pago:0}
      porDia[d].lotes++
      porDia[d].latas+=Number(l.latas_processadas||0)
      porDia[d].litros+=Number(l.litros_extraidos||0)
      porDia[d].pago+=Number(l.total_estimado||0)
    }
    const porDiaArr = Object.values(porDia).sort((a,b)=>a.data.localeCompare(b.data)).map(d=>({
      ...d,
      rendimento: d.latas>0?(d.litros/d.latas).toFixed(2):null,
      custo_litro: d.litros>0?(d.pago/d.litros).toFixed(4):null
    }))

    res.json({
      periodo:{inicio,fim},
      resumo:{
        total_lotes:lotes.length,
        total_lotes_despolpados:lotesFin.length,
        total_latas:totalLatas,
        total_litros:Number(totalLitros.toFixed(1)),
        total_pago:Number(totalPago.toFixed(2)),
        total_peso_liquido_kg:Number(totalPesoLiq.toFixed(1)),
        custo_medio_litro:Number(custoMedioLitro.toFixed(4)),
        rendimento_medio_lata:Number(rendMedioLata.toFixed(2))
      },
      por_fornecedor:fornecedores,
      por_dia:porDiaArr,
      lotes_detalhado:lotes
    })
  } catch(err) {
    console.error(err)
    res.status(500).json({erro:'Erro ao gerar relatório.'})
  }
})

module.exports = router
