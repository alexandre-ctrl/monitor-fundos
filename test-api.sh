#!/bin/bash

# ============================================================
# SCRIPT DE TESTES - API FIIS MONITOR
# Testa todos os endpoints principais
# ============================================================

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuração
API_URL="${API_URL:-http://localhost:3001}"
TOKEN=""
TEST_EMAIL="test_$(date +%s)@test.com"
TEST_PASSWORD="Test123!@#"

# Contadores
PASSED=0
FAILED=0

# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# ============================================================
# TESTES
# ============================================================

echo "============================================================"
echo "  TESTES DA API - FIIS MONITOR"
echo "  URL: $API_URL"
echo "============================================================"
echo ""

# Teste 1: Health Check
print_test "1. Health Check"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "API está respondendo (HTTP $http_code)"
    echo "    Resposta: $body"
else
    print_fail "API não respondeu corretamente (HTTP $http_code)"
fi
echo ""

# Teste 2: Registro de Usuário
print_test "2. Registro de Usuário"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"name\": \"Usuário Teste\"
    }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "201" ]; then
    print_pass "Usuário registrado com sucesso"
    echo "    Email: $TEST_EMAIL"
    TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        print_info "Token obtido: ${TOKEN:0:20}..."
    fi
else
    print_fail "Erro ao registrar usuário (HTTP $http_code)"
    echo "    Resposta: $body"
fi
echo ""

# Teste 3: Login
print_test "3. Login"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "Login realizado com sucesso"
    TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        print_info "Novo token obtido: ${TOKEN:0:20}..."
    fi
else
    print_fail "Erro ao fazer login (HTTP $http_code)"
    echo "    Resposta: $body"
fi
echo ""

# Teste 4: Login com credenciais inválidas
print_test "4. Login com credenciais inválidas"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"senhaErrada123\"
    }")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    print_pass "Credenciais inválidas rejeitadas corretamente"
else
    print_fail "Resposta inesperada para credenciais inválidas (HTTP $http_code)"
fi
echo ""

# Teste 5: Acesso sem token
print_test "5. Acesso sem autenticação"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    print_pass "Acesso sem token bloqueado corretamente"
else
    print_fail "Acesso sem token não foi bloqueado (HTTP $http_code)"
fi
echo ""

# Verificar se temos token para testes autenticados
if [ -z "$TOKEN" ]; then
    print_fail "Token não disponível - pulando testes autenticados"
    echo ""
    echo "============================================================"
    echo "RESULTADO: $PASSED passou, $FAILED falhou"
    echo "============================================================"
    exit 1
fi

# Teste 6: Listar FIIs
print_test "6. Listar FIIs (autenticado)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "Lista de FIIs obtida com sucesso"
    count=$(echo "$body" | grep -o "ticker" | wc -l)
    print_info "Total de FIIs: $count"
else
    print_fail "Erro ao listar FIIs (HTTP $http_code)"
fi
echo ""

# Teste 7: Dados de FII específico
print_test "7. Dados de FII específico (HGLG11)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis/HGLG11" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "Dados do FII HGLG11 obtidos"
    echo "    Dados: $body" | head -c 100
    echo "..."
else
    print_fail "Erro ao obter dados do FII (HTTP $http_code)"
fi
echo ""

# Teste 8: Histórico de cotações
print_test "8. Histórico de cotações (HGLG11)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis/HGLG11/history?days=30" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_pass "Histórico obtido com sucesso"
else
    print_fail "Erro ao obter histórico (HTTP $http_code)"
fi
echo ""

# Teste 9: Análise técnica
print_test "9. Análise técnica (HGLG11)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis/HGLG11/analysis" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "Análise técnica obtida"
    echo "    Indicadores disponíveis: RSI, MACD, SMA, Bollinger"
else
    print_fail "Erro ao obter análise técnica (HTTP $http_code)"
fi
echo ""

# Teste 10: Recomendações
print_test "10. Recomendações personalizadas"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/recommendations" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    print_pass "Recomendações obtidas"
    count=$(echo "$body" | grep -o "ticker" | wc -l)
    print_info "Total de recomendações: $count"
else
    print_fail "Erro ao obter recomendações (HTTP $http_code)"
fi
echo ""

# Teste 11: Dashboard
print_test "11. Dashboard - Estatísticas gerais"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/dashboard" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_pass "Dashboard obtido com sucesso"
else
    print_fail "Erro ao obter dashboard (HTTP $http_code)"
fi
echo ""

# Teste 12: Criar alerta
print_test "12. Criar alerta de preço"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/alerts" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "ticker": "HGLG11",
        "type": "price_above",
        "threshold": 160.00
    }')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "201" ]; then
    print_pass "Alerta criado com sucesso"
    ALERT_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    print_info "ID do alerta: $ALERT_ID"
else
    print_fail "Erro ao criar alerta (HTTP $http_code)"
fi
echo ""

# Teste 13: Listar alertas
print_test "13. Listar alertas do usuário"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/alerts" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_pass "Lista de alertas obtida"
else
    print_fail "Erro ao listar alertas (HTTP $http_code)"
fi
echo ""

# Teste 14: Listar notificações
print_test "14. Listar notificações"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/notifications" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_pass "Lista de notificações obtida"
else
    print_fail "Erro ao listar notificações (HTTP $http_code)"
fi
echo ""

# Teste 15: Atualizar perfil
print_test "15. Atualizar perfil do usuário"
response=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL/api/profile" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Usuário Teste Atualizado",
        "profile": {
            "risk_tolerance": "aggressive",
            "goals": ["growth", "income"],
            "capital": 100000
        }
    }')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_pass "Perfil atualizado com sucesso"
else
    print_fail "Erro ao atualizar perfil (HTTP $http_code)"
fi
echo ""

# Teste 16: Deletar alerta
if [ -n "$ALERT_ID" ]; then
    print_test "16. Deletar alerta"
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/api/alerts/$ALERT_ID" \
        -H "Authorization: Bearer $TOKEN")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        print_pass "Alerta deletado com sucesso"
    else
        print_fail "Erro ao deletar alerta (HTTP $http_code)"
    fi
    echo ""
fi

# Teste 17: Token expirado/inválido
print_test "17. Token inválido"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/fiis" \
    -H "Authorization: Bearer token_invalido_123")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "403" ]; then
    print_pass "Token inválido rejeitado corretamente"
else
    print_fail "Token inválido não foi rejeitado (HTTP $http_code)"
fi
echo ""

# Teste 18: Performance - Múltiplas requisições
print_test "18. Teste de performance (10 requisições)"
start_time=$(date +%s)
for i in {1..10}; do
    curl -s "$API_URL/api/health" > /dev/null
done
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $duration -lt 5 ]; then
    print_pass "Performance aceitável ($duration segundos para 10 requisições)"
else
    print_fail "Performance ruim ($duration segundos para 10 requisições)"
fi
echo ""

# ============================================================
# RESULTADOS
# ============================================================

echo "============================================================"
echo "  RESULTADO DOS TESTES"
echo "============================================================"
echo ""
echo -e "Total de testes: $((PASSED + FAILED))"
echo -e "${GREEN}Passou: $PASSED${NC}"
echo -e "${RED}Falhou: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
    echo ""
    echo "Sua API está funcionando perfeitamente!"
    exit 0
else
    echo -e "${RED}❌ ALGUNS TESTES FALHARAM${NC}"
    echo ""
    echo "Verifique os logs para mais detalhes:"
    echo "  docker compose logs api"
    echo "  pm2 logs"
    exit 1
fi