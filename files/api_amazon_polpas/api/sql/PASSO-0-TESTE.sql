-- PASSO 0 — Copie TUDO, Run. Deve aparecer 1 linha com números.
-- Se der ERRO "does not exist" → rode PASSO-0B-CRIAR-TABELAS.sql primeiro.

SELECT
  (SELECT COUNT(*) FROM perfis)   AS total_perfis,
  (SELECT COUNT(*) FROM usuarios) AS total_usuarios;
