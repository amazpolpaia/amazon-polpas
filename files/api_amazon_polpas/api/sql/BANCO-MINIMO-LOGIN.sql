-- ============================================================
-- RAILWAY → POSTGRES → QUERY → cole TUDO → RUN
-- Se no final aparecer 2 linhas, o login vai funcionar.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Perfis (obrigatório antes dos usuários)
INSERT INTO perfis (nome, descricao) VALUES
  ('gerente',   'Acesso total'),
  ('comprador', 'Compras'),
  ('balanca',   'Balança'),
  ('recepcao',  'Recepção'),
  ('producao',  'Produção')
ON CONFLICT (nome) DO NOTHING;

-- Colunas novas (se a tabela já existir sem elas)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

-- João — senha: Admin@2025
INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
SELECT
  'João Mendes',
  'joao@amazonpolpas.com.br',
  '$2a$10$2Qa9qhbnNXCcmx.NRLnSruwH.zeknc61/0GK/v3mfmyQ31BrK3kqy',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE,
  FALSE,
  FALSE
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'joao@amazonpolpas.com.br');

UPDATE usuarios SET
  senha_hash = '$2a$10$2Qa9qhbnNXCcmx.NRLnSruwH.zeknc61/0GK/v3mfmyQ31BrK3kqy',
  perfil_id = (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  ativo = TRUE
WHERE email = 'joao@amazonpolpas.com.br';

-- Igor — senha: Iqs563160
INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
SELECT
  'Igor Queiroz',
  'igor.queiroz@amazonpolpas.com.br',
  '$2a$10$azM8wQm7fNA5WK9rQQvBV.XEhaC9Y9NUWUtI9AhkrTz5FU4pePfQW',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE,
  FALSE,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'igor.queiroz@amazonpolpas.com.br');

UPDATE usuarios SET
  senha_hash = '$2a$10$azM8wQm7fNA5WK9rQQvBV.XEhaC9Y9NUWUtI9AhkrTz5FU4pePfQW',
  perfil_id = (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  ativo = TRUE,
  ocultar_valores = FALSE,
  pode_gerenciar_usuarios = TRUE
WHERE email = 'igor.queiroz@amazonpolpas.com.br';

-- DIAGNÓSTICO (tem que mostrar 2 linhas):
SELECT email, ativo,
  (SELECT nome FROM perfis p WHERE p.id = u.perfil_id) AS perfil
FROM usuarios u
WHERE email IN ('joao@amazonpolpas.com.br', 'igor.queiroz@amazonpolpas.com.br');
