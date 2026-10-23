'use strict';

const byId = (id) => document.getElementById(id);
const query = new URLSearchParams(window.location.search);
const monitorMode = query.get('modo') === 'monitor';
let currentVersion = null;
let uploadInProgress = false;
let monitorWasConnected = false;
let toastTimer = null;

if (monitorMode) {
  document.title = 'Torno CNC | Monitor';
  byId('teacherView').classList.add('hidden');
  byId('monitorView').classList.remove('hidden');
  document.documentElement.classList.add('monitor-document');
  document.body.classList.add('monitor-body');
  pollMonitor();
  window.setInterval(pollMonitor, 3000);
} else {
  document.title = 'Torno CNC | Central de Projetos';
  refreshTeacherStatus();
  window.setInterval(refreshTeacherStatus, 4000);
}

function setTeacherConnection(online) {
  const dot = byId('connectionDot');
  dot.classList.toggle('offline', !online);
  byId('connectionText').textContent = online ? 'Servidor conectado' : 'Servidor sem conexão';
  byId('syncState').textContent = online ? 'Ativo' : 'Offline';
}

function setMonitorConnection(online) {
  const dot = byId('monitorDot');
  dot.classList.toggle('offline', !online);
  byId('monitorStatus').textContent = online ? 'Servidor conectado' : 'Reconectando ao servidor...';
  if (!online) {
    byId('monitorStatus').classList.add('offline-text');
  } else {
    byId('monitorStatus').classList.remove('offline-text');
  }
}

function showUploadMessage(message, type = '') {
  const target = byId('uploadMessage');
  target.textContent = message;
  target.className = `message${type ? ` ${type}` : ''}`;
}

function setProjectState({ name, detail, badge, badgeClass, hasPdf }) {
  byId('projectName').textContent = name;
  byId('projectDetail').textContent = detail;
  byId('projectBadge').className = `status-badge ${badgeClass}`;
  byId('projectBadge').innerHTML = `<span></span> ${badge}`;
  byId('openProject').classList.toggle('hidden', !hasPdf);
}

if (!monitorMode) {
  byId('pdfFile').addEventListener('change', () => {
    const file = byId('pdfFile').files[0];
    byId('fileLabel').textContent = file ? file.name : 'Selecione um arquivo PDF';
    showUploadMessage('');
    byId('dropzone').classList.toggle('has-file', Boolean(file));
  });

  const dropzone = byId('dropzone');
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showUploadMessage('Selecione um arquivo com extensão PDF.', 'error');
      return;
    }
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      byId('pdfFile').files = transfer.files;
      byId('pdfFile').dispatchEvent(new Event('change'));
    } catch {
      showUploadMessage('Use o botão da área para selecionar o PDF.', 'error');
    }
  });

  byId('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (uploadInProgress) return;
    const file = byId('pdfFile').files[0];
    if (!file) {
      showUploadMessage('Selecione o PDF antes de publicar.', 'error');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showUploadMessage('O arquivo precisa ter extensão .pdf.', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showUploadMessage('O arquivo ultrapassa o limite de 50 MB.', 'error');
      return;
    }

    uploadInProgress = true;
    const button = byId('publishButton');
    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('span:nth-child(2)').textContent = 'Enviando PDF...';
    showUploadMessage('Enviando o projeto ao servidor...', 'pending');

    try {
      const form = new FormData();
      form.append('arquivo', file, file.name);
      const response = await fetch('/api/upload', { method: 'POST', headers: { 'X-Admin-Password': byId('adminPassword').value }, body: form, cache: 'no-store' });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(result.erro || 'Não foi possível publicar o PDF.');
      currentVersion = result.versao ?? result.atualizado_em ?? Date.now();
      showUploadMessage('Projeto publicado! Os monitores conectados serão atualizados automaticamente.', 'success');
      byId('pdfFile').value = '';
      byId('fileLabel').textContent = 'Selecione um arquivo PDF';
      dropzone.classList.remove('has-file');
      await refreshTeacherStatus(true);
    } catch (error) {
      showUploadMessage(error.message || 'Falha na comunicação com o servidor. Verifique a conexão.', 'error');
    } finally {
      uploadInProgress = false;
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('span:nth-child(2)').textContent = 'Publicar nos monitores';
    }
  });
}

