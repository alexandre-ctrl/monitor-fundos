// ============================================================
// BACKEND COMPLETO - SISTEMA DE MONITORAMENTO DE FIIs
// Stack: Node.js + Express + PostgreSQL + Redis
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const redis = require("redis");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cron = require("node-cron");

// ============================================================
// CONFIGURAÇÕES
// ============================================================

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET =
  process.env.JWT_SECRET || "seu_segredo_super_seguro_aqui_mudar_em_producao";

app.use(cors());
app.use(express.json());

// Configuração PostgreSQL via .env
const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "127.0.0.1",
  database: process.env.PGDATABASE || "fiis_monitor",
  password: process.env.PGPASSWORD || "sua_senha",
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Configuração Redis para cache
let redisAvailable = false;
let redisClient = null;

async function initRedis() {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Error:", err);
      redisAvailable = false;
    });

    await redisClient.connect();
    redisAvailable = true;
    console.log("✅ Redis conectado");
  } catch (err) {
    redisAvailable = false;
    console.warn(
      "⚠️ Redis não disponível - cache desativado (continuando sem cache)"
    );
  }
}

// Configuração de email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============================================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ============================================================
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        profile JSONB DEFAULT '{"risk_tolerance": "moderate", "goals": [], "capital": 0}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fiis (
        id SERIAL PRIMARY KEY,
        ticker TEXT UNIQUE NOT NULL,
        name TEXT,
        sector TEXT,
        type TEXT,
        last_price NUMERIC,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        ticker TEXT NOT NULL,
        date DATE NOT NULL,
        open NUMERIC,
        high NUMERIC,
        low NUMERIC,
        close NUMERIC,
        volume BIGINT,
        UNIQUE(ticker, date)
      );

      CREATE TABLE IF NOT EXISTS fundamentals (
        id SERIAL PRIMARY KEY,
        ticker TEXT NOT NULL,
        date DATE NOT NULL,
        dividend_yield NUMERIC,
        pvp NUMERIC,
        patrimony NUMERIC,
        UNIQUE(ticker, date)
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        threshold NUMERIC,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        alert_id INTEGER,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS recommendations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ticker TEXT NOT NULL,
        action TEXT NOT NULL,
        score NUMERIC,
        reasons JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_ticker_date ON quotes(ticker, date DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, active);
      CREATE INDEX IF NOT EXISTS idx_fundamentals_ticker ON fundamentals(ticker, date DESC);
    `);

    console.log("✅ Estrutura do banco verificada/criada");
  } finally {
    client.release();
  }
}

// ============================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// ============================================================
// ROTAS DE AUTENTICAÇÃO
// ============================================================

// Registro de usuário
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email, hashed, name || null]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, email: result.rows[0].email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user: result.rows[0], token });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email já cadastrado" });
    }
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ============================================================
// COLETA DE DADOS - APIs FINANCEIRAS
// ============================================================
class DataCollector {
  async fetchFIIData(ticker) {
    const cacheKey = `fii_${ticker}`;

    // Verifica cache Redis
    try {
      if (redisAvailable && redisClient) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      console.error("Redis cache error:", err);
    }

    // Simula dados (em produção, usar API real)
    const mockData = this.generateMockFIIData(ticker);

    // Salva no cache por 5 minutos
    try {
      if (redisAvailable && redisClient) {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(mockData));
      }
    } catch (err) {
      console.error("Redis set error:", err);
    }

    return mockData;
  }

  generateMockFIIData(ticker) {
    const basePrice = 90 + Math.random() * 30;
    const variation = (Math.random() - 0.5) * 2;

    return {
      ticker,
      currentPrice: parseFloat((basePrice + variation).toFixed(2)),
      previousClose: parseFloat(basePrice.toFixed(2)),
      open: parseFloat((basePrice - 0.5).toFixed(2)),
      high: parseFloat((basePrice + 1.2).toFixed(2)),
      low: parseFloat((basePrice - 0.8).toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 500000,
      dividendYield: parseFloat((0.8 + Math.random() * 0.4).toFixed(2)),
      pvp: parseFloat((0.95 + Math.random() * 0.2).toFixed(2)),
      change: parseFloat(variation.toFixed(2)),
      changePercent: parseFloat(((variation / basePrice) * 100).toFixed(2)),
      lastUpdate: new Date().toISOString(),
    };
  }

  async fetchHistoricalData(ticker, days = 365) {
    const data = [];
    const basePrice = 95;
    let currentPrice = basePrice;

    const today = new Date();
    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const change = (Math.random() - 0.5) * 2;
      currentPrice += change;

      data.push({
        date: date.toISOString().split("T")[0],
        open: parseFloat((currentPrice - Math.random() * 0.5).toFixed(2)),
        high: parseFloat((currentPrice + Math.random() * 1.5).toFixed(2)),
        low: parseFloat((currentPrice - Math.random() * 1.5).toFixed(2)),
        close: parseFloat(currentPrice.toFixed(2)),
        volume: Math.floor(Math.random() * 500000) + 300000,
      });
    }

    return data;
  }
}

const dataCollector = new DataCollector();

// ============================================================
// ANÁLISE TÉCNICA
// ============================================================
class TechnicalAnalysis {
  calculateSMA(data, period) {
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data
        .slice(i - period + 1, i + 1)
        .reduce((acc, val) => acc + val.close, 0);
      sma.push({
        date: data[i].date,
        value: parseFloat((sum / period).toFixed(2)),
      });
    }
    return sma;
  }

  calculateRSI(data, period = 14) {
    const rsi = [];
    const gains = [];
    const losses = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);

      if (i >= period) {
        const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsiValue = 100 - 100 / (1 + rs);

        rsi.push({
          date: data[i].date,
          value: parseFloat(rsiValue.toFixed(2)),
        });
      }
    }

    return rsi;
  }

  calculateMACD(data) {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);

    const macd = [];
    const minLength = Math.min(ema12.length, ema26.length);

    for (let i = 0; i < minLength; i++) {
      macd.push({
        date: ema12[i].date,
        macd: parseFloat((ema12[i].value - ema26[i].value).toFixed(2)),
      });
    }

    const macdValues = macd.map((m) => m.macd);
    const signal = this.calculateEMAFromValues(macdValues, 9);

    return macd.map((m, i) => ({
      date: m.date,
      macd: m.macd,
      signal: signal[i] ? parseFloat(signal[i].toFixed(2)) : 0,
      histogram: signal[i]
        ? parseFloat((m.macd - signal[i]).toFixed(2))
        : m.macd,
    }));
  }

  calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [];

    let emaValue =
      data.slice(0, period).reduce((sum, val) => sum + val.close, 0) / period;

    for (let i = period; i < data.length; i++) {
      emaValue = data[i].close * k + emaValue * (1 - k);
      ema.push({
        date: data[i].date,
        value: parseFloat(emaValue.toFixed(2)),
      });
    }

    return ema;
  }

  calculateEMAFromValues(values, period) {
    const k = 2 / (period + 1);
    const ema = [];

    let emaValue = values.slice(0, period).reduce((a, b) => a + b) / period;

    for (let i = period; i < values.length; i++) {
      emaValue = values[i] * k + emaValue * (1 - k);
      ema.push(emaValue);
    }

    return ema;
  }

  calculateBollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(data, period);
    const bands = [];

    for (let i = 0; i < sma.length; i++) {
      const dataIndex = i + period - 1;
      const slice = data.slice(i, i + period);
      const mean = sma[i].value;

      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val.close - mean, 2), 0) /
        period;
      const std = Math.sqrt(variance);

      bands.push({
        date: data[dataIndex].date,
        upper: parseFloat((mean + stdDev * std).toFixed(2)),
        middle: mean,
        lower: parseFloat((mean - stdDev * std).toFixed(2)),
      });
    }

    return bands;
  }

  generateSignals(data) {
    const rsi = this.calculateRSI(data);
    const macd = this.calculateMACD(data);
    const sma20 = this.calculateSMA(data, 20);
    const sma50 = this.calculateSMA(data, 50);

    const currentPrice = data[data.length - 1].close;
    const latestRSI = rsi.length > 0 ? rsi[rsi.length - 1].value : 50;
    const latestMACD = macd.length > 0 ? macd[macd.length - 1] : null;

    let signal = "NEUTRO";
    let confidence = 0;
    const reasons = [];

    // RSI oversold/overbought
    if (latestRSI < 30) {
      signal = "COMPRA";
      confidence += 25;
      reasons.push("RSI indica sobrevenda (< 30)");
    } else if (latestRSI > 70) {
      signal = "VENDA";
      confidence += 25;
      reasons.push("RSI indica sobrecompra (> 70)");
    }

    // MACD crossover
    if (latestMACD && latestMACD.histogram > 0) {
      if (signal === "COMPRA") confidence += 20;
      reasons.push("MACD positivo");
    } else if (latestMACD && latestMACD.histogram < 0) {
      if (signal === "VENDA") confidence += 20;
      reasons.push("MACD negativo");
    }

    // Médias móveis
    const latest20 = sma20.length > 0 ? sma20[sma20.length - 1].value : null;
    const latest50 = sma50.length > 0 ? sma50[sma50.length - 1].value : null;

    if (latest20 && latest50) {
      if (latest20 > latest50) {
        if (signal === "COMPRA") confidence += 15;
        reasons.push("SMA 20 acima de SMA 50 (tendência de alta)");
      } else {
        if (signal === "VENDA") confidence += 15;
        reasons.push("SMA 20 abaixo de SMA 50 (tendência de baixa)");
      }
    }

    return {
      signal,
      confidence: Math.min(confidence, 100),
      reasons,
      indicators: {
        rsi: latestRSI,
        macd: latestMACD,
        sma20: latest20,
        sma50: latest50,
      },
    };
  }
}

const technicalAnalysis = new TechnicalAnalysis();

// ============================================================
// SISTEMA DE RECOMENDAÇÕES
// ============================================================
class RecommendationEngine {
  async generateRecommendations(userId) {
    try {
      const userResult = await pool.query(
        "SELECT profile FROM users WHERE id = $1",
        [userId]
      );

      const userProfile = userResult.rows[0]?.profile || {
        risk_tolerance: "moderate",
      };

      // Buscar FIIs cadastrados
      const fiisResult = await pool.query(
        "SELECT ticker, name FROM fiis LIMIT 20"
      );
      const fiis = fiisResult.rows;

      if (fiis.length === 0) {
        // Se não houver FIIs, usar lista padrão
        const defaultTickers = [
          "HGLG11",
          "KNRI11",
          "MXRF11",
          "XPLG11",
          "VISC11",
        ];
        return await this.processRecommendations(defaultTickers, userProfile);
      }

      return await this.processRecommendations(
        fiis.map((f) => f.ticker),
        userProfile
      );
    } catch (error) {
      console.error("Error generating recommendations:", error);
      return [];
    }
  }

  async processRecommendations(tickers, userProfile) {
    const recommendations = [];

    for (const ticker of tickers.slice(0, 10)) {
      try {
        const data = await dataCollector.fetchFIIData(ticker);
        const historical = await dataCollector.fetchHistoricalData(ticker, 90);
        const signals = technicalAnalysis.generateSignals(historical);

        let score = 50;

        if (data.dividendYield > 1.0) score += 15;
        else if (data.dividendYield > 0.8) score += 10;

        if (data.pvp < 1.0) score += 10;
        else if (data.pvp < 1.1) score += 5;

        if (signals.signal === "COMPRA") score += signals.confidence * 0.3;
        else if (signals.signal === "VENDA") score -= signals.confidence * 0.2;

        const riskTolerance = userProfile?.risk_tolerance || "moderate";
        if (riskTolerance === "conservative" && data.dividendYield > 1.0) {
          score += 10;
        } else if (
          riskTolerance === "aggressive" &&
          signals.signal === "COMPRA"
        ) {
          score += 15;
        }

        let action = "HOLD";
        if (score >= 70) action = "BUY";
        else if (score <= 40) action = "SELL";

        recommendations.push({
          ticker,
          action,
          score: Math.round(score),
          currentPrice: data.currentPrice,
          dividendYield: data.dividendYield,
          pvp: data.pvp,
          reasons: [
            `Dividend Yield: ${data.dividendYield.toFixed(2)}%`,
            `P/VP: ${data.pvp.toFixed(2)}`,
            `Sinal técnico: ${signals.signal}`,
            ...signals.reasons,
          ],
        });
      } catch (error) {
        console.error(`Error processing ${ticker}:`, error);
      }
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations;
  }
}

const recommendationEngine = new RecommendationEngine();

// ============================================================
// SISTEMA DE ALERTAS
// ============================================================
class AlertSystem {
  async checkAlerts() {
    try {
      const result = await pool.query(`
        SELECT a.*, u.email, u.name
        FROM alerts a
        JOIN users u ON a.user_id = u.id
        WHERE a.active = true
      `);

      for (const alert of result.rows) {
        try {
          const data = await dataCollector.fetchFIIData(alert.ticker);
          let triggered = false;
          let message = "";

          switch (alert.alert_type) {
            case "price_above":
              if (data.currentPrice > alert.threshold) {
                triggered = true;
                message = `${
                  alert.ticker
                } atingiu R$ ${data.currentPrice.toFixed(2)} (acima de R$ ${
                  alert.threshold
                })`;
              }
              break;
            case "price_below":
              if (data.currentPrice < alert.threshold) {
                triggered = true;
                message = `${
                  alert.ticker
                } caiu para R$ ${data.currentPrice.toFixed(2)} (abaixo de R$ ${
                  alert.threshold
                })`;
              }
              break;
            case "rsi_oversold":
              const historical = await dataCollector.fetchHistoricalData(
                alert.ticker,
                30
              );
              const rsi = technicalAnalysis.calculateRSI(historical);
              const latestRSI =
                rsi.length > 0 ? rsi[rsi.length - 1].value : null;
              if (latestRSI && latestRSI < 30) {
                triggered = true;
                message = `${alert.ticker} com RSI em ${latestRSI.toFixed(
                  2
                )} - Possível oportunidade de compra!`;
              }
              break;
          }

          if (triggered) {
            await this.sendNotification(alert.user_id, alert.id, message);
          }
        } catch (error) {
          console.error(`Error checking alert ${alert.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in checkAlerts:", error);
    }
  }

  async sendNotification(userId, alertId, message) {
    try {
      await pool.query(
        "INSERT INTO notifications (user_id, alert_id, message) VALUES ($1, $2, $3)",
        [userId, alertId, message]
      );

      console.log(`📧 Notificação salva: ${message}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
}

const alertSystem = new AlertSystem();

// ============================================================
// ROTAS DA API
// ============================================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Listar FIIs
app.get("/api/fiis", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM fiis ORDER BY ticker LIMIT 100"
    );

    if (result.rows.length === 0) {
      // Retorna lista padrão se não houver FIIs no banco
      const defaultFIIs = [
        {
          ticker: "HGLG11",
          name: "CSHG Logística",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "KNRI11",
          name: "Kinea Renda Imobiliária",
          sector: "Híbrido",
          type: "Híbrido",
        },
        {
          ticker: "MXRF11",
          name: "Maxi Renda",
          sector: "Híbrido",
          type: "Papel",
        },
        {
          ticker: "XPLG11",
          name: "XP Log",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "VISC11",
          name: "Vinci Shopping Centers",
          sector: "Shoppings",
          type: "Tijolo",
        },
      ];
      return res.json(defaultFIIs);
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching FIIs:", error);
    res.status(500).json({ error: "Erro ao buscar FIIs" });
  }
});

// Dados em tempo real de um FII
app.get("/api/fiis/:ticker", authenticateToken, async (req, res) => {
  try {
    const { ticker } = req.params;
    const data = await dataCollector.fetchFIIData(ticker.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error("Error fetching FII data:", error);
    res.status(500).json({ error: "Erro ao buscar dados do FII" });
  }
});

// Histórico de cotações
app.get("/api/fiis/:ticker/history", authenticateToken, async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 365 } = req.query;
    const data = await dataCollector.fetchHistoricalData(
      ticker.toUpperCase(),
      parseInt(days)
    );
    res.json(data);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// Análise técnica
app.get("/api/fiis/:ticker/analysis", authenticateToken, async (req, res) => {
  try {
    const { ticker } = req.params;
    const historical = await dataCollector.fetchHistoricalData(
      ticker.toUpperCase(),
      365
    );

    const analysis = {
      signals: technicalAnalysis.generateSignals(historical),
      sma: {
        sma20: technicalAnalysis.calculateSMA(historical, 20).slice(-30),
        sma50: technicalAnalysis.calculateSMA(historical, 50).slice(-30),
        sma200: technicalAnalysis.calculateSMA(historical, 200).slice(-30),
      },
      rsi: technicalAnalysis.calculateRSI(historical).slice(-30),
      macd: technicalAnalysis.calculateMACD(historical).slice(-30),
      bollinger: technicalAnalysis
        .calculateBollingerBands(historical)
        .slice(-30),
    };

    res.json(analysis);
  } catch (error) {
    console.error("Error generating analysis:", error);
    res.status(500).json({ error: "Erro ao gerar análise técnica" });
  }
});

// Recomendações personalizadas
app.get("/api/recommendations", authenticateToken, async (req, res) => {
  try {
    const recommendations = await recommendationEngine.generateRecommendations(
      req.user.id
    );
    res.json(recommendations);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: "Erro ao gerar recomendações" });
  }
});

// Criar alerta
app.post("/api/alerts", authenticateToken, async (req, res) => {
  try {
    const { ticker, type, threshold } = req.body;

    if (!ticker || !type) {
      return res.status(400).json({ error: "Ticker e tipo são obrigatórios" });
    }

    const result = await pool.query(
      "INSERT INTO alerts (user_id, ticker, alert_type, threshold) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, ticker.toUpperCase(), type, threshold || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: "Erro ao criar alerta" });
  }
});

// Listar alertas do usuário
app.get("/api/alerts", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT * FROM alerts
      WHERE user_id = $1 AND active = true
      ORDER BY created_at DESC
    `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Erro ao buscar alertas" });
  }
});

