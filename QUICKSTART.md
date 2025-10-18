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
sudo apt install certbot python3-certbot-nginx
```

- [ ] Certificado SSL obtido

```bash
sudo certbot --nginx -d api.seudominio.com
```

- [ ] Renovação automática configurada

```bash
sudo certbot renew --dry-run
```

- [ ] HTTPS funcionando
- [ ] HTTP redirecionando para HTTPS

---

## 🔒 Segurança

### Senhas e Tokens

- [ ] `JWT_SECRET` forte e único (32+ caracteres)
- [ ] Senha do PostgreSQL forte
- [ ] Senha do usuário admin alterada
- [ ] `.env` com permissões restritas (600)

```bash
chmod 600 .env
```

- [ ] `.env` NÃO está no git

```bash
git check-ignore .env
```

### Configurações de Segurança

- [ ] Rate limiting ativo (NGINX)
- [ ] CORS configurado corretamente
- [ ] Headers de segurança ativos
- [ ] Logs de acesso habilitados
- [ ] Tentativas de login monitoradas

### Sistema

- [ ] Atualizações de segurança instaladas

```bash
sudo apt update && sudo apt upgrade -y
```

- [ ] Fail2ban instalado (opcional)

```bash
sudo apt install fail2ban
```

- [ ] Usuário não-root sendo usado
- [ ] SSH com autenticação por chave

---

## 💾 Backup

### Configuração de Backup

- [ ] Script de backup criado
- [ ] Diretório de backups criado

```bash
mkdir -p /var/backups/fiis-monitor
```

- [ ] Backup manual testado

```bash
./scripts/maintenance.sh backup
```

- [ ] Backup automático agendado (cron)

```bash
crontab -e
# Adicionar: 0 3 * * * cd /caminho/fiis-monitor && ./scripts/maintenance.sh backup
```

- [ ] Restore testado

```bash
./scripts/maintenance.sh restore backup.sql.gz
```

### Retenção

- [ ] Política de retenção definida (ex: 30 dias)
- [ ] Limpeza automática configurada
- [ ] Backups sendo armazenados em local seguro
- [ ] Backup offsite configurado (opcional)

---

## 📊 Monitoramento

### Logs

- [ ] Logs sendo gerados corretamente
- [ ] Rotação de logs configurada
- [ ] Logs acessíveis

```bash
tail -f logs/combined.log
```

- [ ] Espaço em disco monitorado

### Saúde do Sistema

- [ ] Script de health check funcionando

```bash
./scripts/maintenance.sh health
```

- [ ] Alertas de sistema configurados
- [ ] Monitoramento de recursos ativo

```bash
pm2 monit
# ou
docker stats
```

### Ferramentas Externas (Opcional)

- [ ] PM2 Plus configurado
- [ ] Grafana/Prometheus configurado
- [ ] Alertas via email/Slack configurados
- [ ] Uptime monitoring ativo (UptimeRobot, etc)

---

## 📝 Documentação

### Documentação Técnica

- [ ] README.md atualizado
- [ ] Variáveis de ambiente documentadas
- [ ] Endpoints da API documentados
- [ ] Processo de deploy documentado

### Documentação Operacional

- [ ] Credenciais armazenadas em local seguro
- [ ] Contatos de emergência definidos
- [ ] Runbook de incidentes criado
- [ ] Procedimentos de rollback documentados

---

## ✅ Validação Final

### Funcionalidades Principais

- [ ] Health check: `GET /api/health`
- [ ] Registro: `POST /api/auth/register`
- [ ] Login: `POST /api/auth/login`
- [ ] Listar FIIs: `GET /api/fiis`
- [ ] Dados de FII: `GET /api/fiis/:ticker`
- [ ] Histórico: `GET /api/fiis/:ticker/history`
- [ ] Análise técnica: `GET /api/fiis/:ticker/analysis`
- [ ] Recomendações: `GET /api/recommendations`
- [ ] Dashboard: `GET /api/dashboard`
- [ ] Criar alerta: `POST /api/alerts`
- [ ] Listar alertas: `GET /api/alerts`
- [ ] Notificações: `GET /api/notifications`

### Performance

- [ ] Tempo de resposta aceitável (< 500ms)
- [ ] Uso de memória normal (< 500MB por instância)
- [ ] Uso de CPU normal (< 50%)
- [ ] Banco de dados otimizado

```bash
./scripts/maintenance.sh optimize
```

### Disponibilidade

- [ ] Aplicação reinicia automaticamente
- [ ] Resistente a falhas do Redis (continua sem cache)
- [ ] Logs de erro sendo capturados
- [ ] Graceful shutdown funcionando

---

## 🎯 Pós-Deploy

### Primeiras 24h

- [ ] Monitorar logs continuamente
- [ ] Verificar uso de recursos
- [ ] Testar todas funcionalidades principais
- [ ] Verificar alertas e notificações
- [ ] Testar backup e restore

### Primeira Semana

- [ ] Analisar performance
- [ ] Ajustar recursos se necessário
- [ ] Otimizar queries lentas
- [ ] Revisar logs de erro
- [ ] Coletar feedback dos usuários

### Manutenção Regular

- [ ] Backup semanal verificado
- [ ] Atualizações de segurança mensais
- [ ] Limpeza de logs quinzenal
- [ ] Otimização do banco mensal
- [ ] Revisão de alertas mensal

---

## 🆘 Contatos de Emergência

### Equipe

- **Desenvolvedor**: **********\_\_\_**********
- **DevOps**: **************\_\_\_**************
- **Gerente**: **************\_\_**************

### Serviços

- **Hospedagem**: ************\_\_************
- **DNS**: ****************\_\_****************
- **Email**: **************\_\_\_\_**************

### Recursos

- **Documentação**: **********\_\_\_\_**********
- **Repositório**: ************\_\_************
- **Monitoramento**: **********\_\_\_\_**********

---

## 📞 Comandos de Emergência

### Sistema Travado

```bash
# Docker
docker compose restart

