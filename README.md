# ComunicCNC — versão online em Node.js

Sistema para o professor publicar um PDF e exibi-lo automaticamente nos monitores do laboratório/torno CNC. Com a versão hospedada em HTTPS, o PC do professor e os Raspberry Pi podem estar em redes diferentes, desde que todos tenham acesso à internet.

## O que está pronto

- Painel do professor com envio de PDF.
- Modo monitor: adicione `?modo=monitor` ao endereço para deixar a tela exibindo o projeto.
- Atualização automática do PDF a cada 3 segundos.
- API compatível com as rotas `GET /api/health`, `POST /api/upload`, `GET /api/projeto` e `GET /uploads/projeto.pdf`.
- Limite de PDF de 50 MB e validação da assinatura do arquivo.
- Senha do professor para proteger os envios na hospedagem.
- Supabase Storage para manter o PDF salvo mesmo que a hospedagem reinicie.
- O armazenamento Supabase fica privado; a chave secreta fica somente nas variáveis do servidor, nunca no navegador.

## IMPORTANTE antes de publicar na internet

1. O PC do professor e os monitores precisam ter internet. Não é necessário que estejam na mesma rede local.
2. Os PDFs serão guardados no Supabase Storage. Sem essa configuração, a versão online bloqueia envios para não guardar arquivos no disco temporário da hospedagem.
3. Escolha uma senha forte para `ADMIN_PASSWORD` e mantenha a chave do Supabase em segredo.
4. O endereço dos monitores permite visualizar o projeto publicado. Use esta solução apenas para desenhos que a escola/empresa autoriza disponibilizar por esse endereço. A senha protege o envio de PDFs, mas não transforma a página de visualização em um sistema corporativo com contas individuais.
5. O plano gratuito do Render pode suspender o serviço quando não recebe solicitações por 15 minutos; ao voltar, a primeira abertura pode demorar cerca de um minuto. Os monitores que consultam o sistema continuamente tendem a manter o serviço ativo enquanto estão abertos.

## A. Rodar localmente para testar no próprio PC

Requer Node.js 20 ou superior.

1. Extraia o ZIP.
2. Abra a pasta extraída no VS Code.
3. Clique em **Terminal → New Terminal**.
4. Execute:

   ```powershell
   npm install
   npm start
   ```

5. No navegador do mesmo computador, abra `http://127.0.0.1:5000/api/health`. A resposta deve conter `"status":"ok"`.
6. Abra `http://127.0.0.1:5000`, selecione um PDF e publique.
7. Abra `http://127.0.0.1:5000/?modo=monitor` para testar o visualizador.

Quando rodado localmente, os PDFs ficam em `uploads/`. Para acessar de outro PC por este endereço local, os computadores precisam estar na mesma rede e o firewall precisa permitir a conexão. Para funcionar entre redes diferentes, siga as próximas etapas de hospedagem.

## B. Criar o armazenamento permanente no Supabase

1. Abra `https://supabase.com/` e crie um projeto.
2. No painel do projeto, abra **Storage** e crie um bucket chamado exatamente `projetos-cnc`.
3. Deixe o bucket como **Private**.
4. Em **Project Settings → API Keys** (ou no painel **Connect**, conforme o layout), copie a **Project URL** e crie/copiei uma **Secret key** de servidor (`sb_secret_...`). Uma chave antiga `service_role` também é aceita.
5. Guarde a URL e a chave. Não cole a chave no HTML/JavaScript e não a envie para o GitHub. A chave deve ser configurada somente nas variáveis de ambiente do servidor Render.

## C. Publicar o sistema no Render para obter uma URL HTTPS

O `render.yaml` incluído descreve o serviço. A forma mais simples é colocar os arquivos desta pasta em um repositório GitHub e conectar esse repositório ao Render.

### C1. Colocar o código no GitHub

1. No GitHub, crie um repositório novo, por exemplo `comuniccnc-online`.
2. Envie os arquivos e pastas que estão dentro desta pasta do projeto (não envie `node_modules`, `.env` nem PDFs da pasta `uploads`).
3. Confira se `server.js`, `package.json`, `render.yaml` e a pasta `static` aparecem na raiz do repositório.

