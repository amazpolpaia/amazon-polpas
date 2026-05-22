-- Rode DEPOIS de importar amazon_polpas_banco.sql (ou se as tabelas já existem).
-- Cria perfis, colunas novas, João, Igor e senhas que funcionam no login.

INSERT INTO perfis (nome, descricao) VALUES
  ('gerente', 'Acesso total'),
  ('comprador', 'Compras'),
  ('balanca', 'Balança'),
  ('recepcao', 'Recepção'),
  ('producao', 'Produção')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
VALUES (
  'João Mendes', 'joao@amazonpolpas.com.br',
  '$2a$10$2Qa9qhbnNXCcmx.NRLnSruwH.zeknc61/0GK/v3mfmyQ31BrK3kqy',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE, FALSE, FALSE
)
ON CONFLICT (email) DO UPDATE SET
  senha_hash = EXCLUDED.senha_hash, perfil_id = EXCLUDED.perfil_id, ativo = TRUE;

INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
VALUES (
  'Igor Queiroz', 'igor.queiroz@amazonpolpas.com.br',
  '$2a$10$azM8wQm7fNA5WK9rQQvBV.XEhaC9Y9NUWUtI9AhkrTz5FU4pePfQW',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE, FALSE, TRUE
)
ON CONFLICT (email) DO UPDATE SET
  senha_hash = EXCLUDED.senha_hash,
  perfil_id = EXCLUDED.perfil_id,
  ativo = TRUE,
  pode_gerenciar_usuarios = TRUE;
