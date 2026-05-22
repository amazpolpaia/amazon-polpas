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
