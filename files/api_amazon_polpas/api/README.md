# Amazon Polpas — API Back-end

API REST em Node.js + Express para o sistema de gestão de fruto.

---

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do PostgreSQL

# 3. Criar o banco de dados
# Execute o arquivo amazon_polpas_banco.sql no PostgreSQL:
psql -U postgres -d amazon_polpas -f amazon_polpas_banco.sql

# 4. Iniciar o servidor
npm run dev       # desenvolvimento (com auto-reload)
npm start         # produção
```

---

## Autenticação

Todas as rotas (exceto `/auth/login`) exigem token JWT no header:
```
Authorization: Bearer <token>
```

### Perfis e permissões

| Perfil     | Módulos com acesso de edição                     |
|------------|--------------------------------------------------|
| gerente    | Todos os módulos + usuários + fechar dia         |
| comprador  | Compra de fruto · relatório (leitura)            |
| balanca    | Balança chegada · Balança saída                  |
| recepcao   | Recepção de fruto                                |
| producao   | Despolpamento · Rendimento                       |

---

## Rotas

### Auth
| Método | Rota             | Descrição                        | Perfil      |
|--------|------------------|----------------------------------|-------------|
| POST   | /auth/login      | Login — retorna token JWT        | Público     |
| GET    | /auth/me         | Dados do usuário logado          | Todos       |
| GET    | /auth/usuarios   | Lista usuários                   | gerente     |
| POST   | /auth/usuarios   | Cria usuário                     | gerente     |

**Login — exemplo:**
```json
POST /auth/login
{ "email": "joao@amazonpolpas.com.br", "senha": "Admin@2025" }
```

---

### Fornecedores
| Método | Rota                | Descrição               | Perfil    |
|--------|---------------------|-------------------------|-----------|
| GET    | /fornecedores       | Lista com desempenho    | Todos     |
| GET    | /fornecedores/:id   | Detalhe do fornecedor   | Todos     |
| POST   | /fornecedores       | Cadastrar               | gerente   |
| PUT    | /fornecedores/:id   | Atualizar               | gerente   |

---

### Lotes
| Método | Rota                    | Descrição                      | Perfil              |
|--------|-------------------------|--------------------------------|---------------------|
| GET    | /lotes                  | Lista (filtros: data, status)  | Todos               |
| GET    | /lotes/:id              | Resumo completo do lote        | Todos               |
| POST   | /lotes                  | Criar lote                     | gerente, comprador  |
| PATCH  | /lotes/:id/status       | Atualizar status               | gerente             |

---

### Módulo 1 — Compra de Fruto
| Método | Rota                   | Descrição             | Perfil              |
|--------|------------------------|-----------------------|---------------------|
| GET    | /compras               | Lista compras         | Todos               |
| POST   | /compras               | Registrar compra      | gerente, comprador  |
| GET    | /compras/resumo-dia    | Resumo do dia         | Todos               |

**Registrar compra — exemplo:**
```json
POST /compras
{
  "lote_id": "uuid-do-lote",
  "fornecedor_id": 1,
  "qtd_latas_prevista": 120,
  "preco_por_lata": 28.50,
  "data_entrega_prev": "2025-05-20",
  "condicao_acordada": "Ótima"
}
```

---

### Módulos 2 e 4 — Balança
| Método | Rota                      | Descrição                            | Perfil           |
|--------|---------------------------|--------------------------------------|------------------|
| POST   | /pesagens/chegada         | Registrar pesagem de chegada         | gerente, balanca |
| GET    | /pesagens/chegada/:lote   | Consultar pesagem de chegada         | Todos            |
| POST   | /pesagens/saida           | Registrar pesagem de saída           | gerente, balanca |
| GET    | /pesagens/saida/:lote     | Consultar + peso líquido calculado   | Todos            |
| GET    | /pesagens/comparativo     | Comparativo chegada vs saída do dia  | Todos            |

**Pesagem chegada — exemplo:**
```json
POST /pesagens/chegada
{
  "lote_id": "uuid-do-lote",
  "placa_veiculo": "BRA-2E19",
  "peso_bruto_kg": 14820,
  "tara_kg": 8200
}
```

---

### Módulo 3 — Recepção de Fruto
| Método | Rota                      | Descrição                | Perfil              |
|--------|---------------------------|--------------------------|---------------------|
| POST   | /recepcoes                | Registrar recepção       | gerente, recepcao   |
| GET    | /recepcoes/:lote_id       | Consultar recepção       | Todos               |
| GET    | /recepcoes/resumo-dia     | Resumo do dia            | Todos               |

---

### Módulo 5 — Despolpamento
| Método | Rota                          | Descrição              | Perfil            |
|--------|-------------------------------|------------------------|-------------------|
| POST   | /producao/despolpamento       | Registrar despolpa     | gerente, producao |
| GET    | /producao/despolpamento/:lote | Consultar              | Todos             |
| GET    | /producao/historico           | Histórico de rendimento| Todos             |

**Registrar despolpamento — exemplo:**
```json
POST /producao/despolpamento
{
  "lote_id": "uuid-do-lote",
  "latas_processadas": 118,
  "litros_extraidos": 944,
  "turno": "manha",
  "operador_nome": "Carlos Ferreira"
}
```

---

### Módulo 6 — Rendimento
| Método | Rota                          | Descrição                          | Perfil            |
|--------|-------------------------------|------------------------------------|-------------------|
| POST   | /producao/rendimento          | Calcular custo/litro do lote       | gerente, producao |
| GET    | /producao/rendimento/:lote    | Consultar rendimento               | Todos             |
| GET    | /producao/comparativo-dia     | Comparativo do dia por fornecedor  | Todos             |

---

### Módulo 7 — Relatório Final
| Método | Rota                                 | Descrição                    | Perfil    |
|--------|--------------------------------------|------------------------------|-----------|
| GET    | /relatorios?data=2025-05-20          | Prévia ou relatório fechado  | Todos     |
| POST   | /relatorios/fechar                   | Fechar o dia                 | gerente   |
| GET    | /relatorios/historico?dias=30        | Histórico de relatórios      | Todos     |
| GET    | /relatorios/desempenho-fornecedores  | Ranking geral                | Todos     |

---

## Fluxo completo de um lote

```
1. POST /lotes                    → cria lote (gera código automático)
2. POST /compras                  → registra negociação
3. POST /pesagens/chegada         → peso bruto + horário
4. POST /recepcoes                → contagem de latas
5. POST /pesagens/saida           → peso saída (peso líquido calculado automaticamente)
6. POST /producao/despolpamento   → litros extraídos (rendimento calculado automaticamente)
7. POST /producao/rendimento      → custo/litro calculado automaticamente
8. GET  /relatorios               → prévia da média ponderada do dia
9. POST /relatorios/fechar        → fecha o dia e salva o relatório final
```

---

## Hospedagem recomendada

- **Railway** (railway.app) — deploy em 5 minutos, plano gratuito disponível
- **Render** (render.com) — plano gratuito para projetos pequenos
- **VPS própria** — DigitalOcean ou Contabo para maior controle

```bash
# Deploy simples com Railway
npm install -g @railway/cli
railway login
railway init
railway up
```
