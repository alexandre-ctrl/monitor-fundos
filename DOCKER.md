# 🐳 Guia Rápido - Deploy com Docker

## 📋 Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+

### Instalar Docker (Ubuntu/Debian)

```bash
# Remover versões antigas
sudo apt-get remove docker docker-engine docker.io containerd runc

# Instalar dependências
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Adicionar chave GPG oficial do Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Adicionar repositório
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar instalação
docker --version
docker compose version
```

---

## 🚀 Deploy Rápido (5 minutos)

### 1. Preparar Ambiente

```bash
# Clone o projeto
git clone <seu-repositorio>
cd fiis-monitor

# Copiar .env de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

### 2. Configurar .env

```bash
# Variáveis mínimas necessárias
PGUSER=fiis_user
PGPASSWORD=senha_super_segura_aqui
PGDATABASE=fiis_monitor
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
REDIS_HOST=redis
REDIS_PORT=6379
```

### 3. Iniciar Serviços

```bash
# Build e start
docker compose up -d

# Ver logs
docker compose logs -f

# Verificar status
docker compose ps
```

### 4. Acessar Aplicação

```
API: http://localhost:3001
Health: http://localhost:3001/api/health

Usuário padrão:
- Email: admin@fiis.local
- Senha: admin123
```

---

## 📦 Comandos Úteis

### Gerenciamento Básico

```bash
# Iniciar todos os serviços
docker compose up -d

# Parar todos os serviços
docker compose stop

# Parar e remover containers
docker compose down

# Parar e remover tudo (inclusive volumes)
docker compose down -v

# Reiniciar serviço específico
docker compose restart api

# Ver logs
docker compose logs -f
docker compose logs -f api
docker compose logs -f postgres

# Ver status
docker compose ps

# Executar comando em container
docker compose exec api sh
docker compose exec postgres psql -U fiis_user -d fiis_monitor
```

### Build e Atualização

```bash
# Rebuild após mudanças no código
docker compose build

# Rebuild e restart
docker compose up -d --build

# Rebuild forçado (sem cache)
docker compose build --no-cache

# Pull de imagens atualizadas
docker compose pull
```

### Manutenção

```bash
# Ver uso de espaço
docker system df

# Limpar recursos não utilizados
docker system prune -a

# Limpar volumes não utilizados
docker volume prune

# Backup do volume do PostgreSQL
docker run --rm \
  -v fiis-monitor_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz /data

# Restore do volume do PostgreSQL
docker run --rm \
  -v fiis-monitor_postgres_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres-backup-YYYYMMDD.tar.gz --strip 1"
```

---

## 🔧 Configurações Avançadas

### Escalar Serviços

```bash
# Múltiplas instâncias da API
docker compose up -d --scale api=3

# Com load balancer
# Adicione nginx ao docker-compose.yml
```

### Monitoramento

```bash
# Stats em tempo real
docker stats

# Ver processos em um container
docker compose top api

# Inspecionar container
docker compose exec api ps aux
docker compose exec api df -h
```

### Logs Avançados

```bash
# Logs com timestamp
docker compose logs -f -t

# Últimas 100 linhas
docker compose logs --tail=100 api

# Logs desde tempo específico
docker compose logs --since 2024-01-01T00:00:00

# Salvar logs em arquivo
docker compose logs > logs.txt
```

---

## 🗄️ Gerenciamento de Banco de Dados

### Backup Manual

```bash
# Backup do PostgreSQL
docker compose exec postgres pg_dump -U fiis_user fiis_monitor > backup.sql

# Backup compactado
docker compose exec postgres pg_dump -U fiis_user fiis_monitor | gzip > backup.sql.gz

# Backup de todos os bancos
docker compose exec postgres pg_dumpall -U fiis_user > backup-all.sql
```

### Restore

```bash
# Restore do backup
cat backup.sql | docker compose exec -T postgres psql -U fiis_user -d fiis_monitor

# Restore de backup compactado
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U fiis_user -d fiis_monitor
```

### Acesso Direto ao Banco

```bash
# Conectar ao PostgreSQL
docker compose exec postgres psql -U fiis_user -d fiis_monitor

