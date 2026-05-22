-- ============================================================
--  AMAZON POLPAS — Banco de Dados Completo
--  PostgreSQL 14+
--  Gerado em: 2025-05-20
-- ============================================================

-- ============================================================
--  EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
--  1. USUÁRIOS E CONTROLE DE ACESSO
-- ============================================================

CREATE TABLE perfis (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(50) NOT NULL UNIQUE,
    -- Valores: 'gerente', 'comprador', 'balanca', 'recepcao', 'producao'
    descricao   TEXT,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO perfis (nome, descricao) VALUES
  ('gerente',   'Acesso total ao sistema — leitura e edição de todos os módulos'),
  ('comprador', 'Registra e consulta ordens de compra e relatório final'),
  ('balanca',   'Opera os módulos de pesagem (chegada e saída)'),
  ('recepcao',  'Registra o descarregamento e contagem de latas'),
  ('producao',  'Registra despolpamento e rendimento');


CREATE TABLE usuarios (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    senha_hash    TEXT NOT NULL,           -- bcrypt hash
    perfil_id     INT NOT NULL REFERENCES perfis(id),
    ativo         BOOLEAN DEFAULT TRUE,
    ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
    pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_acesso TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para login por e-mail
CREATE INDEX idx_usuarios_email ON usuarios(email);


-- ============================================================
--  2. FORNECEDORES
-- ============================================================

CREATE TABLE fornecedores (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(150) NOT NULL,
    municipio     VARCHAR(100),
    estado        CHAR(2) DEFAULT 'PA',
    contato_nome  VARCHAR(100),
    contato_fone  VARCHAR(20),
    contato_email VARCHAR(150),
    ativo         BOOLEAN DEFAULT TRUE,
    observacoes   TEXT,
    criado_em     TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO fornecedores (nome, municipio, contato_nome, contato_fone) VALUES
  ('Fazenda São Lucas',  'Cametá',      'João Silva',   '(91) 99000-0001'),
  ('Sítio Beija-Flor',   'Moju',        'Maria Costa',  '(91) 99000-0002'),
  ('Chácara Boa Vista',  'Abaetetuba',  'Carlos Nunes', '(91) 99000-0003');


-- ============================================================
--  3. LOTE DE ENTREGA
--  Entidade central que conecta todos os módulos.
--  Cada caminhão que chega gera um lote.
-- ============================================================

CREATE TABLE lotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    -- ex: LOTE-20250520-SL-001
    fornecedor_id   INT NOT NULL REFERENCES fornecedores(id),
    data_operacao   DATE NOT NULL DEFAULT CURRENT_DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'aberto',
    -- Status: 'aberto' | 'em_descarga' | 'descarregado' | 'despolpado' | 'encerrado'
    observacoes     TEXT,
    criado_por      UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lotes_fornecedor ON lotes(fornecedor_id);
CREATE INDEX idx_lotes_data       ON lotes(data_operacao);
CREATE INDEX idx_lotes_status     ON lotes(status);


-- ============================================================
--  4. MÓDULO 1 — COMPRA DE FRUTO
-- ============================================================

CREATE TABLE compras (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id             UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    fornecedor_id       INT  NOT NULL REFERENCES fornecedores(id),
    data_negociacao     DATE NOT NULL DEFAULT CURRENT_DATE,
    data_entrega_prev   DATE,
    qtd_latas_prevista  INT  NOT NULL CHECK (qtd_latas_prevista > 0),
    preco_por_lata      NUMERIC(10,2) NOT NULL CHECK (preco_por_lata > 0),
    total_estimado      NUMERIC(12,2) GENERATED ALWAYS AS
                        (qtd_latas_prevista * preco_por_lata) STORED,
    condicao_acordada   VARCHAR(50),   -- ex: 'Ótima', 'Boa', 'Regular'
    observacoes         TEXT,
    registrado_por      UUID REFERENCES usuarios(id),
    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compras_lote       ON compras(lote_id);
CREATE INDEX idx_compras_fornecedor ON compras(fornecedor_id);
CREATE INDEX idx_compras_data       ON compras(data_negociacao);


-- ============================================================
--  5. MÓDULO 2 — BALANÇA CHEGADA
-- ============================================================

CREATE TABLE pesagens_chegada (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id         UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    placa_veiculo   VARCHAR(10),
    hora_chegada    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    peso_bruto_kg   NUMERIC(10,2) NOT NULL CHECK (peso_bruto_kg > 0),
    tara_kg         NUMERIC(10,2),      -- tara informada na chegada (opcional)
    observacoes     TEXT,
    registrado_por  UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pchegada_lote ON pesagens_chegada(lote_id);
-- Um lote tem apenas uma pesagem de chegada


-- ============================================================
--  6. MÓDULO 3 — RECEPÇÃO DE FRUTO
-- ============================================================

CREATE TABLE recepcoes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id             UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    qtd_latas_recebidas INT  NOT NULL CHECK (qtd_latas_recebidas >= 0),
    condicao_fruto      VARCHAR(20),
    -- 'otima' | 'boa' | 'regular' | 'ruim'
    hora_inicio         TIMESTAMPTZ,
    hora_fim            TIMESTAMPTZ,
    observacoes         TEXT,
    registrado_por      UUID REFERENCES usuarios(id),
    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_recepcao_lote ON recepcoes(lote_id);


-- ============================================================
--  7. MÓDULO 4 — BALANÇA SAÍDA
-- ============================================================

CREATE TABLE pesagens_saida (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id         UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    hora_saida      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    peso_saida_kg   NUMERIC(10,2) NOT NULL CHECK (peso_saida_kg > 0),

    -- Peso líquido calculado automaticamente pelo banco
    peso_liquido_kg NUMERIC(10,2) GENERATED ALWAYS AS (
        NULL  -- será atualizado via trigger (veja abaixo)
    ) STORED,

    divergencia_kg  NUMERIC(10,2),
    -- Diferença entre peso líquido e (latas_recebidas × 14 kg)
    observacoes     TEXT,
    registrado_por  UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- O campo peso_liquido_kg é calculado via trigger porque depende
-- de pesagens_chegada (tabela diferente). Removemos a coluna gerada
-- e usamos uma coluna normal + trigger:
ALTER TABLE pesagens_saida DROP COLUMN peso_liquido_kg;
ALTER TABLE pesagens_saida ADD COLUMN peso_liquido_kg NUMERIC(10,2);

CREATE UNIQUE INDEX idx_psaida_lote ON pesagens_saida(lote_id);

-- Trigger: calcula peso_liquido_kg ao inserir/atualizar pesagem de saída
CREATE OR REPLACE FUNCTION fn_calc_peso_liquido()
RETURNS TRIGGER AS $$
DECLARE
    v_peso_bruto NUMERIC(10,2);
BEGIN
    SELECT peso_bruto_kg INTO v_peso_bruto
    FROM pesagens_chegada
    WHERE lote_id = NEW.lote_id;

    IF v_peso_bruto IS NOT NULL THEN
        NEW.peso_liquido_kg := v_peso_bruto - NEW.peso_saida_kg;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_peso_liquido
BEFORE INSERT OR UPDATE ON pesagens_saida
FOR EACH ROW EXECUTE FUNCTION fn_calc_peso_liquido();


-- ============================================================
--  8. MÓDULO 5 — DESPOLPAMENTO
-- ============================================================

CREATE TABLE despolpamentos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id             UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    latas_processadas   INT          NOT NULL CHECK (latas_processadas > 0),
    litros_extraidos    NUMERIC(10,2) NOT NULL CHECK (litros_extraidos > 0),

    -- Rendimento calculado automaticamente
    rendimento_l_lata   NUMERIC(8,4) GENERATED ALWAYS AS
                        (litros_extraidos / latas_processadas) STORED,

    turno               VARCHAR(20),
    -- 'manha' (06h-14h) | 'tarde' (14h-22h)
    operador_nome       VARCHAR(100),
    hora_inicio         TIMESTAMPTZ,
    hora_fim            TIMESTAMPTZ,
    observacoes         TEXT,
    registrado_por      UUID REFERENCES usuarios(id),
    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_despolp_lote ON despolpamentos(lote_id);


-- ============================================================
--  9. MÓDULO 6 — RENDIMENTO (CUSTO POR LITRO)
-- ============================================================

CREATE TABLE rendimentos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id             UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    fornecedor_id       INT  NOT NULL REFERENCES fornecedores(id),
    data_operacao       DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Dados consolidados do lote
    latas_recebidas     INT           NOT NULL,
    preco_por_lata      NUMERIC(10,2) NOT NULL,
    total_pago          NUMERIC(12,2) GENERATED ALWAYS AS
                        (latas_recebidas * preco_por_lata) STORED,
    litros_extraidos    NUMERIC(10,2) NOT NULL,
    rendimento_l_lata   NUMERIC(8,4)  NOT NULL,

    -- Custo por litro = preco_por_lata / rendimento_l_lata
    custo_por_litro     NUMERIC(10,4) GENERATED ALWAYS AS
                        (preco_por_lata / NULLIF(rendimento_l_lata, 0)) STORED,

    calculado_por       UUID REFERENCES usuarios(id),
    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rendimento_lote ON rendimentos(lote_id);
CREATE INDEX idx_rendimento_data        ON rendimentos(data_operacao);
CREATE INDEX idx_rendimento_fornecedor  ON rendimentos(fornecedor_id);


-- ============================================================
--  10. MÓDULO 7 — RELATÓRIO DIÁRIO (FECHAMENTO)
-- ============================================================

CREATE TABLE relatorios_diarios (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_operacao           DATE NOT NULL UNIQUE,
    status                  VARCHAR(20) DEFAULT 'aberto',
    -- 'aberto' | 'fechado'

    -- Totais do dia (preenchidos ao fechar)
    total_fornecedores      INT,
    total_latas_recebidas   INT,
    total_litros_extraidos  NUMERIC(12,2),
    total_valor_pago        NUMERIC(14,2),

    -- Média ponderada: Σ(preco × latas) / Σ(litros)
    custo_medio_litro       NUMERIC(10,4),
    rendimento_medio_l_lata NUMERIC(8,4),

    melhor_fornecedor_id    INT REFERENCES fornecedores(id),
    melhor_custo_litro      NUMERIC(10,4),

    observacoes             TEXT,
    fechado_por             UUID REFERENCES usuarios(id),
    fechado_em              TIMESTAMPTZ,
    criado_em               TIMESTAMPTZ DEFAULT NOW()
);


-- Tabela de itens do relatório (um por fornecedor por dia)
CREATE TABLE relatorio_itens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    relatorio_id        UUID NOT NULL REFERENCES relatorios_diarios(id)
                        ON DELETE CASCADE,
    fornecedor_id       INT  NOT NULL REFERENCES fornecedores(id),
    lote_id             UUID REFERENCES lotes(id),

    latas_recebidas     INT,
    preco_por_lata      NUMERIC(10,2),
    total_pago          NUMERIC(12,2),
    litros_extraidos    NUMERIC(10,2),
    rendimento_l_lata   NUMERIC(8,4),
    custo_por_litro     NUMERIC(10,4),

    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rel_itens_relatorio   ON relatorio_itens(relatorio_id);
CREATE INDEX idx_rel_itens_fornecedor  ON relatorio_itens(fornecedor_id);


-- ============================================================
--  11. VIEWS ÚTEIS
-- ============================================================

-- View: resumo completo de um lote
CREATE OR REPLACE VIEW vw_lotes_resumo AS
SELECT
    l.id                                        AS lote_id,
    l.codigo,
    l.data_operacao,
    l.status,
    f.nome                                      AS fornecedor,
    f.municipio,

    -- Compra
    c.qtd_latas_prevista,
    c.preco_por_lata,
    c.total_estimado,

    -- Pesagem chegada
    pc.hora_chegada,
    pc.peso_bruto_kg,
    pc.placa_veiculo,

    -- Recepção
    r.qtd_latas_recebidas,
    r.condicao_fruto,

    -- Pesagem saída
    ps.hora_saida,
    ps.peso_saida_kg,
    ps.peso_liquido_kg,

    -- Despolpamento
    d.litros_extraidos,
    d.rendimento_l_lata,
    d.turno,

    -- Rendimento (custo)
    rd.custo_por_litro,
    rd.total_pago

FROM lotes l
JOIN fornecedores       f  ON f.id  = l.fornecedor_id
LEFT JOIN compras       c  ON c.lote_id = l.id
LEFT JOIN pesagens_chegada pc ON pc.lote_id = l.id
LEFT JOIN recepcoes     r  ON r.lote_id = l.id
LEFT JOIN pesagens_saida ps ON ps.lote_id = l.id
LEFT JOIN despolpamentos d  ON d.lote_id = l.id
LEFT JOIN rendimentos   rd ON rd.lote_id = l.id;


-- View: média ponderada do dia (cálculo do relatório final)
CREATE OR REPLACE VIEW vw_media_ponderada_dia AS
SELECT
    rd.data_operacao,
    COUNT(*)                                        AS qtd_fornecedores,
    SUM(rd.latas_recebidas)                         AS total_latas,
    SUM(rd.litros_extraidos)                        AS total_litros,
    SUM(rd.total_pago)                              AS total_valor,

    -- Média ponderada do custo por litro
    ROUND(
        SUM(rd.total_pago) / NULLIF(SUM(rd.litros_extraidos), 0)
    , 4)                                            AS custo_medio_litro,

    -- Média ponderada do rendimento L/lata
    ROUND(
        SUM(rd.litros_extraidos) / NULLIF(SUM(rd.latas_recebidas), 0)
    , 4)                                            AS rendimento_medio_l_lata,

    -- Melhor custo do dia
    MIN(rd.custo_por_litro)                         AS melhor_custo_litro

FROM rendimentos rd
GROUP BY rd.data_operacao
ORDER BY rd.data_operacao DESC;


-- View: histórico de desempenho por fornecedor
CREATE OR REPLACE VIEW vw_desempenho_fornecedores AS
SELECT
    f.id                            AS fornecedor_id,
    f.nome                          AS fornecedor,
    f.municipio,
    COUNT(rd.id)                    AS total_lotes,
    SUM(rd.latas_recebidas)         AS total_latas,
    SUM(rd.litros_extraidos)        AS total_litros,
    ROUND(AVG(rd.rendimento_l_lata), 2) AS media_rendimento,
    ROUND(AVG(rd.custo_por_litro),  4)  AS media_custo_litro,
    MIN(rd.custo_por_litro)         AS melhor_custo,
    MAX(rd.custo_por_litro)         AS pior_custo,
    MAX(rd.data_operacao)           AS ultimo_lote
FROM fornecedores f
LEFT JOIN rendimentos rd ON rd.fornecedor_id = f.id
GROUP BY f.id, f.nome, f.municipio
ORDER BY media_custo_litro ASC NULLS LAST;


-- ============================================================
--  12. FUNÇÃO: FECHAR DIA (gera relatório diário)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_fechar_dia(
    p_data          DATE,
    p_usuario_id    UUID
)
RETURNS UUID AS $$
DECLARE
    v_relatorio_id UUID;
    v_resumo       RECORD;
    v_item         RECORD;
BEGIN
    -- Verifica se já existe relatório para o dia
    IF EXISTS (SELECT 1 FROM relatorios_diarios WHERE data_operacao = p_data) THEN
        RAISE EXCEPTION 'Relatório para % já foi gerado.', p_data;
    END IF;

    -- Calcula resumo do dia
    SELECT
        COUNT(*)                                                AS qtd_forn,
        SUM(latas_recebidas)                                    AS tot_latas,
        SUM(litros_extraidos)                                   AS tot_litros,
        SUM(total_pago)                                         AS tot_valor,
        ROUND(SUM(total_pago) / NULLIF(SUM(litros_extraidos),0), 4) AS custo_medio,
        ROUND(SUM(litros_extraidos)/NULLIF(SUM(latas_recebidas),0),4) AS rend_medio,
        (SELECT fornecedor_id FROM rendimentos
         WHERE data_operacao = p_data
         ORDER BY custo_por_litro ASC LIMIT 1)                 AS melhor_forn_id,
        MIN(custo_por_litro)                                    AS melhor_custo
    INTO v_resumo
    FROM rendimentos
    WHERE data_operacao = p_data;

    -- Insere cabeçalho do relatório
    INSERT INTO relatorios_diarios (
        data_operacao, status,
        total_fornecedores, total_latas_recebidas,
        total_litros_extraidos, total_valor_pago,
        custo_medio_litro, rendimento_medio_l_lata,
        melhor_fornecedor_id, melhor_custo_litro,
        fechado_por, fechado_em
    ) VALUES (
        p_data, 'fechado',
        v_resumo.qtd_forn, v_resumo.tot_latas,
        v_resumo.tot_litros, v_resumo.tot_valor,
        v_resumo.custo_medio, v_resumo.rend_medio,
        v_resumo.melhor_forn_id, v_resumo.melhor_custo,
        p_usuario_id, NOW()
    )
    RETURNING id INTO v_relatorio_id;

    -- Insere itens (um por fornecedor/lote)
    FOR v_item IN
        SELECT * FROM rendimentos WHERE data_operacao = p_data
    LOOP
        INSERT INTO relatorio_itens (
            relatorio_id, fornecedor_id, lote_id,
            latas_recebidas, preco_por_lata, total_pago,
            litros_extraidos, rendimento_l_lata, custo_por_litro
        ) VALUES (
            v_relatorio_id, v_item.fornecedor_id, v_item.lote_id,
            v_item.latas_recebidas, v_item.preco_por_lata, v_item.total_pago,
            v_item.litros_extraidos, v_item.rendimento_l_lata, v_item.custo_por_litro
        );

        -- Encerra os lotes do dia
        UPDATE lotes SET status = 'encerrado', atualizado_em = NOW()
        WHERE id = v_item.lote_id;
    END LOOP;

    RETURN v_relatorio_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
--  13. DADOS DE EXEMPLO (remover em produção)
-- ============================================================

-- Usuário gerente para primeiro acesso (senha: Admin@2025)
INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES
  ('João Mendes',   'joao@amazonpolpas.com.br',
   crypt('Admin@2025', gen_salt('bf')),
   (SELECT id FROM perfis WHERE nome = 'gerente')),
  ('Ana Compras',   'ana@amazonpolpas.com.br',
   crypt('Compra@2025', gen_salt('bf')),
   (SELECT id FROM perfis WHERE nome = 'comprador')),
  ('Pedro Balança', 'pedro@amazonpolpas.com.br',
   crypt('Balanca@2025', gen_salt('bf')),
   (SELECT id FROM perfis WHERE nome = 'balanca'));


-- ============================================================
--  FIM DO SCRIPT
-- ============================================================
-- Tabelas criadas:
--   perfis, usuarios
--   fornecedores
--   lotes
--   compras               (módulo 1)
--   pesagens_chegada      (módulo 2)
--   recepcoes             (módulo 3)
--   pesagens_saida        (módulo 4 — com trigger peso_liquido)
--   despolpamentos        (módulo 5)
--   rendimentos           (módulo 6)
--   relatorios_diarios    (módulo 7)
--   relatorio_itens       (módulo 7)
--
-- Views criadas:
--   vw_lotes_resumo
--   vw_media_ponderada_dia
--   vw_desempenho_fornecedores
--
-- Funções:
--   fn_calc_peso_liquido()  — trigger automático
--   fn_fechar_dia()         — fecha o dia e gera relatório
-- ============================================================