// Deletar alerta
app.delete("/api/alerts/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query(
      "UPDATE alerts SET active = false WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting alert:", error);
    res.status(500).json({ error: "Erro ao deletar alerta" });
  }
});

// Notificações do usuário
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Erro ao buscar notificações" });
  }
});

// Marcar notificação como lida
app.patch(
  "/api/notifications/:id/read",
  authenticateToken,
  async (req, res) => {
    try {
      await pool.query(
        "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ error: "Erro ao atualizar notificação" });
    }
  }
);

// Atualizar perfil do usuário
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { name, profile } = req.body;

    const result = await pool.query(
      "UPDATE users SET name = $1, profile = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, name, profile",
      [name, JSON.stringify(profile), req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

// Dashboard - Estatísticas gerais
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const stats = {
      totalFIIs: 0,
      activeAlerts: 0,
      unreadNotifications: 0,
      topPerformers: [],
      marketSummary: {},
    };

    // Total de FIIs
    const fiisCount = await pool.query("SELECT COUNT(*) FROM fiis");
    stats.totalFIIs = parseInt(fiisCount.rows[0].count);

    if (stats.totalFIIs === 0) {
      stats.totalFIIs = 156; // Valor padrão se não houver FIIs
    }

    // Alertas ativos
    const alertsCount = await pool.query(
      "SELECT COUNT(*) FROM alerts WHERE user_id = $1 AND active = true",
      [req.user.id]
    );
    stats.activeAlerts = parseInt(alertsCount.rows[0].count);

    // Notificações não lidas
    const notifCount = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false",
      [req.user.id]
    );
    stats.unreadNotifications = parseInt(notifCount.rows[0].count);

    // Top performers (simulado)
    const topTickers = ["HGLG11", "KNRI11", "MXRF11", "XPLG11", "VISC11"];
    for (const ticker of topTickers) {
      try {
        const data = await dataCollector.fetchFIIData(ticker);
        stats.topPerformers.push({
          ticker,
          price: data.currentPrice,
          change: data.changePercent,
          dividendYield: data.dividendYield,
        });
      } catch (error) {
        console.error(`Error fetching ${ticker}:`, error);
      }
    }

    stats.topPerformers.sort((a, b) => b.change - a.change);

    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Erro ao buscar dashboard" });
  }
});

