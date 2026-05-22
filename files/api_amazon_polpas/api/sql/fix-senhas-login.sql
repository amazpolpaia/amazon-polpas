-- Execute no Postgres do Railway se o login der "Erro interno" ou "senha incorreta".
-- Senhas após este script:
--   joao@amazonpolpas.com.br     → Admin@2025
--   igor.queiroz@amazonpolpas.com.br → Iqs563160

-- Hashes gerados com bcrypt (compatíveis com a API)
UPDATE usuarios SET senha_hash = '$2a$10$EmI6C/gQK8zUYRSDfIsoKu6fDO1O/uPXpsFMeUOnDwlrAgf55/lsK'
WHERE email = 'joao@amazonpolpas.com.br';

UPDATE usuarios SET senha_hash = '$2a$10$6BKo8tMQouCDy3pCnUhQFeGWX5caNfGhtzCHvb4UOLVP5aU4Vj1/C'
WHERE email = 'igor.queiroz@amazonpolpas.com.br';
