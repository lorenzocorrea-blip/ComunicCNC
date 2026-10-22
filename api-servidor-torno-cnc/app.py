from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # limite de 50 MB

# Permite o cliente web local durante o desenvolvimento.
# Para outros endereços, adicione a origem do cliente nesta lista.
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


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "mensagem": "API do monitor CNC está funcionando."})


@app.post("/api/upload")
def receber_pdf():
    arquivo = request.files.get("arquivo")

    if arquivo is None or arquivo.filename == "":
        return jsonify({"erro": "Envie um arquivo no campo 'arquivo'."}), 400

    if not arquivo.filename.lower().endswith(".pdf"):
        return jsonify({"erro": "Só aceito arquivos PDF."}), 400

    if not arquivo.stream.read(5).startswith(b"%PDF-"):
        return jsonify({"erro": "O arquivo não parece ser um PDF válido."}), 400

    arquivo.stream.seek(0)
    caminho_pdf = UPLOAD_DIR / "projeto.pdf"
    arquivo.save(caminho_pdf)

    return jsonify({
        "mensagem": "Projeto enviado com sucesso.",
        "arquivo": "projeto.pdf",
        "url": "/uploads/projeto.pdf",
    }), 201


@app.get("/api/projeto")
def consultar_projeto():
    caminho_pdf = UPLOAD_DIR / "projeto.pdf"
    if not caminho_pdf.exists():
        return jsonify({"erro": "Ainda não há projeto enviado."}), 404

    return jsonify({
        "arquivo": "projeto.pdf",
        "url": "/uploads/projeto.pdf",
    })


@app.get("/uploads/projeto.pdf")
def baixar_projeto():
    caminho_pdf = UPLOAD_DIR / "projeto.pdf"
    if not caminho_pdf.exists():
        return jsonify({"erro": "Ainda não há projeto enviado."}), 404

    return send_from_directory(UPLOAD_DIR, "projeto.pdf", mimetype="application/pdf")


@app.errorhandler(413)
def arquivo_muito_grande(_erro):
    return jsonify({"erro": "O arquivo ultrapassa o limite de 50 MB."}), 413


if __name__ == "__main__":
    # Para outro aparelho na rede acessar, use o IP deste computador no cliente.
    app.run(host="0.0.0.0", port=5000, debug=False)
