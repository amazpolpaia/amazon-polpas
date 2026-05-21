-- Execute DEPOIS de importar amazon_polpas_banco.sql na nuvem.
-- Corrige senhas para funcionar com a API (bcrypt).
-- Senha do joao: Admin@2025

UPDATE usuarios SET senha_hash = '$2a$10$5MNmw.3oe/os8q553bQ7V.MudahiHUVvfac7ixMS2padWY9WOS'
WHERE email = 'joao@amazonpolpas.com.br';
