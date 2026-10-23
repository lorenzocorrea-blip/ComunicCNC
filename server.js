'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;
const STATIC_DIR = path.join(BASE_DIR, 'static');
const LOCAL_UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
const LOCAL_PDF_PATH = path.join(LOCAL_UPLOAD_DIR, 'projeto.pdf');
const LOCAL_META_PATH = path.join(LOCAL_UPLOAD_DIR, 'projeto-meta.json');
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Em hospedagem online, use Supabase Storage para que os PDFs não desapareçam
// quando o serviço reiniciar. Sem estas variáveis, o projeto usa arquivos locais
// para desenvolvimento e testes no computador.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'projetos-cnc';
const REMOTE_STORAGE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_BUCKET);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
});

function storageReady() {
  return IS_PRODUCTION ? REMOTE_STORAGE_CONFIGURED : true;
}

function hasLocalIPv4() {
  const results = [];
  for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) results.push({ interfaceName, address: entry.address });
    }
  }
  return results;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireTeacherPassword(req, res, next) {
  if (IS_PRODUCTION && !ADMIN_PASSWORD) {
    return res.status(503).json({ erro: 'Configure a variável ADMIN_PASSWORD nas configurações da hospedagem antes de publicar PDFs.' });
  }
  // Localmente, a senha é opcional para facilitar o primeiro teste. Na internet,
  // NODE_ENV=production obriga configurar ADMIN_PASSWORD.
  if (!ADMIN_PASSWORD && !IS_PRODUCTION) return next();
  const provided = req.get('x-admin-password') || '';
  if (!provided || !safeEqual(provided, ADMIN_PASSWORD)) {
    return res.status(401).json({ erro: 'Senha do professor incorreta. Confira a senha configurada na hospedagem.' });
  }
  return next();
}

