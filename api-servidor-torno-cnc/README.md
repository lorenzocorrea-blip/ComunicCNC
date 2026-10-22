# API do Monitor do Torno CNC — link do PDF

Esta pasta contém somente a API. Ela recebe o link de um PDF em JSON, guarda o link e devolve esse JSON ao cliente. O cliente pode estar em outro computador e abre o PDF usando o link recebido.

## Iniciar no Windows

Abra o terminal nesta pasta e execute:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

A API roda na porta `5000`. No mesmo computador, a base é `http://127.0.0.1:5000`. Em outro computador, use o IP do computador que está rodando a API, por exemplo `http://192.168.1.50:5000`.

## Enviar o link

Faça uma requisição `POST` para `/api/projeto` com JSON:

```json
{
  "url": "https://exemplo.com/desenho.pdf"
}
```

Exemplo usando PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5000/api/projeto -ContentType "application/json" -Body '{"url":"https://exemplo.com/desenho.pdf"}'
```

## Buscar o link

O cliente faz `GET /api/projeto`. A resposta será:

```json
{
  "url": "https://exemplo.com/desenho.pdf"
}
```

O cliente então coloca esse valor no `src` de um `iframe` ou abre o link no navegador. Também há `GET /api/health` para conferir se a API está ligada.

O link precisa funcionar no computador que vai exibir o PDF. Links de arquivos locais como `C:\\...` ou `file:///...` não funcionam em outro computador. Se o cliente web usar uma porta/origem diferente das listadas em `app.py`, adicione essa origem na configuração de CORS.
