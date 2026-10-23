import json
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
PROJECT_FILE = BASE_DIR / "projeto_atual.json"

app = Flask(__name__)

# Portas comuns de desenvolvimento local. Se o cliente usar outro endereço,
# inclua a origem dele nesta lista.
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    }
})


def ler_projeto():
    if not PROJECT_FILE.exists():
        return None
    try:
        return json.loads(PROJECT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "mensagem": "API do monitor CNC está funcionando."})


@app.post("/api/projeto")
def salvar_link_projeto():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie um JSON com o campo 'url'."}), 400

    url = dados.get("url")
    if not isinstance(url, str) or not url.strip():
        return jsonify({"erro": "O campo 'url' é obrigatório."}), 400

    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return jsonify({"erro": "Informe um link válido começando com http:// ou https://."}), 400

    projeto = {"url": url}
    PROJECT_FILE.write_text(json.dumps(projeto, ensure_ascii=False, indent=2), encoding="utf-8")
    return jsonify({"mensagem": "Link do projeto salvo.", **projeto}), 201


@app.get("/api/projeto")
def consultar_link_projeto():
    projeto = ler_projeto()
    if projeto is None:
        return jsonify({"erro": "Ainda não há link de projeto cadastrado."}), 404
    return jsonify(projeto)


if __name__ == "__main__":
    # O cliente em outro computador deve usar o IP deste PC/Raspberry Pi,
    # não localhost, como endereço base da API.
    app.run(host="0.0.0.0", port=5000, debug=False)