function supabaseObjectUrl(objectName) {
  const bucket = encodeURIComponent(SUPABASE_BUCKET);
  const object = objectName.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/${bucket}/${object}`;
}

async function remoteUpload(objectName, body, contentType) {
  if (!REMOTE_STORAGE_CONFIGURED) {
    throw new Error('Armazenamento online não configurado. Configure SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_BUCKET.');
  }
  const response = await fetch(supabaseObjectUrl(objectName), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': 'no-store',
    },
    body,
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error(`[Supabase Storage] Falha no envio (${response.status}): ${details.slice(0, 500)}`);
    throw new Error(`Não foi possível guardar o arquivo no armazenamento online (HTTP ${response.status}). Confira as configurações do Supabase.`);
  }
}

async function remoteDownload(objectName) {
  if (!REMOTE_STORAGE_CONFIGURED) {
    throw new Error('Armazenamento online não configurado. Configure as variáveis do Supabase na hospedagem.');
  }
  const response = await fetch(supabaseObjectUrl(objectName), {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'cache-control': 'no-store',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* corpo pode não ser JSON */ }
    const message = `${parsed.message || ''} ${parsed.error || ''} ${parsed.statusCode || ''} ${body}`;
    if (response.status === 404 || String(parsed.statusCode) === '404' || /object not found|not_found|bucket not found/i.test(message)) {
      return null;
    }
    console.error(`[Supabase Storage] Falha na leitura (${response.status}): ${body.slice(0, 500)}`);
    throw new Error(`Não foi possível ler o armazenamento online (HTTP ${response.status}). Confira o Supabase.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function saveProject(pdfBuffer) {
  const nowMs = Date.now();
  const metadata = {
    arquivo: 'projeto.pdf',
    url: '/uploads/projeto.pdf',
    atualizado_em: Math.floor(nowMs / 1000),
    versao: nowMs,
    tamanho_bytes: pdfBuffer.length,
  };

  if (REMOTE_STORAGE_CONFIGURED) {
    // O PDF e o arquivo de metadados ficam em um bucket privado. O servidor
    // acessa o bucket usando a chave secreta guardada somente nas variáveis de ambiente.
    await remoteUpload('projeto.pdf', pdfBuffer, 'application/pdf');
    await remoteUpload('projeto-meta.json', Buffer.from(JSON.stringify(metadata), 'utf8'), 'application/json');
    return metadata;
  }

  if (IS_PRODUCTION) {
    throw new Error('Armazenamento persistente não configurado. Configure Supabase Storage antes de usar a hospedagem online.');
  }

  const tempPdf = path.join(LOCAL_UPLOAD_DIR, `projeto-${process.pid}-${nowMs}.tmp`);
  const tempMeta = path.join(LOCAL_UPLOAD_DIR, `projeto-meta-${process.pid}-${nowMs}.tmp`);
  await fsp.writeFile(tempPdf, pdfBuffer);
  await fsp.writeFile(tempMeta, JSON.stringify(metadata, null, 2), 'utf8');
  await fsp.rename(tempPdf, LOCAL_PDF_PATH);
  await fsp.rename(tempMeta, LOCAL_META_PATH);
  return metadata;
}

async function getCurrentProject() {
  if (REMOTE_STORAGE_CONFIGURED) {
    const metadataBuffer = await remoteDownload('projeto-meta.json');
    if (!metadataBuffer) return null;
    let metadata;
    try { metadata = JSON.parse(metadataBuffer.toString('utf8')); }
    catch { throw new Error('O arquivo de informações do projeto no Supabase está inválido. Publique o PDF novamente.'); }
    if (!metadata || !metadata.versao || !metadata.url) return null;
    return metadata;
  }

  if (IS_PRODUCTION) {
    throw new Error('Armazenamento persistente não configurado na hospedagem.');
  }

  try {
    const metadataText = await fsp.readFile(LOCAL_META_PATH, 'utf8');
    const metadata = JSON.parse(metadataText);
    return metadata;
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        const stat = await fsp.stat(LOCAL_PDF_PATH);
        return {
          arquivo: 'projeto.pdf', url: '/uploads/projeto.pdf',
          atualizado_em: Math.floor(stat.mtimeMs / 1000), versao: Math.floor(stat.mtimeMs), tamanho_bytes: stat.size,
        };
      } catch (pdfError) {
        if (pdfError.code === 'ENOENT') return null;
        throw pdfError;
      }
    }
    if (error instanceof SyntaxError) throw new Error('O arquivo de informações do projeto está inválido. Publique o PDF novamente.');
    throw error;
  }
}

async function getPdfBuffer() {
  if (REMOTE_STORAGE_CONFIGURED) return remoteDownload('projeto.pdf');
  if (IS_PRODUCTION) throw new Error('Armazenamento persistente não configurado na hospedagem.');
  try { return await fsp.readFile(LOCAL_PDF_PATH); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.use('/static', express.static(STATIC_DIR, { fallthrough: true, etag: true, maxAge: '1h' }));

app.get('/api/health', (_req, res) => {
  const configured = REMOTE_STORAGE_CONFIGURED || !IS_PRODUCTION;
  res.json({
    status: 'ok',
    mensagem: 'API do ComunicCNC está funcionando.',
    armazenamento: REMOTE_STORAGE_CONFIGURED ? 'supabase' : 'local',
    armazenamento_configurado: configured,
    senha_professor_configurada: Boolean(ADMIN_PASSWORD),
  });
});

app.get('/api/status', async (_req, res, next) => {
  try {
    if (!storageReady()) {
      return res.status(503).json({ status: 'configuracao_pendente', projeto_disponivel: false, erro: 'Configure o Supabase nas variáveis de ambiente da hospedagem.' });
    }
    const projeto = await getCurrentProject();
    res.json({ status: 'ok', armazenamento: REMOTE_STORAGE_CONFIGURED ? 'supabase' : 'local', projeto_disponivel: Boolean(projeto), projeto });
  } catch (error) { next(error); }
});

app.post('/api/upload', requireTeacherPassword, upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!storageReady()) {
      return res.status(503).json({ erro: 'Armazenamento online não configurado. Configure SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_BUCKET na hospedagem.' });
    }
    if (!req.file) return res.status(400).json({ erro: "Envie um arquivo PDF no campo 'arquivo'." });
    if (!req.file.originalname || !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ erro: 'Só aceito arquivos com extensão .pdf.' });
    }
    if (req.file.buffer.length < 5 || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(400).json({ erro: 'O arquivo não parece ser um PDF válido.' });
    }
    const metadata = await saveProject(req.file.buffer);
    return res.status(201).json({ mensagem: 'Projeto publicado com sucesso.', ...metadata });
  } catch (error) { next(error); }
});

