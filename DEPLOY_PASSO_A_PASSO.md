# Publicar o ComunicCNC na internet — checklist

## 1. Supabase (guardar os PDFs)
- [ ] Criar projeto no Supabase.
- [ ] Storage → criar bucket privado `projetos-cnc`.
- [ ] Copiar a Project URL.
- [ ] Copiar/criar uma Secret key de servidor (`sb_secret_...`). Não enviar essa chave para GitHub nem ao navegador.

## 2. GitHub (guardar o código)
- [ ] Criar repositório `comuniccnc-online`.
- [ ] Enviar os arquivos desta pasta, incluindo `render.yaml`, `server.js`, `package.json` e `static/`.
- [ ] Não enviar `node_modules`, `.env` ou PDFs.

## 3. Render (publicar o site)
- [ ] Conectar o GitHub ao Render.
- [ ] Criar um Web Service com o repositório.
- [ ] Build Command: `npm install`.
- [ ] Start Command: `npm start`.
- [ ] Definir `NODE_ENV=production`.
- [ ] Definir `SUPABASE_URL` com a URL do projeto Supabase.
- [ ] Definir `SUPABASE_SECRET_KEY` com a chave secreta.
- [ ] Definir `SUPABASE_BUCKET=projetos-cnc`.
- [ ] Definir `ADMIN_PASSWORD` com a senha do professor.
- [ ] Aguardar o deploy e copiar a URL HTTPS.

## 4. Testar no PC1 e PC2
- [ ] PC1: abrir `https://SUA-URL.onrender.com/api/health`.
- [ ] Conferir `"status":"ok"`, `"armazenamento":"supabase"` e `"armazenamento_configurado":true`.
- [ ] PC1: abrir a URL sem `/api/health`, inserir a senha, selecionar PDF e publicar.
- [ ] PC2, mesmo em outra rede: abrir `https://SUA-URL.onrender.com/?modo=monitor`.
- [ ] Publicar um segundo PDF no PC1 e confirmar atualização no PC2.

Use a URL real gerada pelo Render. `SUA-URL` é apenas um exemplo.
