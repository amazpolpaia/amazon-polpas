-- PASSO 2 — Só depois do PASSO 1 (5 perfis OK)
-- Copie ESTE ARQUIVO INTEIRO, cole, Run.
-- No final TEM QUE mostrar 2 linhas.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
VALUES (
  'João Mendes',
  'joao@amazonpolpas.com.br',
  '$2a$10$2Qa9qhbnNXCcmx.NRLnSruwH.zeknc61/0GK/v3mfmyQ31BrK3kqy',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE, FALSE, FALSE
)
ON CONFLICT (email) DO UPDATE SET
  senha_hash = EXCLUDED.senha_hash,
  perfil_id = EXCLUDED.perfil_id,
  ativo = TRUE;

INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
VALUES (
  'Igor Queiroz',
  'igor.queiroz@amazonpolpas.com.br',
  '$2a$10$azM8wQm7fNA5WK9rQQvBV.XEhaC9Y9NUWUtI9AhkrTz5FU4pePfQW',
  (SELECT id FROM perfis WHERE nome = 'gerente' LIMIT 1),
  TRUE, FALSE, TRUE
)
ON CONFLICT (email) DO UPDATE SET
  senha_hash = EXCLUDED.senha_hash,
  perfil_id = EXCLUDED.perfil_id,
  ativo = TRUE,
  pode_gerenciar_usuarios = TRUE;

SELECT email, ativo FROM usuarios
WHERE email IN ('joao@amazonpolpas.com.br', 'igor.queiroz@amazonpolpas.com.br');