# Executar query
docker compose exec postgres psql -U fiis_user -d fiis_monitor -c "SELECT * FROM users;"

# Conectar ao Redis
docker compose exec redis redis-cli

# Verificar chaves no Redis
docker compose exec redis redis-cli KEYS '*'
```

---

## 🔒 Segurança

### Práticas Recomendadas

```bash
# 1. Usar secrets do Docker (produção)
echo "senha_super_segura" | docker secret create postgres_password -

# 2. Limitar recursos
# Adicione ao docker-compose.yml:
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

# 3. Rede isolada
# Remova 'ports' dos serviços que não precisam ser expostos

# 4. Scan de vulnerabilidades
docker scan fiis-monitor-api
```

### Atualizar Senhas

```bash
# 1. Parar serviços
docker compose stop

# 2. Editar .env com novas senhas

# 3. Remover volumes (CUIDADO: isso apaga dados)
docker compose down -v

# 4. Reiniciar tudo
docker compose up -d
```

---

## 🌐 Deploy em Produção

### Com NGINX SSL

```bash
# 1. Obter certificados SSL (Let's Encrypt)
sudo certbot certonly --standalone -d api.seudominio.com

# 2. Copiar certificados
sudo cp /etc/letsencrypt/live/api.seudominio.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/api.seudominio.com/privkey.pem ./ssl/

# 3. Configurar nginx.conf com SSL

# 4. Reiniciar
docker compose restart nginx
```

### Configuração nginx.conf para SSL

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server api:3001;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name api.seudominio.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name api.seudominio.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        location / {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

---

## 📊 Monitoramento com Docker

### Docker Stats

```bash
# Monitorar recursos
docker stats $(docker compose ps -q)

# Formato customizado
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Healthchecks

```bash
# Ver status de health
docker compose ps

# Inspecionar health
docker inspect --format='{{json .State.Health}}' fiis-api | jq
```

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs de erro
docker compose logs api

# Inspecionar container
docker compose ps -a
docker inspect fiis-api

# Verificar configuração
docker compose config

# Testar build
docker compose build --progress=plain api
```

### Problemas de Rede

```bash
# Listar redes
docker network ls

# Inspecionar rede
docker network inspect fiis-monitor_fiis-network

# Testar conectividade entre containers
docker compose exec api ping postgres
docker compose exec api ping redis

# Ver portas expostas
docker compose port api 3001
```

### Banco de Dados não conecta

```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Ver logs do PostgreSQL
docker compose logs postgres

# Testar conexão
docker compose exec postgres pg_isready -U fiis_user

# Conectar manualmente
docker compose exec postgres psql -U fiis_user -d fiis_monitor
```

### Redis não funciona

```bash
# Verificar status
docker compose ps redis

# Testar conexão
docker compose exec redis redis-cli ping

# Ver logs
docker compose logs redis

# Listar chaves
docker compose exec redis redis-cli KEYS '*'
```

### Container consome muita memória

```bash
# Ver uso atual
docker stats fiis-api

# Limitar recursos (adicionar ao docker-compose.yml)
services:
  api:
    mem_limit: 512m
    mem_reservation: 256m

# Reiniciar com limites
docker compose up -d
```

### Limpar tudo e recomeçar

```bash
# ATENÇÃO: Isso remove TODOS os dados!

# Parar tudo
docker compose down -v

# Remover imagens
docker compose down --rmi all

# Limpar sistema
docker system prune -a --volumes

# Recomeçar do zero
docker compose up -d --build
```

---

## 📈 Otimização de Performance

### Cache de Build

```bash
# Usar BuildKit para builds mais rápidos
export DOCKER_BUILDKIT=1
docker compose build

# Build paralelo
docker compose build --parallel
```

### Volumes e Performance

```bash
# Em desenvolvimento (melhor performance no Mac/Windows)
# Use volumes nomeados ao invés de bind mounts

volumes:
  - node_modules:/app/node_modules  # Bom
  # ./node_modules:/app/node_modules  # Evitar
