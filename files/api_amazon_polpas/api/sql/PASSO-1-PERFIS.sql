-- PASSO 1 — Railway → Postgres → Query
-- Copie ESTE ARQUIVO INTEIRO (Ctrl+A, Ctrl+C), cole, Run.
-- Deve mostrar 5 perfis no final.

INSERT INTO perfis (nome, descricao) VALUES
  ('gerente',   'Acesso total'),
  ('comprador', 'Compras'),
  ('balanca',   'Balança'),
  ('recepcao',  'Recepção'),
  ('producao',  'Produção')
ON CONFLICT (nome) DO NOTHING;

SELECT id, nome FROM perfis ORDER BY id;
