const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const winston = require('winston');
const morgan = require('morgan');
const fs = require('fs');
const NodeCache = require('node-cache');
require('dotenv').config();

// Configura o TTL do cache baseado no .env (em minutos). Padrão = 0 (sem cache)
const cacheMinutes = parseInt(process.env.CACHE_TTL_MINUTES) || 0;
const cacheTTL = cacheMinutes * 60;
const appCache = new NodeCache({ stdTTL: cacheTTL || 1 }); // node-cache falha se stdTTL for 0 no construtor para nossos propósitos de bypass, então passamos 1 e controlamos via if

// 🔧 Correção Automática para senhas com '#' no arquivo .env
// O dotenv corta a string ao encontrar o '#', tratando como comentário. 
// Para evitar que o usuário seja obrigado a usar aspas, vamos extrair a senha real direto do arquivo:
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/^DB_PASSWORD=(.*)$/m);
  if (match) {
    let rawPass = match[1].trim();
    // Se o usuário usou aspas, removemos
    if (rawPass.startsWith('"') && rawPass.endsWith('"')) {
      rawPass = rawPass.slice(1, -1);
    } else if (rawPass.startsWith("'") && rawPass.endsWith("'")) {
      rawPass = rawPass.slice(1, -1);
    }
    process.env.DB_PASSWORD = rawPass;
  }
} catch (e) {
  // Ignora se o arquivo não existir
}

// 1. Configuração de Logs Profissionais (Winston)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Controlado por variável de ambiente (debug para dev, info/warn para prod)
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'arvore-unidades-api' },
  transports: [
    // Grava os logs em arquivos rotativos (boas práticas)
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Em desenvolvimento, mostrar logs coloridos no console para facilitar a vida do desenvolvedor
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `[${timestamp}] ${level}: ${stack || message}`;
      })
    )
  }));
}

const app = express();
app.use(cors());
app.use(express.json()); // Necessário para receber JSON no POST

const path = require('path');
// 🚀 Serve os arquivos estáticos do frontend (index.html, imagens, etc)
// Com isso, não precisamos rodar um servidor separado (npx serve) em produção.
app.use(express.static(path.join(__dirname, '../frontend')));

// Validação de Variáveis de Ambiente no Startup
logger.info('Iniciando validação de variáveis de ambiente...');
const dataSource = process.env.DATA_SOURCE;

if (!dataSource || (dataSource !== 'db' && dataSource !== 'api')) {
  logger.error('CRÍTICO: A variável DATA_SOURCE não foi configurada corretamente no .env. Valores aceitos: "db" ou "api".');
  process.exit(1);
}

if (dataSource === 'db') {
  const requiredDbVars = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD'];
  const missing = requiredDbVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.error(`CRÍTICO: DATA_SOURCE está como 'db', mas faltam variáveis de banco: ${missing.join(', ')}`);
    process.exit(1);
  }
} else if (dataSource === 'api') {
  const requiredApiVars = ['API_AUTH_URL', 'API_BASE_URL', 'API_CLIENT_ID', 'API_CLIENT_SECRET', 'API_KEY'];
  const missing = requiredApiVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.error(`CRÍTICO: DATA_SOURCE está como 'api', mas faltam variáveis da API: ${missing.join(', ')}`);
    process.exit(1);
  }
}
logger.info(`Validação concluída. Fonte de dados configurada: ${dataSource.toUpperCase()}`);

// Intercepta todas as requisições HTTP e gera log usando o morgan
app.use(morgan(':remote-addr - :method :url :status :res[content-length] bytes - :response-time ms', {
  stream: { write: message => logger.debug(message.trim()) } // Usa o nível de debug/http para requisições comuns
}));

// 🚀 Endpoint para receber logs do Frontend
app.post('/api/logs', (req, res) => {
  const { level, message, stack, context } = req.body;
  if (level === 'error') {
    logger.error(`[FRONTEND - ${context}] ${message}`, { stack });
  } else {
    logger.info(`[FRONTEND - ${context}] ${message}`);
  }
  res.status(200).json({ success: true });
});

logger.info('Inicializando configurações e conectando ao banco/API...');