```

### Compressão de Logs

```bash
# Adicionar ao docker-compose.yml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
```

---

## 🔄 CI/CD com Docker

### GitHub Actions Exemplo

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and Push
        run: |
          docker build -t fiis-api:latest .
          docker tag fiis-api:latest registry.example.com/fiis-api:latest
          docker push registry.example.com/fiis-api:latest

      - name: Deploy to Server
        run: |
          ssh user@server 'cd /app && docker compose pull && docker compose up -d'
```

---

## 🎯 Checklist de Produção

Antes de colocar em produção, verifique:

- [ ] Senhas fortes no .env
- [ ] JWT_SECRET único e seguro
- [ ] SSL/HTTPS configurado
- [ ] Backup automático configurado
- [ ] Limites de recursos definidos
- [ ] Logging configurado
- [ ] Monitoring/alertas ativos
- [ ] Healthchecks funcionando
- [ ] Rede isolada (sem portas desnecessárias expostas)
- [ ] Volumes persistentes para dados
- [ ] Restart policy configurado
- [ ] Documentação atualizada

---

## 📞 Comandos Rápidos de Emergência

```bash
# Ver o que está consumindo recursos
docker stats --no-stream

# Reiniciar tudo rapidamente
docker compose restart

# Ver últimos erros
docker compose logs --tail=50 api | grep -i error

# Backup rápido do banco
docker compose exec postgres pg_dump -U fiis_user fiis_monitor | gzip > emergency-backup-$(date +%s).sql.gz

# Limpar logs que estão ocupando espaço
truncate -s 0 $(docker inspect --format='{{.LogPath}}' fiis-api)

# Matar todos os containers do projeto
docker compose kill

# Restaurar estado anterior
docker compose down && docker compose up -d
```

---

## 📝 Estrutura de Arquivos Recomendada

```
fiis-monitor/
├── docker-compose.yml          # Orquestração
├── Dockerfile                  # Build da API
├── .dockerignore              # Arquivos a ignorar
├── .env                       # Variáveis de ambiente (NÃO commitar)
├── .env.example               # Exemplo de .env
├── server.js                  # Código da aplicação
├── package.json               # Dependências Node.js
├── nginx.conf                 # Configuração NGINX
├── init-db.sql               # Script inicial do banco
├── ssl/                      # Certificados SSL
│   ├── fullchain.pem
│   └── privkey.pem
├── logs/                     # Logs da aplicação
└── backups/                  # Backups do banco
```

---

## 🆘 Suporte e Recursos

### Documentação Oficial

- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/documentation

### Logs para Debug

```bash
# Exportar todos os logs
docker compose logs > debug-logs-$(date +%Y%m%d-%H%M%S).txt

# Logs com informações detalhadas
docker compose logs --details --timestamps > detailed-logs.txt
```

### Informações do Sistema

```bash
# Informações do Docker
docker version
docker info

# Informações dos containers
docker compose ps -a
docker compose top

# Uso de disco
docker system df -v
```

---

## 🎓 Dicas Extras

### 1. Desenvolvimento Local

```bash
# Use um docker-compose.dev.yml separado
docker compose -f docker-compose.dev.yml up

# Com hot reload (nodemon)
volumes:
  - .:/app
  - /app/node_modules
environment:
  - NODE_ENV=development
```

### 2. Múltiplos Ambientes

```bash
# Produção
docker compose -f docker-compose.yml up -d

# Staging
docker compose -f docker-compose.staging.yml up -d

# Desenvolvimento
docker compose -f docker-compose.dev.yml up
```

### 3. Testes

```bash
# Container de testes
docker compose run --rm api npm test

# Com cobertura
docker compose run --rm api npm run test:coverage
```

---

## ✅ Resumo de Comandos Essenciais

```bash
# Iniciar
docker compose up -d

# Ver logs
docker compose logs -f

# Status
docker compose ps

# Parar
docker compose stop

# Reiniciar
docker compose restart

# Backup
docker compose exec postgres pg_dump -U fiis_user fiis_monitor > backup.sql

# Atualizar
docker compose pull && docker compose up -d

# Limpar
docker compose down -v

# Debug
docker compose logs api --tail=100
```

---

**Versão**: 1.0.0  
**Última Atualização**: 2025
