-- Rode PRIMEIRO se der erro ou 0 linhas no login.
-- Mostra o que existe no banco.

SELECT 'perfis' AS tabela, COUNT(*)::text AS total FROM perfis
UNION ALL
SELECT 'usuarios', COUNT(*)::text FROM usuarios;

SELECT id, nome FROM perfis ORDER BY id;

SELECT email, ativo FROM usuarios ORDER BY email;
