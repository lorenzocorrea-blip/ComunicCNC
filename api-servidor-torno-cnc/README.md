# API do Monitor do Torno CNC

Esta pasta contém somente a API Python. O cliente/site pode ficar em outra pasta ou ser feito por outra pessoa.

## Iniciar no Windows

Abra o terminal nesta pasta e execute:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

A API ficará em `http://127.0.0.1:5000` neste computador. A pasta `uploads` guarda o PDF atual como `projeto.pdf`; cada envio novo substitui o anterior.

## Endpoints

- `GET /api/health` — confirma que a API está funcionando.
- `POST /api/upload` — recebe o PDF como `multipart/form-data`, no campo `arquivo`.
- `GET /api/projeto` — retorna o caminho do PDF atual em JSON.
- `GET /uploads/projeto.pdf` — abre ou baixa o PDF.

Exemplo de resposta de `GET /api/projeto`:

```json
{
  "arquivo": "projeto.pdf",
  "url": "/uploads/projeto.pdf"
}
```

O cliente monta o endereço completo juntando a URL base da API com o campo `url`. Por exemplo: `http://127.0.0.1:5000/uploads/projeto.pdf`.

## Teste rápido no PowerShell

Com a API rodando, use outro terminal. Troque o caminho pelo caminho de um PDF existente:

```powershell
curl.exe -F "arquivo=@C:\caminho\desenho.pdf" http://127.0.0.1:5000/api/upload
Invoke-RestMethod http://127.0.0.1:5000/api/projeto
```

## Cliente web separado

CORS está liberado por padrão para clientes de desenvolvimento em `localhost` nas portas 5500 (Live Server) e 5173 (Vite). Se o cliente usar outra porta ou outro computador, adicione a origem dele na lista `origins` no `app.py`.

O cliente precisa usar a URL base da API (`http://127.0.0.1:5000` neste PC; no Raspberry Pi, use o IP do Pi), enviar o PDF com o campo `arquivo` e consultar `/api/projeto` para obter o PDF atual.
