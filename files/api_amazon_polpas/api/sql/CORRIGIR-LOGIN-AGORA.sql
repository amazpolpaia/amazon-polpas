-- COLE TUDO NO RAILWAY → POSTGRES → QUERY → RUN
-- Depois teste o login (F5 na página do site).

UPDATE usuarios SET senha_hash = '$2a$10$EmI6C/gQK8zUYRSDfIsoKu6fDO1O/uPXpsFMeUOnDwlrAgf55/lsK'
WHERE email = 'joao@amazonpolpas.com.br';

UPDATE usuarios SET senha_hash = '$2a$10$6BKo8tMQouCDy3pCnUhQFeGWX5caNfGhtzCHvb4UOLVP5aU4Vj1/C'
WHERE email = 'igor.queiroz@amazonpolpas.com.br';

-- Confirma que os usuários existem:
SELECT email, ativo, LEFT(senha_hash, 7) AS hash_ok FROM usuarios
WHERE email IN ('joao@amazonpolpas.com.br', 'igor.queiroz@amazonpolpas.com.br');
