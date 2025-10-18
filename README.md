# 🏢 Sistema de Monitoramento de FIIs - Guia de Deploy

Sistema SaaS completo para monitoramento de Fundos Imobiliários em tempo real com análise técnica, recomendações inteligentes e sistema de alertas.

## 📋 Índice

- [Requisitos](#requisitos)
- [Instalação Rápida](#instalação-rápida)
- [Instalação Manual](#instalação-manual)
- [Configuração](#configuração)
- [Deploy em Produção](#deploy-em-produção)
- [Manutenção](#manutenção)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Requisitos

### Sistema Operacional

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Mínimo 2GB RAM
- 10GB espaço em disco

### Software Necessário

- **Node.js** 18+
- **PostgreSQL** 12+
- **Redis** 6+ (opcional, mas recomendado)
- **NGINX** (opcional, para proxy reverso)
- **PM2** (gerenciador de processos)

---

## 🚀 Instalação Rápida

### Método 1: Script Automático (Recomendado)

```bash
# 1. Clone o repositório
git clone <seu-repositorio>
cd fiis-monitor

# 2. Torne o script executável
chmod +x deploy.sh

# 3. Execute o deploy automático
./deploy.sh
```

O script irá:

- ✅ Verificar e instalar dependências
- ✅ Configurar PostgreSQL e Redis
- ✅ Criar banco de dados e usuários
- ✅ Instalar pacotes Node.js
- ✅ Configurar PM2
- ✅ Iniciar a aplicação

---

## 📦 Instalação Manual

### 1. Instalar Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 2. Instalar PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Iniciar serviço
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Criar usuário e banco
sudo -u postgres psql << EOF
CREATE USER fiis_user WITH PASSWORD 'fiis_pass';
CREATE DATABASE fiis_monitor OWNER fiis_user;
GRANT ALL PRIVILEGES ON DATABASE fiis_monitor TO fiis_user;
\q
EOF
```

### 3. Instalar Redis

```bash
# Ubuntu/Debian
sudo apt-get install -y redis-server

# Iniciar serviço
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Testar
redis-cli ping
# Deve retornar: PONG
```

### 4. Instalar Dependências do Projeto

```bash
cd /caminho/para/fiis-monitor
npm install
```

### 5. Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
cat > .env << 'EOF'
# PostgreSQL
PGUSER=fiis_user
PGPASSWORD=fiis_pass
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=fiis_monitor

# Servidor
PORT=3001
JWT_SECRET=seu_segredo_muito_seguro_aqui

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Email (opcional)
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app
EOF

# Gerar JWT_SECRET seguro
openssl rand -base64 32
```

### 6. Instalar PM2

```bash
sudo npm install -g pm2
```

### 7. Iniciar Aplicação

```bash
# Iniciar com PM2
pm2 start server.js --name fiis-monitor-api

# Salvar configuração
pm2 save

# Configurar inicialização automática
pm2 startup
# Execute o comando que o PM2 mostrar
```

---

## ⚙️ Configuração

### Arquivo .env Completo

```bash
# ===== BANCO DE DADOS =====
PGUSER=fiis_user
PGPASSWORD=sua_senha_segura_aqui
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=fiis_monitor

# ===== SERVIDOR =====
PORT=3001
NODE_ENV=production
JWT_SECRET=seu_jwt_secret_muito_seguro_de_32_caracteres

# ===== CACHE REDIS =====
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ===== EMAIL (OPCIONAL) =====
# Para Gmail, use "Senhas de App"
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app_gmail

# ===== APIs EXTERNAS (OPCIONAL) =====
ALPHAVANTAGE_KEY=sua_chave_api
YAHOO_FINANCE_KEY=sua_chave_api
```

### ecosystem.config.js (PM2)

```javascript
module.exports = {
  apps: [
    {
      name: "fiis-monitor-api",
      script: "./server.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
```

---

## 🌐 Deploy em Produção

### Opção 1: NGINX como Proxy Reverso

#### Instalar NGINX

```bash
sudo apt-get install -y nginx
```

#### Configurar Site

```bash
sudo nano /etc/nginx/sites-available/fiis-monitor
```

Adicione:

```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    # Logs
    access_log /var/log/nginx/fiis-monitor-access.log;
    error_log /var/log/nginx/fiis-monitor-error.log;

    # Aumentar limites
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://127.0.0.1:3001/api/health;
        access_log off;
    }
}
```

#### Ativar Site

```bash
sudo ln -s /etc/nginx/sites-available/fiis-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Opção 2: SSL/HTTPS com Let's Encrypt

```bash
# Instalar Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d api.seudominio.com

# Renovação automática já está configurada
sudo certbot renew --dry-run
```

### Firewall

```bash
# Permitir portas necessárias
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## 🔄 Comandos PM2

### Básicos

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs fiis-monitor-api

# Ver logs específicos
pm2 logs fiis-monitor-api --lines 100

# Reiniciar
pm2 restart fiis-monitor-api

# Parar
pm2 stop fiis-monitor-api

# Deletar
pm2 delete fiis-monitor-api

# Monitor interativo
pm2 monit
```

### Avançados

```bash
# Recarregar sem downtime
pm2 reload fiis-monitor-api

# Ver informações detalhadas
pm2 describe fiis-monitor-api

# Flush logs
pm2 flush

# Salvar configuração atual
pm2 save
```

---

## 🗄️ Backup e Restore

### Backup do PostgreSQL

#### Script Automático de Backup

```bash
# Criar script de backup
sudo nano /usr/local/bin/backup-fiis.sh
```

Adicione:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/fiis-monitor"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="fiis_pass"

mkdir -p $BACKUP_DIR

pg_dump -U fiis_user -h 127.0.0.1 fiis_monitor | \
  gzip > $BACKUP_DIR/fiis_monitor_$TIMESTAMP.sql.gz

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup concluído: fiis_monitor_$TIMESTAMP.sql.gz"
```

```bash
# Tornar executável
sudo chmod +x /usr/local/bin/backup-fiis.sh

# Agendar backup diário (3:00 AM)
sudo crontab -e
# Adicione: 0 3 * * * /usr/local/bin/backup-fiis.sh
```

#### Restore Manual

```bash
# Parar aplicação
pm2 stop fiis-monitor-api

# Restore
gunzip -c /var/backups/fiis-monitor/fiis_monitor_TIMESTAMP.sql.gz | \
  psql -U fiis_user -h 127.0.0.1 fiis_monitor

# Reiniciar aplicação
pm2 restart fiis-monitor-api
```

---

## 📊 Monitoramento

### PM2 Plus (Opcional)

```bash
# Conectar ao PM2 Plus
pm2 link seu_secret_key seu_public_key
```

### Logs

```bash
# Logs da aplicação
tail -f logs/combined.log

# Logs do NGINX
tail -f /var/log/nginx/fiis-monitor-access.log
tail -f /var/log/nginx/fiis-monitor-error.log

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log

# Logs do Redis
sudo tail -f /var/log/redis/redis-server.log
```

### Monitoramento de Recursos

```bash
# CPU e Memória
pm2 monit

# Espaço em disco
df -h

# Status dos serviços
systemctl status postgresql
systemctl status redis-server
systemctl status nginx
```

---

## 🔧 Manutenção

### Atualização da Aplicação

```bash
# 1. Fazer backup
/usr/local/bin/backup-fiis.sh

# 2. Baixar nova versão
git pull origin main

# 3. Instalar dependências
npm install

# 4. Reiniciar sem downtime
pm2 reload fiis-monitor-api

# 5. Verificar logs
pm2 logs fiis-monitor-api --lines 50
```

### Limpeza de Logs

```bash
# Limpar logs antigos (mais de 30 dias)
find ./logs -name "*.log" -mtime +30 -delete

# Ou usar logrotate
sudo nano /etc/logrotate.d/fiis-monitor
```

Adicione:

```
/caminho/para/fiis-monitor/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### Otimização do PostgreSQL

```bash
# Analisar e otimizar tabelas
sudo -u postgres psql -d fiis_monitor << EOF
VACUUM ANALYZE;
REINDEX DATABASE fiis_monitor;
EOF
```

---

## 🐛 Troubleshooting

### Aplicação não inicia

```bash
# Verificar logs
pm2 logs fiis-monitor-api --err

# Testar conexão PostgreSQL
psql -U fiis_user -h 127.0.0.1 -d fiis_monitor

# Testar conexão Redis
redis-cli ping

# Verificar portas
sudo netstat -tlnp | grep 3001
```

### Erro de conexão com o banco

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar permissões
sudo -u postgres psql -c "\du"
sudo -u postgres psql -c "\l"

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Redis não conecta

```bash
# Verificar se está rodando
sudo systemctl status redis-server

# Verificar configuração
sudo nano /etc/redis/redis.conf
# bind 127.0.0.1 deve estar descomentado

# Reiniciar Redis
sudo systemctl restart redis-server
```

### Alto uso de memória

```bash
# Ver uso por processo
pm2 status

# Reduzir instâncias no ecosystem.config.js
# instances: 1  # ao invés de 2

# Reiniciar
pm2 delete fiis-monitor-api
pm2 start ecosystem.config.js
```

### NGINX 502 Bad Gateway

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar logs do NGINX
sudo tail -f /var/log/nginx/error.log

# Testar configuração
sudo nginx -t

# Reiniciar NGINX
sudo systemctl restart nginx
```

---

## 📚 Endpoints da API

### Autenticação

```bash
# Registro
POST /api/auth/register
{
  "email": "usuario@email.com",
  "password": "senha123",
  "name": "Nome do Usuário"
}

# Login
POST /api/auth/login
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

### FIIs

```bash
# Listar todos
GET /api/fiis
Headers: Authorization: Bearer {token}

# Dados em tempo real
GET /api/fiis/HGLG11
Headers: Authorization: Bearer {token}

# Histórico
GET /api/fiis/HGLG11/history?days=90
Headers: Authorization: Bearer {token}

# Análise técnica
GET /api/fiis/HGLG11/analysis
Headers: Authorization: Bearer {token}
```

### Recomendações

```bash
# Obter recomendações
GET /api/recommendations
Headers: Authorization: Bearer {token}
```

### Alertas

```bash
# Listar alertas
GET /api/alerts
Headers: Authorization: Bearer {token}

# Criar alerta
POST /api/alerts
Headers: Authorization: Bearer {token}
{
  "ticker": "HGLG11",
  "type": "price_above",
  "threshold": 160.00
}

# Deletar alerta
DELETE /api/alerts/{id}
Headers: Authorization: Bearer {token}
```

### Dashboard

```bash
# Estatísticas gerais
GET /api/dashboard
Headers: Authorization: Bearer {token}
```

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] JWT_SECRET forte e único
- [ ] Senhas de banco fortes
- [ ] Firewall configurado
- [ ] SSL/HTTPS ativo
- [ ] Backups automáticos
- [ ] Logs sendo monitorados
- [ ] Rate limiting configurado
- [ ] CORS configurado corretamente
- [ ] Variáveis sensíveis no .env
- [ ] .env não commitado no git

### Hardening Adicional

```bash
# Limitar tentativas de login (instalar)
npm install express-rate-limit

# Adicionar ao server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite por IP
});

app.use('/api/', limiter);
```

---

## 📞 Suporte

### Logs Importantes

- **Aplicação**: `./logs/combined.log`
- **Erros**: `./logs/error.log`
- **NGINX**: `/var/log/nginx/`
- **PostgreSQL**: `/var/log/postgresql/`

### Comandos Úteis para Debug

```bash
# Status geral do sistema
pm2 status && \
systemctl status postgresql && \
systemctl status redis-server && \
systemctl status nginx

# Uso de recursos
pm2 monit

# Teste de saúde da API
curl http://localhost:3001/api/health
```

---

## 🎯 Próximos Passos

1. **Configurar domínio próprio**
2. **Ativar SSL com Let's Encrypt**
3. **Configurar backup automático**
4. **Integrar APIs de cotações reais**
5. **Configurar monitoramento (PM2 Plus, Grafana)**
6. **Implementar rate limiting**
7. **Adicionar testes automatizados**
8. **Configurar CI/CD**

---

## 📄 Licença

Sistema desenvolvido para monitoramento de FIIs.

---

## 👨‍💻 Desenvolvedor

Sistema de Monitoramento de FIIs
Versão 1.0.0

**Contato de Suporte**: suporte@seudominio.com