# PM2
pm2 restart all
```

### Backup de Emergência

```bash
# Docker
docker compose exec postgres pg_dump -U fiis_user fiis_monitor > emergency-$(date +%s).sql

# Direto
pg_dump -U fiis_user -h localhost fiis_monitor > emergency-$(date +%s).sql
```

### Rollback

```bash
# Docker
docker compose down
git checkout <commit-anterior>
docker compose up -d --build

# PM2
pm2 stop all
git checkout <commit-anterior>
npm install
pm2 restart all
```

### Ver Últimos Erros

```bash
# Docker
docker compose logs api --tail=100 | grep -i error

# PM2
pm2 logs --err --lines 100
```

---

## ✨ Checklist Completo

Se você marcou **TODOS** os itens acima, seu sistema está pronto para produção! 🎉

### Resumo Final:

- ✅ Ambiente configurado
- ✅ Aplicação deployada
- ✅ Testes passando
- ✅ Segurança implementada
- ✅ Backup configurado
- ✅ Monitoramento ativo
- ✅ Documentação completa

### Próximos Passos:

1. **Comunicar**: Informe a equipe que o deploy foi concluído
2. **Monitorar**: Acompanhe as primeiras 24-48 horas
3. **Otimizar**: Ajuste configurações baseado no uso real
4. **Escalar**: Adicione recursos conforme necessário

---

## 📋 Assinaturas

| Responsável | Data           | Assinatura     |
| ----------- | -------------- | -------------- |
| Deploy      | **_/_**/\_\_\_ | ****\_\_\_**** |
| Revisão     | **_/_**/\_\_\_ | ****\_\_\_**** |
| Aprovação   | **_/_**/\_\_\_ | ****\_\_\_**** |

---

**Versão do Checklist**: 1.0  
**Última Atualização**: Outubro 2025  
**Status do Deploy**: ⬜ Pendente | ⬜ Em Progresso | ⬜ Concluído
