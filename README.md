# Monitor no Torno CNC — protótipo local

Este protótipo roda um servidor Flask e um cliente web no mesmo computador. O site envia um PDF ao servidor e exibe o projeto na página.

## Requisitos

- Python 3 instalado
- VS Code (opcional, para editar os arquivos)

## Iniciar no Windows

Abra o terminal do VS Code nesta pasta e execute:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Depois abra no navegador: <http://127.0.0.1:5000>

A pasta `uploads` já existe e o servidor também a cria se for removida. O PDF enviado fica salvo como `uploads/projeto.pdf`; um envio novo substitui o anterior.

## Arquivos principais

- `app.py`: servidor e endpoints da API.
- `static/index.html`: página do cliente.
- `static/app.js`: envio e exibição do PDF.
- `static/style.css`: aparência da página.
- `requirements.txt`: dependência Python.

O cliente e a API usam a mesma origem (`127.0.0.1:5000`), então o protótipo não precisa de configuração CORS.
