# ✅ Checklist de Deploy - Sistema FIIs Monitor

Use este checklist para garantir um deploy seguro e completo.

---

## 📋 Pré-Deploy

### Ambiente

- [ ] Servidor Linux disponível (Ubuntu 20.04+ ou similar)
- [ ] Acesso SSH configurado
- [ ] Mínimo 2GB RAM disponível
- [ ] Mínimo 10GB espaço em disco
- [ ] Porta 3001 disponível (ou configurar outra)
- [ ] Domínio configurado (se aplicável)

### Dependências

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL 12+ instalado
- [ ] Redis instalado (opcional)
- [ ] Docker e Docker Compose instalados (se usar Docker)
- [ ] Git instalado
- [ ] NGINX instalado (para proxy reverso)

---

## 🔧 Configuração Inicial

### Código

- [ ] Repositório clonado
- [ ] Branch correto (main/production)
- [ ] Arquivo `.env` criado
- [ ] Todas variáveis do `.env` configuradas
- [ ] `JWT_SECRET` gerado e configurado (forte, único)
- [ ] Senhas de banco fortes definidas
- [ ] `.gitignore` inclui `.env`

### Banco de Dados

- [ ] PostgreSQL rodando
- [ ] Usuário `fiis_user` criado
- [ ] Banco `fiis_monitor` criado
- [ ] Permissões corretas configuradas
- [ ] Conexão testada

```bash
psql -U fiis_user -h localhost -d fiis_monitor
```

### Redis (Opcional)

- [ ] Redis instalado e rodando
- [ ] Porta 6379 acessível
- [ ] Conexão testada

```bash
redis-cli ping
```

---

## 🚀 Deploy

### Opção A: Docker

- [ ] `docker-compose.yml` configurado
- [ ] `.env` com variáveis corretas
- [ ] Build executado sem erros

```bash
docker compose build
```

- [ ] Containers iniciados

```bash
docker compose up -d
```

- [ ] Todos containers rodando

```bash
docker compose ps
```

- [ ] Logs verificados (sem erros críticos)

```bash
docker compose logs
```

### Opção B: PM2

- [ ] Dependências instaladas

```bash
npm install
```

- [ ] PM2 instalado globalmente

```bash
npm install -g pm2
```

- [ ] `ecosystem.config.js` configurado
- [ ] Aplicação iniciada

```bash
pm2 start ecosystem.config.js
```

- [ ] Status verificado

```bash
pm2 status
```

- [ ] Startup configurado

```bash
pm2 startup
pm2 save
```

---

## 🧪 Testes

### Testes Básicos

- [ ] Health check respondendo

```bash
curl http://localhost:3001/api/health
```

- [ ] Registro de usuário funciona

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","name":"Test"}'
```

- [ ] Login funciona

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'
```

- [ ] Endpoints autenticados funcionam

### Script de Testes Completo

- [ ] Script de testes executado

```bash
chmod +x test-api.sh
./test-api.sh
```

- [ ] Todos testes passaram (ou investigar falhas)

---

## 🌐 Configuração de Rede

### NGINX (Proxy Reverso)

- [ ] NGINX instalado
- [ ] Arquivo de configuração criado

```bash
sudo nano /etc/nginx/sites-available/fiis-monitor
```

- [ ] Site habilitado

```bash
sudo ln -s /etc/nginx/sites-available/fiis-monitor /etc/nginx/sites-enabled/
```

- [ ] Configuração testada

```bash
sudo nginx -t
```

- [ ] NGINX recarregado

```bash
sudo systemctl reload nginx
```

### Firewall

- [ ] Firewall configurado

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

- [ ] Portas corretas abertas
- [ ] Regras testadas

### SSL/HTTPS (Produção)

- [ ] Certbot instalado

```bash
sudo apt install certbot python3
```
