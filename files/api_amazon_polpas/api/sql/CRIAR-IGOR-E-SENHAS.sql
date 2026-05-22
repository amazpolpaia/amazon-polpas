-- Railway → Postgres → Query → cole TUDO → Run
-- Depois F5 no site e entre com Igor ou João.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

-- João — senha: Admin@2025
UPDATE usuarios SET
  senha_hash = '$2a$10$THBYHDEM0Pr0rl5SMYqZZe.bg0xQZRkjUYPNgos8dcaQg46StaWC2',
  ativo = TRUE
WHERE email = 'joao@amazonpolpas.com.br';

-- Igor — senha: Iqs563160 (cria se não existir)
INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, ocultar_valores, pode_gerenciar_usuarios)
SELECT
  'Igor Queiroz',
  'igor.queiroz@amazonpolpas.com.br',
  '$2a$10$pWAHvL.k0nQBfIZ5GE1za.ldwX8OghOiubwIcodch6cx/eRRmXYxS',
  (SELECT id FROM perfis WHERE nome = 'gerente'),
  TRUE,
  FALSE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'igor.queiroz@amazonpolpas.com.br'
);

UPDATE usuarios SET
  senha_hash = '$2a$10$pWAHvL.k0nQBfIZ5GE1za.ldwX8OghOiubwIcodch6cx/eRRmXYxS',
  perfil_id = (SELECT id FROM perfis WHERE nome = 'gerente'),
  ativo = TRUE,
  ocultar_valores = FALSE,
  pode_gerenciar_usuarios = TRUE
WHERE email = 'igor.queiroz@amazonpolpas.com.br';

-- TEM QUE APARECER 2 LINHAS:
SELECT email, ativo FROM usuarios
WHERE email IN ('joao@amazonpolpas.com.br', 'igor.queiroz@amazonpolpas.com.br');
