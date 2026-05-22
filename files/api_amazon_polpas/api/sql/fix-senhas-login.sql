-- Execute no Postgres do Railway se o login der "Erro interno" ou "senha incorreta".
-- Senhas após este script:
--   joao@amazonpolpas.com.br     → Admin@2025
--   igor.queiroz@amazonpolpas.com.br → Iqs563160

UPDATE usuarios SET senha_hash = '$2a$10$5MNmw.3oe/os8q553bQ7V.MudahiHUVvfac7ixMS2padWY9WOS'
WHERE email = 'joao@amazonpolpas.com.br';

UPDATE usuarios SET senha_hash = '$2a$10$woCO4v5Loqr7LayNetX6NeJznzneC6lwi8IbXv66nhW7ipshU7OAS'
WHERE email = 'igor.queiroz@amazonpolpas.com.br';