// ============================================================
// JOBS AGENDADOS (CRON)
// ============================================================

// Atualizar cotações a cada 5 minutos (em horário de mercado)
cron.schedule("*/5 * * * *", async () => {
  console.log("⏰ Executando atualização de cotações...");

  try {
    const result = await pool.query("SELECT ticker FROM fiis LIMIT 50");

    for (const fii of result.rows) {
      try {
        const data = await dataCollector.fetchFIIData(fii.ticker);

        // Atualiza preço no banco
        await pool.query(
          "UPDATE fiis SET last_price = $1, updated_at = NOW() WHERE ticker = $2",
          [data.currentPrice, fii.ticker]
        );

        console.log(`✅ ${fii.ticker}: R$ ${data.currentPrice.toFixed(2)}`);
      } catch (error) {
        console.error(`Error updating ${fii.ticker}:`, error);
      }
    }
  } catch (error) {
    console.error("❌ Erro na atualização de cotações:", error);
  }
});

// Verificar alertas a cada 2 minutos
cron.schedule("*/2 * * * *", async () => {
  console.log("🔔 Verificando alertas...");
  try {
    await alertSystem.checkAlerts();
  } catch (error) {
    console.error("Error checking alerts:", error);
  }
});

// ============================================================
// SEED DE DADOS INICIAIS
// ============================================================

