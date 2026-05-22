-- PASSO 0 — Rode PRIMEIRO para ver se o banco tem tabelas.
-- Se der ERRO "relation perfis does not exist", avise — precisa importar amazon_polpas_banco.sql

SELECT COUNT(*) AS total_perfis FROM perfis;
SELECT COUNT(*) AS total_usuarios FROM usuarios;