async function safeJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

async function refreshTeacherStatus(force = false) {
  try {
    const healthResponse = await fetch('/api/health', { cache: 'no-store' });
    if (!healthResponse.ok) throw new Error('Servidor indisponível');
    setTeacherConnection(true);
    const response = await fetch('/api/projeto', { cache: 'no-store' });
    if (response.status === 404) {
      setProjectState({
        name: 'Nenhum projeto publicado',
        detail: 'Envie um PDF para começar.',
        badge: 'AGUARDANDO',
        badgeClass: 'waiting',
        hasPdf: false,
      });
      return;
    }
    const project = await safeJson(response);
    if (!response.ok) throw new Error(project.erro || 'Falha ao consultar projeto.');
    const version = project.versao ?? project.atualizado_em ?? project.url;
    setProjectState({
      name: project.arquivo || 'projeto.pdf',
      detail: `Última publicação: ${formatDate(project.atualizado_em)}`,
      badge: 'PUBLICADO',
      badgeClass: 'online',
      hasPdf: true,
    });
    byId('openProject').href = `${project.url}?v=${encodeURIComponent(version)}`;
    if (force || currentVersion === null) currentVersion = version;
  } catch {
    setTeacherConnection(false);
    setProjectState({
      name: 'Servidor não localizado',
      detail: 'Verifique se a janela do servidor está aberta.',
      badge: 'SEM CONEXÃO',
      badgeClass: 'waiting',
      hasPdf: false,
    });
  }
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return 'agora';
  try {
    return new Date(Number(unixSeconds) * 1000).toLocaleString('pt-BR');
  } catch { return 'atualizado'; }
}

async function pollMonitor() {
  try {
    const health = await fetch('/api/health', { cache: 'no-store' });
    if (!health.ok) throw new Error('API indisponível');
    setMonitorConnection(true);
    const response = await fetch('/api/projeto', { cache: 'no-store' });
    if (response.status === 404) {
      monitorWasConnected = true;
      if (currentVersion === null) {
        byId('monitorEmpty').classList.remove('hidden');
        byId('pdfFrame').classList.add('hidden');
        byId('monitorTitle').textContent = 'Aguardando o projeto';
        byId('monitorDescription').textContent = 'Quando o professor publicar um PDF, ele aparecerá nesta tela automaticamente.';
      }
      return;
    }
    const project = await safeJson(response);
    if (!response.ok) throw new Error(project.erro || 'Falha ao consultar projeto.');
    const version = project.versao ?? project.atualizado_em ?? project.url;
    if (version !== currentVersion) {
      currentVersion = version;
      byId('pdfFrame').src = `${project.url}?v=${encodeURIComponent(version)}#toolbar=1&navpanes=0`;
      byId('pdfFrame').classList.remove('hidden');
      byId('monitorEmpty').classList.add('hidden');
      showMonitorToast(monitorWasConnected ? 'Novo projeto recebido' : 'Projeto carregado');
    }
    monitorWasConnected = true;
  } catch {
    setMonitorConnection(false);
    if (currentVersion === null) {
      byId('monitorTitle').textContent = 'Conectando ao servidor';
      byId('monitorDescription').textContent = 'Verifique a conexão com a internet e tente novamente. O servidor pode estar inicializando.';
      byId('monitorEmpty').classList.remove('hidden');
    }
  }
}

function showMonitorToast(text) {
  byId('monitorToastText').textContent = text;
  byId('monitorToast').classList.remove('hidden');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => byId('monitorToast').classList.add('hidden'), 2200);
}