async function seedData() {
  const client = await pool.connect();
  try {
    // Verificar se já existem FIIs
    const count = await client.query("SELECT COUNT(*) FROM fiis");

    if (parseInt(count.rows[0].count) === 0) {
      console.log("📊 Inserindo FIIs de exemplo...");

      const fiis = [
        {
          ticker: "HGLG11",
          name: "CSHG Logística",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "KNRI11",
          name: "Kinea Renda Imobiliária",
          sector: "Híbrido",
          type: "Híbrido",
        },
        {
          ticker: "MXRF11",
          name: "Maxi Renda",
          sector: "Híbrido",
          type: "Papel",
        },
        {
          ticker: "XPLG11",
          name: "XP Log",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "VISC11",
          name: "Vinci Shopping Centers",
          sector: "Shoppings",
          type: "Tijolo",
        },
        {
          ticker: "BTLG11",
          name: "BTG Logística",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "PVBI11",
          name: "Vinci Offices",
          sector: "Lajes Corporativas",
          type: "Tijolo",
        },
        {
          ticker: "HGRE11",
          name: "CSHG Real Estate",
          sector: "Lajes Corporativas",
          type: "Tijolo",
        },
        {
          ticker: "KNCR11",
          name: "Kinea Crédito",
          sector: "Papel",
          type: "Papel",
        },
        {
          ticker: "RZTR11",
          name: "Riza Terrax",
          sector: "Desenvolvimento",
          type: "Tijolo",
        },
        {
          ticker: "BRCO11",
          name: "Bresco Logística",
          sector: "Logística",
          type: "Tijolo",
        },
        {
          ticker: "VGIR11",
          name: "Valora CRI",
          sector: "Papel",
          type: "Papel",
        },
        {
          ticker: "TRXF11",
          name: "TRX Real Estate",
          sector: "Lajes Corporativas",
          type: "Tijolo",
        },
        {
          ticker: "HSML11",
          name: "HSI Malls",
          sector: "Shoppings",
          type: "Tijolo",
        },
        {
          ticker: "BRCR11",
          name: "BC Fund",
          sector: "Híbrido",
          type: "Híbrido",
        },
      ];

      for (const fii of fiis) {
        await client.query(
          "INSERT INTO fiis (ticker, name, sector, type) VALUES ($1, $2, $3, $4) ON CONFLICT (ticker) DO NOTHING",
          [fii.ticker, fii.name, fii.sector, fii.type]
        );
      }

      console.log("✅ FIIs inseridos com sucesso");
    }

    // Criar usuário admin se não existir
    const userCheck = await client.query(
      "SELECT id FROM users WHERE email = $1",
      ["admin@fiis.local"]
    );
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO users (email, password, name) VALUES ($1, $2, $3)",
        ["admin@fiis.local", hashedPassword, "Administrador"]
      );
      console.log("✅ Usuário admin criado: admin@fiis.local / admin123");
    }
  } finally {
    client.release();
  }
}

