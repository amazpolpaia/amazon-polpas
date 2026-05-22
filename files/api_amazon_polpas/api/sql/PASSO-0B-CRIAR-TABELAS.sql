-- PASSO 0B — Só se o PASSO 0 deu erro "relation ... does not exist"
-- Copie TUDO, Run. Deve aparecer: status = tabelas_ok

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS perfis (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(50) NOT NULL UNIQUE,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  perfil_id     INT NOT NULL REFERENCES perfis(id),
  ativo         BOOLEAN DEFAULT TRUE,
  ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_acesso TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'tabelas_ok' AS status;
