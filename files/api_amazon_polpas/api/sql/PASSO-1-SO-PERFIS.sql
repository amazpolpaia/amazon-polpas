INSERT INTO perfis (nome, descricao) VALUES
  ('gerente', 'Acesso total'),
  ('comprador', 'Compras'),
  ('balanca', 'Balança'),
  ('recepcao', 'Recepção'),
  ('producao', 'Produção')
ON CONFLICT (nome) DO NOTHING;
