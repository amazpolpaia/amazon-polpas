-- Senhas testadas com a API (bcrypt):
--   joao@amazonpolpas.com.br          → Admin@2025
--   igor.queiroz@amazonpolpas.com.br  → Iqs563160

UPDATE usuarios SET senha_hash = '$2a$10$2Qa9qhbnNXCcmx.NRLnSruwH.zeknc61/0GK/v3mfmyQ31BrK3kqy'
WHERE email = 'joao@amazonpolpas.com.br';

UPDATE usuarios SET senha_hash = '$2a$10$azM8wQm7fNA5WK9rQQvBV.XEhaC9Y9NUWUtI9AhkrTz5FU4pePfQW'
WHERE email = 'igor.queiroz@amazonpolpas.com.br';
