-- Execute no Postgres (Railway ou local) UMA vez após o banco base existir.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

-- Igor: administrador principal (gerencia usuários e vê todos os valores)
INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
SELECT
  'Igor Queiroz',
  'igor.queiroz@amazonpolpas.com.br',
  '$2a$10$6BKo8tMQouCDy3pCnUhQFeGWX5caNfGhtzCHvb4UOLVP5aU4Vj1/C',
  (SELECT id FROM perfis WHERE nome = 'gerente'),
  TRUE,
  FALSE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'igor.queiroz@amazonpolpas.com.br'
);

-- Garante flags no Igor se o registro já existia
UPDATE usuarios SET
  perfil_id = (SELECT id FROM perfis WHERE nome = 'gerente'),
  ativo = TRUE,
  ocultar_valores = FALSE,
  pode_gerenciar_usuarios = TRUE
WHERE email = 'igor.queiroz@amazonpolpas.com.br';
