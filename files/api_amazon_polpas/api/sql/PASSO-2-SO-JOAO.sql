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
