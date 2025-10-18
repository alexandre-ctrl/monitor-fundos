#!/bin/bash

# ============================================================
# SCRIPT DE DEPLOY - SISTEMA DE MONITORAMENTO DE FIIs
# Para uso em servidores Linux (Ubuntu/Debian/CentOS)
# ============================================================

set -e  # Para em caso de erro

echo "🚀 Iniciando deploy do Sistema de Monitoramento de FIIs..."

# ============================================================
# 1. VERIFICAR REQUISITOS
# ============================================================

echo "📋 Verificando requisitos..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    echo "Execute: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado!"
    exit 1
fi

echo "✅ npm $(npm --version) encontrado"

# Verificar PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL não encontrado. Instalando..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi

echo "✅ PostgreSQL encontrado"

# Verificar Redis (opcional)
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis não encontrado. Instalando..."
    sudo apt-get install -y redis-server
fi

echo "✅ Redis encontrado"

# ============================================================
# 2. CONFIGURAR POSTGRESQL
# ============================================================

echo "🗄️  Configurando PostgreSQL..."

# Iniciar PostgreSQL se não estiver rodando
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Criar usuário e banco de dados
sudo -u postgres psql -c "SELECT 1 FROM pg_user WHERE usename = 'fiis_user';" | grep -q 1 || \
sudo -u postgres psql -c "CREATE USER fiis_user WITH PASSWORD 'fiis_pass';"

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'fiis_monitor';" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE fiis_monitor OWNER fiis_user;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fiis_monitor TO fiis_user;"

echo "✅ PostgreSQL configurado"

# ============================================================
# 3. CONFIGURAR REDIS
# ============================================================

echo "💾 Configurando Redis..."

# Iniciar Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

echo "✅ Redis configurado"

# ============================================================
# 4. INSTALAR DEPENDÊNCIAS
# ============================================================

echo "📦 Instalando dependências do Node.js..."

npm install

echo "✅ Dependências instaladas"

# ============================================================
# 5. CONFIGURAR VARIÁVEIS DE AMBIENTE
# ============================================================

echo "⚙️  Configurando variáveis de ambiente..."

if [ ! -f .env ]; then
    cat > .env << EOF
# Configurações do PostgreSQL
PGUSER=fiis_user
PGPASSWORD=fiis_pass
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=fiis_monitor

# Configurações do servidor
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)

# Configurações do Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Configurações de email (opcional)
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app
EOF
    echo "✅ Arquivo .env criado"
else
    echo "⚠️  Arquivo .env já existe - não será sobrescrito"
fi

# ============================================================
# 6. CONFIGURAR PM2 (GERENCIADOR DE PROCESSOS)
# ============================================================

echo "🔄 Configurando PM2..."

# Instalar PM2 globalmente
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Criar arquivo de configuração do PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'fiis-monitor-api',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Criar diretório de logs
mkdir -p logs

echo "✅ PM2 configurado"

# ============================================================
# 7. CONFIGURAR FIREWALL (OPCIONAL)
# ============================================================

echo "🔥 Configurando firewall..."

if command -v ufw &> /dev/null; then
    sudo ufw allow 3001/tcp
    echo "✅ Porta 3001 liberada no firewall"
else
    echo "⚠️  UFW não encontrado - configure o firewall manualmente"
fi

# ============================================================
# 8. CONFIGURAR NGINX (PROXY REVERSO - OPCIONAL)
# ============================================================

echo "🌐 Deseja configurar NGINX como proxy reverso? (s/n)"
read -r configure_nginx

if [ "$configure_nginx" = "s" ]; then
    if ! command -v nginx &> /dev/null; then
        echo "Instalando NGINX..."
        sudo apt-get install -y nginx
    fi

    echo "Digite o domínio (ex: api.seudominio.com) ou pressione Enter para usar IP:"
    read -r domain

    if [ -z "$domain" ]; then
        domain="_"
    fi

    sudo tee /etc/nginx/sites-available/fiis-monitor > /dev/null << EOF
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    sudo ln -sf /etc/nginx/sites-available/fiis-monitor /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    
    echo "✅ NGINX configurado"
fi

# ============================================================
# 9. INICIAR APLICAÇÃO
# ============================================================

echo "🚀 Iniciando aplicação..."

# Parar instância anterior se existir
pm2 delete fiis-monitor-api 2>/dev/null || true

# Iniciar com PM2
pm2 start ecosystem.config.js

# Configurar PM2 para iniciar no boot
pm2 save
pm2 startup | tail -n 1 | bash

echo "✅ Aplicação iniciada"

# ============================================================
# 10. VERIFICAR STATUS
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Status da aplicação:"
pm2 status
echo ""
echo "🌐 API disponível em:"
echo "   http://localhost:3001"
echo ""
echo "📋 Comandos úteis:"
echo "   pm2 status           - Ver status"
echo "   pm2 logs             - Ver logs"
echo "   pm2 restart all      - Reiniciar"
echo "   pm2 stop all         - Parar"
echo "   pm2 monit            - Monitor em tempo real"
echo ""
echo "👤 Usuário padrão:"
echo "   Email: admin@fiis.local"
echo "   Senha: admin123"
echo ""
echo "🔧 Próximos passos:"
echo "   1. Edite .env com suas configurações"
echo "   2. Configure SSL/HTTPS com certbot (se usar NGINX)"
echo "   3. Configure backup do PostgreSQL"
echo "   4. Monitore os logs em ./logs/"
echo ""
echo "════════════════════════════════════════════════════════"