// 🔐 Configure seu banco usando variáveis de ambiente
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'devops.sigdevserver.uesb.br',
  database: process.env.DB_DATABASE || 'sistemas_comum',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5555,
});

// 🚀 Endpoint
app.get('/api/unidades', async (req, res) => {
  logger.info('Requisição recebida em /api/unidades');
  
  // 1. Verifica se a árvore já está em cache
  if (cacheTTL > 0) {
    const cachedTree = appCache.get('arvore_unidades');
    if (cachedTree) {
      logger.info('Servindo dados da árvore a partir do cache na memória (Rápido!).');
      return res.json(cachedTree);
    }
  }

  try {
    let rawData = [];

    if (process.env.DATA_SOURCE === 'api') {
      logger.debug('DATA_SOURCE definido como "api". Iniciando fluxo de autenticação OAuth2.');
      
      const authUrl = process.env.API_AUTH_URL || 'https://autenticacao.sigdev.uesb.br/authz-server/oauth/token';
      const params = new URLSearchParams();
      params.append('client_id', process.env.API_CLIENT_ID);
      params.append('client_secret', process.env.API_CLIENT_SECRET);
      params.append('grant_type', 'client_credentials');

      const tokenRes = await fetch(authUrl, { method: 'POST', body: params });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        if (tokenData.error === 'invalid_client') {
          throw new Error(`🔑 Credenciais Inválidas! O servidor negou o acesso. Verifique as variáveis 'API_CLIENT_ID' e 'API_CLIENT_SECRET' no seu arquivo .env. Detalhes: ${tokenData.error_description || JSON.stringify(tokenData)}`);
        }
        throw new Error(`Falha ao obter token da API. Status: ${tokenRes.status}. Resposta: ${JSON.stringify(tokenData)}`);
      }
      logger.debug('Access token obtido com sucesso.');

      // 2. Consumir API de Unidades com Paginação
      let offset = 0;
      const limit = 100;
      let allApiData = [];
      const apiBaseUrl = process.env.API_BASE_URL || 'https://api.sigdev.uesb.br/unidade/v1/unidades';

      logger.info(`Iniciando paginação na API. Base URL: ${apiBaseUrl}`);

      while (true) {
        logger.debug(`Buscando lote de ${limit} registros a partir do offset ${offset}...`);
        const apiUrl = `${apiBaseUrl}?ativa=true&limit=${limit}&offset=${offset}`;
        const apiRes = await fetch(apiUrl, {
          headers: {
            'Authorization': 'Bearer ' + tokenData.access_token,
            'x-api-key': process.env.API_KEY
          }
        });
        const apiData = await apiRes.json();

        if (!Array.isArray(apiData)) {
          if (apiData.httpCode) {
            logger.warn(`Aviso ou limite retornado pela API no offset ${offset}: ${apiData.mensagem}`);
            break; // Parar se vier um erro da API (como limite excedido)
          }
          throw new Error('Formato de resposta da API inválido ou inesperado');
        }

        if (apiData.length === 0) {
          logger.debug(`Nenhum registro encontrado no offset ${offset}. Paginação concluída.`);
          break; // Sem mais dados
        }

        allApiData = allApiData.concat(apiData);
        offset += limit;
      }

      logger.info(`Total de ${allApiData.length} registros capturados na API.`);

      // 3. Normalizar dados da API para o formato esperado pelo Frontend
      rawData = allApiData.map(item => ({
        id_unidade: item['id-unidade'],
        nome: item['nome-unidade'],
        sigla: item['sigla'],
        id_unid_resp_org: item['id-unidade-responsavel-organizacional'],
        codigo_unidade: item['codigo-unidade'],
        unidade_responsavel: item['id-unidade-gestora'],
        id_gestora_academica: item['id-unidade-gestora-academica'],
        categoria: item['id-classificacao-unidade'],
        visivel_apos_desativacao: item['visivel-apos-desativacao'],
        id_campus: item['id-municipio'],
        ativo: item['ativo'],
        organizacional: !!item['id-nivel-organizacional'],
        unidade_orcamentaria: item['orcamentaria'],
        patrimonial: item['unidade-patrimonial'],
        academica: item['academica'],
        data_inicio_vigencia: item['data-criacao']
      }));

      // 4. Ordena por sigla/nome (Filtro 'ativo' removido para delegar controle ao frontend)
      rawData.sort((a, b) => {
        const siglaA = a.sigla || '';
        const siglaB = b.sigla || '';
        if (siglaA !== siglaB) return siglaA.localeCompare(siglaB);
        const nomeA = a.nome || '';
        const nomeB = b.nome || '';
        return nomeA.localeCompare(nomeB);
      });

    } else {
      logger.debug('DATA_SOURCE definido como "db". Conectando diretamente ao banco PostgreSQL.');
      // Conexão direta com Banco de Dados (Sem filtro fixo de ativo=true)
      const result = await pool.query(`
        SELECT *
        FROM comum.unidade
        ORDER BY sigla, nome
      `);
      rawData = result.rows;
      logger.info(`Total de ${rawData.length} registros obtidos do banco de dados.`);
    }

    // Para evitar nós artificiais no topo, vamos detectar a "Raiz Principal" do banco (aquela com mais conexões)
    const childrenCount = {};
    rawData.forEach(u => {
      let p = u.id_unid_resp_org;
      if (p && String(p) !== String(u.id_unidade)) {
        childrenCount[p] = (childrenCount[p] || 0) + 1;
      }
    });

    const possibleRoots = rawData.filter(u => !u.id_unid_resp_org || String(u.id_unid_resp_org) === String(u.id_unidade));
    possibleRoots.sort((a, b) => (childrenCount[b.id_unidade] || 0) - (childrenCount[a.id_unidade] || 0));
    
    // A unidade principal oficial do organograma
    const mainRootId = possibleRoots.length > 0 ? possibleRoots[0].id_unidade : null;

    // Nó Virtual para Unidades Órfãs ou Raízes Secundárias
    const naoInformadaNode = {
      id: "root_nao_informada",
      parent: mainRootId ? mainRootId : "#", 
      data: {
        id_unidade: "root_nao_informada",
        nome: "Unidade Pai Não Informada (Órfãs/Desconexas)",
        sigla: "N/I",
        categoria: "Agrupador Analítico",
        ativo: false,
        organizacional: false
      }
    };

    // Criar um Set padronizado com Strings para não haver conflitos de tipagem (Int vs String)
    const validIds = new Set(rawData.map(u => String(u.id_unidade)));

    const tree = rawData.map(u => {
      const parentId = u.id_unid_resp_org;
      
      const isSelfParent = String(parentId) === String(u.id_unidade);
      // Aqui validamos corretamente se o parentId existe, convertendo para String
      const isMissingParent = parentId && !validIds.has(String(parentId));
      const isRoot = !parentId || isSelfParent;

      let finalParent;
      if (u.id_unidade === mainRootId) {
        finalParent = "#"; // Esta é a Raiz verdadeira do D3
      } else if (isRoot || isMissingParent) {
        finalParent = "root_nao_informada"; // Vai para a pasta "Não informada"
      } else {
        finalParent = parentId;
      }
      
      return {
        id: u.id_unidade,
        parent: finalParent,
        data: u
      };
    });

    const hasNaoInformada = tree.some(n => n.parent === "root_nao_informada");
    const fullTree = [];
    if (hasNaoInformada && mainRootId) fullTree.push(naoInformadaNode);
    fullTree.push(...tree);

    logger.info(`Árvore processada com sucesso. Total de nós: ${fullTree.length}`);
    
    // 5. Salva no Cache para as próximas requisições (se habilitado)
    if (cacheTTL > 0) {
      appCache.set('arvore_unidades', fullTree);
      logger.info(`Dados guardados no cache em memória por ${cacheMinutes} minutos.`);
    } else {
      logger.info(`Cache desativado (tempo real). Dados enviados diretamente.`);
    }

    res.json(fullTree);
  } catch (err) {
    logger.error(`Erro crítico no endpoint /api/unidades: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Erro no servidor', details: err.message });
  }
});

app.listen(3001, () => {
  logger.info('Servidor backend rodando e ouvindo na porta 3001');
});