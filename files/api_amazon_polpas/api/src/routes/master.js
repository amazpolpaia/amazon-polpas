const router = require('express').Router()
const pool = require('../db/pool')
const bcrypt = require('bcryptjs')
const { autenticar, autorizar } = require('../middleware/auth')

// PUT /auth/usuarios/:id
router.put('/usuarios/:id', autenticar, autorizar('gerente'), async (req, res) => {
  const { nome, email, senha, ativo } = req.body
  try {
    let query, params
    if (senha) {
      const hash = await bcrypt.hash(senha, 10)
      query = `UPDATE usuarios SET nome=$1, email=$2, senha_hash=$3, ativo=$4, atualizado_em=NOW() WHERE id=$5 RETURNING id, nome, email, ativo`
      params = [nome, email.toLowerCase(), hash, ativo, req.params.id]
    } else {
      query = `UPDATE usuarios SET nome=$1, email=$2, ativo=$3, atualizado_em=NOW() WHERE id=$4 RETURNING id, nome, email, ativo`
      params = [nome, email.toLowerCase(), ativo, req.params.id]
    }
    const { rows } = await pool.query(query, params)
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'E-mail já cadastrado.' })
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' })
  }
})

// PUT /compras/:lote_id
router.put('/compras/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete, unidade_fabril, observacoes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE compras SET qtd_latas_prevista=$1, preco_por_lata=$2, regiao=$3, tipo_frete=$4, valor_frete=$5, unidade_fabril=$6, observacoes=$7 WHERE lote_id=$8 RETURNING *`,
      [qtd_latas_prevista, preco_por_lata, regiao, tipo_frete, valor_frete || 0, unidade_fabril || 'amazon_polpas', observacoes, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Compra não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar compra.' })
  }
})

// PUT /pesagens/chegada/:lote_id
router.put('/pesagens/chegada/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { peso_bruto_kg, placa_veiculo, tara_kg, observacoes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE pesagens_chegada SET peso_bruto_kg=$1, placa_veiculo=$2, tara_kg=$3, observacoes=$4 WHERE lote_id=$5 RETURNING *`,
      [peso_bruto_kg, placa_veiculo, tara_kg, observacoes, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Pesagem não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar pesagem de chegada.' })
  }
})

// PUT /pesagens/saida/:lote_id
router.put('/pesagens/saida/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { peso_saida_kg, observacoes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE pesagens_saida SET peso_saida_kg=$1, observacoes=$2 WHERE lote_id=$3 RETURNING *`,
      [peso_saida_kg, observacoes, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Pesagem de saída não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar pesagem de saída.' })
  }
})

// PUT /recepcoes/:lote_id
router.put('/recepcoes/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { qtd_latas_recebidas, condicao_fruto, observacoes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE recepcoes SET qtd_latas_recebidas=$1, condicao_fruto=$2, observacoes=$3 WHERE lote_id=$4 RETURNING *`,
      [qtd_latas_recebidas, condicao_fruto, observacoes, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Recepção não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar recepção.' })
  }
})

// PUT /producao/despolpamento/:lote_id
router.put('/producao/despolpamento/:lote_id', autenticar, autorizar('gerente'), async (req, res) => {
  const { latas_processadas, litros_extraidos, turno, operador_nome, observacoes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE despolpamentos SET latas_processadas=$1, litros_extraidos=$2, turno=$3, operador_nome=$4, observacoes=$5 WHERE lote_id=$6 RETURNING *`,
      [latas_processadas, litros_extraidos, turno, operador_nome, observacoes, req.params.lote_id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Despolpamento não encontrado.' })
    await pool.query(
      `UPDATE rendimentos SET litros_extraidos=$1, rendimento_l_lata=$1/NULLIF($2,0) WHERE lote_id=$3`,
      [litros_extraidos, latas_processadas, req.params.lote_id]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar despolpamento.' })
  }
})


// DELETE /lotes/:id — remove lote e todos os registros vinculados
router.delete('/:id', autenticar, autorizar('gerente'), async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM rendimentos WHERE lote_id=$1', [id])
    await client.query('DELETE FROM despolpamentos WHERE lote_id=$1', [id])
    await client.query('DELETE FROM pesagens_saida WHERE lote_id=$1', [id])
    await client.query('DELETE FROM recepcoes WHERE lote_id=$1', [id])
    await client.query('DELETE FROM pesagens_chegada WHERE lote_id=$1', [id])
    await client.query('DELETE FROM compras WHERE lote_id=$1', [id])
    const hasPagTab = await client.query("SELECT to_regclass('public.pagamentos_fornecedores')")
    if(hasPagTab.rows[0].to_regclass) await client.query('DELETE FROM pagamentos_fornecedores WHERE lote_id=$1', [id])
    const { rows } = await client.query('DELETE FROM lotes WHERE id=$1 RETURNING id', [id])
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ erro: 'Lote não encontrado.' }) }
    await client.query('COMMIT')
    res.json({ ok: true, id })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ erro: 'Erro ao cancelar lote.' })
  } finally { client.release() }
})

// PUT /fornecedores/:id — atualizar dados do fornecedor
router.put('/:id', autenticar, autorizar('gerente'), async (req, res) => {
  const { nome, municipio, estado, contato_nome, telefone, ativo } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
  try {
    const { rows } = await pool.query(
      'UPDATE fornecedores SET nome=$1, municipio=$2, estado=$3, contato_nome=$4, telefone=$5, ativo=$6 WHERE id=$7 RETURNING *',
      [nome, municipio||null, estado||'PA', contato_nome||null, telefone||null, ativo!==false, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ erro: 'Erro ao atualizar fornecedor.' }) }
})

// DELETE /fornecedores/:id — excluir fornecedor sem lotes
router.delete('/:id', autenticar, autorizar('gerente'), async (req, res) => {
  try {
    const { rows: lotes } = await pool.query('SELECT id FROM lotes WHERE fornecedor_id=$1 LIMIT 1', [req.params.id])
    if (lotes.length > 0) return res.status(409).json({ erro: 'Fornecedor possui lotes vinculados e não pode ser excluído.' })
    const { rows } = await pool.query('DELETE FROM fornecedores WHERE id=$1 RETURNING id', [req.params.id])
    if (!rows[0]) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ erro: 'Erro ao excluir fornecedor.' }) }
})

module.exports = router
