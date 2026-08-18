// Migracoes idempotentes executadas no boot.
// Seguras para rodar sempre: todas usam IF NOT EXISTS.
// Motivo: o editor SQL do Railway e instavel; assim o schema se corrige sozinho.
const pool = require('./pool')

const MIGRACOES = [
  ['compras.placa', 'ALTER TABLE compras ADD COLUMN IF NOT EXISTS placa VARCHAR(10)'],
  [
    'compras.frete_no_saldo',
    'ALTER TABLE compras ADD COLUMN IF NOT EXISTS frete_no_saldo BOOLEAN NOT NULL DEFAULT FALSE',
  ],
  [
    'usuarios.pode_ver_financeiro',
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_ver_financeiro BOOLEAN NOT NULL DEFAULT FALSE',
  ],
  [
    'pagamentos',
    `CREATE TABLE IF NOT EXISTS pagamentos (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       fornecedor_id INT NOT NULL REFERENCES fornecedores(id),
       data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
       valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
       forma VARCHAR(30),
       observacoes TEXT,
       registrado_por UUID REFERENCES usuarios(id),
       criado_em TIMESTAMPTZ DEFAULT NOW()
     )`,
  ],
  [
    'pagamentos.unidade_fabril',
    'ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS unidade_fabril VARCHAR(40)',
  ],
  [
    'idx_pagamentos_fornecedor',
    'CREATE INDEX IF NOT EXISTS idx_pagamentos_fornecedor ON pagamentos(fornecedor_id)',
  ],
  [
    'idx_pagamentos_data',
    'CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento)',
  ],
]

async function rodarMigracoes() {
  const falhas = []
  for (const [nome, sql] of MIGRACOES) {
    try {
      await pool.query(sql)
    } catch (err) {
      falhas.push(nome)
      console.error(`[migracao] falhou: ${nome} -> ${err.message}`)
    }
  }
  if (falhas.length) console.error(`[migracao] ${falhas.length} falha(s): ${falhas.join(', ')}`)
  else console.log(`[migracao] schema conferido (${MIGRACOES.length} itens)`)
}

module.exports = { rodarMigracoes }