// ============================================================
// FUNÇÃO PARA AGUARDAR POSTGRES
// ============================================================

async function waitForPostgres(retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log("✅ PostgreSQL conectado");
      return true;
    } catch (err) {
      console.warn(
        `⚠️ Tentativa ${i + 1}/${retries} - Aguardando PostgreSQL...`
      );
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error("PostgreSQL indisponível após várias tentativas");
}

// ============================================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================================

async function startServer() {
  try {
    console.log("🚀 Iniciando servidor...");

    // Aguarda PostgreSQL estar disponível
    await waitForPostgres();

    // Inicializa banco de dados
    await initDatabase();

    // Inicializa Redis (opcional)
    await initRedis();

    // Insere dados iniciais
    await seedData();

    // Inicia servidor HTTP
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     🏢  SISTEMA DE MONITORAMENTO DE FIIs - API        ║
║                                                        ║
║     🚀 Servidor rodando em http://0.0.0.0:${PORT}      ║
║     📊 Database: PostgreSQL conectado                 ║
║     💾 Cache: Redis ${
        redisAvailable ? "conectado" : "desativado"
      }                     ║
║     ⏰ Jobs agendados: Ativos                         ║
║                                                        ║
║     📡 Endpoints disponíveis:                         ║
║        POST /api/auth/register                        ║
║        POST /api/auth/login                           ║
║        GET  /api/health                               ║
║        GET  /api/fiis                                 ║
║        GET  /api/fiis/:ticker                         ║
║        GET  /api/fiis/:ticker/history                 ║
║        GET  /api/fiis/:ticker/analysis                ║
║        GET  /api/recommendations                      ║
║        GET  /api/alerts                               ║
║        POST /api/alerts                               ║
║        GET  /api/notifications                        ║
║        GET  /api/dashboard                            ║
║                                                        ║
║     👤 Usuário padrão:                                ║
║        Email: admin@fiis.local                        ║
║        Senha: admin123                                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

// ============================================================
// TRATAMENTO DE ERROS E SHUTDOWN GRACIOSO
// ============================================================

process.on("SIGTERM", async () => {
  console.log("📴 SIGTERM recebido - Encerrando servidor graciosamente...");
  try {
    await pool.end();
    if (redisAvailable && redisClient) {
      await redisClient.quit();
    }
    console.log("✅ Conexões fechadas com sucesso");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao fechar conexões:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("📴 SIGINT recebido - Encerrando servidor graciosamente...");
  try {
    await pool.end();
    if (redisAvailable && redisClient) {
      await redisClient.quit();
    }
    console.log("✅ Conexões fechadas com sucesso");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao fechar conexões:", error);
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Inicia o servidor
startServer();

module.exports = app;