app.get('/api/projeto', async (_req, res, next) => {
  try {
    if (!storageReady()) {
      return res.status(503).json({ erro: 'Armazenamento online não configurado na hospedagem.' });
    }
    const projeto = await getCurrentProject();
    if (!projeto) return res.status(404).json({ erro: 'Ainda não há projeto enviado.' });
    return res.json(projeto);
  } catch (error) { next(error); }
});

app.get('/uploads/projeto.pdf', async (_req, res, next) => {
  try {
    if (!storageReady()) return res.status(503).json({ erro: 'Armazenamento online não configurado na hospedagem.' });
    const project = await getCurrentProject();
    if (!project) return res.status(404).json({ erro: 'Ainda não há projeto enviado.' });
    const pdf = await getPdfBuffer();
    if (!pdf) return res.status(404).json({ erro: 'Ainda não há projeto enviado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="projeto.pdf"');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.end(pdf);
  } catch (error) { next(error); }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).json({ erro: 'Rota não encontrada.' });
  return res.status(404).send('Página não encontrada. Abra a página inicial do ComunicCNC.');
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ erro: 'O arquivo ultrapassa o limite de 50 MB.' });
  }
  if (error instanceof multer.MulterError) return res.status(400).json({ erro: 'Não foi possível receber o arquivo. Confira o campo arquivo.' });
  console.error('[ERRO]', error.stack || error.message || error);
  if (res.headersSent) return;
  return res.status(500).json({ erro: error.message || 'Erro interno do servidor. Confira os logs da aplicação.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log('\n==============================================');
  console.log(' COMUNICCNC | NODE.JS - ONLINE OU LOCAL');
  console.log('==============================================');
  console.log(`Painel do professor: http://127.0.0.1:${PORT}`);
  console.log(`Teste da API:        http://127.0.0.1:${PORT}/api/health`);
  console.log(`Armazenamento:       ${REMOTE_STORAGE_CONFIGURED ? 'Supabase Storage (persistente)' : 'pasta local (desenvolvimento)'}`);
  console.log(`Senha professor:     ${ADMIN_PASSWORD ? 'configurada' : (IS_PRODUCTION ? 'FALTA CONFIGURAR' : 'opcional em teste local')}`);
  if (IS_PRODUCTION && !REMOTE_STORAGE_CONFIGURED) console.warn('ATENÇÃO: configure SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_BUCKET. Uploads ficam bloqueados em produção até a configuração.');
  console.log('\nEndereços LAN encontrados (apenas para testes locais):');
  const addresses = hasLocalIPv4();
  if (!addresses.length) console.log('  Nenhum IPv4 de rede foi detectado.');
  for (const item of addresses) console.log(`  ${item.interfaceName}: http://${item.address}:${PORT}/?modo=monitor`);
  console.log('\nPara acesso de qualquer rede, publique esta aplicação numa hospedagem HTTPS.');
  console.log('Mantenha esta janela aberta durante os testes locais. Pressione Ctrl+C para encerrar.\n');
});

function shutdown() {
  console.log('\nEncerrando servidor...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