### C2. Criar o serviço

1. Entre em `https://render.com/` e conecte sua conta GitHub.
2. Escolha **New → Web Service** e selecione o repositório `comuniccnc-online`.
3. Se não usar o Blueprint `render.yaml`, configure:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Nas variáveis de ambiente (**Environment**), cadastre exatamente:

   | Nome | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `SUPABASE_URL` | A Project URL do seu Supabase, começando com `https://` |
   | `SUPABASE_SECRET_KEY` | A Secret key do Supabase (ou use o nome `SUPABASE_SERVICE_ROLE_KEY` para uma chave antiga) |
   | `SUPABASE_BUCKET` | `projetos-cnc` |
   | `ADMIN_PASSWORD` | Crie uma senha forte para o professor |

5. Salve as variáveis e espere o deploy terminar.
6. O Render fornecerá um endereço parecido com `https://comuniccnc-online.onrender.com`. Use o endereço real exibido pelo painel. O Render configura HTTPS para o serviço público.

## D. Testar pela internet

Supondo que a hospedagem tenha fornecido `https://comuniccnc-online.onrender.com` (exemplo; seu endereço será diferente):

1. No PC do professor, abra `https://SEU-ENDERECO.onrender.com/api/health`. Deve aparecer JSON com `"status":"ok"`, `"armazenamento":"supabase"` e `"armazenamento_configurado":true`.
2. Abra `https://SEU-ENDERECO.onrender.com` no PC do professor.
3. Digite a senha que você colocou em `ADMIN_PASSWORD`, selecione o PDF e clique **Publicar nos monitores**.
4. Em um segundo computador conectado a outra rede, abra `https://SEU-ENDERECO.onrender.com/?modo=monitor`.
5. O PDF deve aparecer no PC2. Envie um PDF diferente pelo PC do professor; o PC2 deve atualizar em alguns segundos.

**Não use `127.0.0.1`, o IPv4 da rede da escola ou a porta `5000` nos monitores da versão online.** Use sempre a URL HTTPS pública fornecida pelo Render.

## E. Raspberry Pi 3

Depois de testar com o PC2, edite `raspberry/iniciar_monitor.sh` e substitua `https://SEU-SERVICO.onrender.com` pelo endereço HTTPS real do seu serviço. Copie o script para o Pi e execute:

```bash
chmod +x iniciar_monitor.sh
./iniciar_monitor.sh
```

O Raspberry Pi precisa conseguir acessar a internet e ter Chromium instalado. A página será aberta em modo de tela cheia.

## Endpoints da API

- `GET /api/health` — confirma que o servidor está funcionando e informa o modo de armazenamento.
- `GET /api/status` — status de diagnóstico e presença de projeto.
- `POST /api/upload` — envia o arquivo PDF usando multipart/form-data, campo `arquivo`; na hospedagem exige o header `X-Admin-Password`.
- `GET /api/projeto` — retorna JSON com URL, versão, data e tamanho do PDF atual.
- `GET /uploads/projeto.pdf` — entrega o PDF publicado.

## Problemas comuns

- **O health mostra armazenamento local:** o app não está em produção ou as variáveis do Supabase não foram configuradas.
- **Upload retorna 401:** a senha digitada não é igual a `ADMIN_PASSWORD` no Render.
- **Upload retorna 503:** faltou configurar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SUPABASE_BUCKET`.
- **Upload retorna erro 500/502 do Supabase:** confira se a URL e a chave estão corretas, e se o bucket privado `projetos-cnc` foi criado.
- **Primeira abertura demora:** um serviço gratuito do Render pode estar iniciando após ficar inativo.
- **O PC2 não abre o endereço:** confirme que está usando a URL HTTPS real do Render, e que o PC2 tem internet.

Consulte `DEPLOY_PASSO_A_PASSO.md` para um checklist resumido da publicação.
