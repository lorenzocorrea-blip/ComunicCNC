from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # limite de 50 MB


@app.get("/")
def pagina_inicial():
    return send_from_directory(STATIC_DIR, "index.html")


@app.post("/api/upload")
def receber_pdf():
    arquivo = request.files.get("arquivo")

    if arquivo is None or arquivo.filename == "":
        return jsonify({"erro": "Selecione um arquivo PDF."}), 400

    if not arquivo.filename.lower().endswith(".pdf"):
        return jsonify({"erro": "Só aceito arquivos PDF."}), 400

    if not arquivo.stream.read(5).startswith(b"%PDF-"):
        return jsonify({"erro": "O arquivo selecionado não parece ser um PDF."}), 400

    arquivo.stream.seek(0)
    arquivo.save(UPLOAD_DIR / "projeto.pdf")

    return jsonify({
        "mensagem": "Projeto enviado com sucesso.",
        "url": "/uploads/projeto.pdf"
    })


@app.get("/api/projeto")
def consultar_projeto():
    if not (UPLOAD_DIR / "projeto.pdf").exists():
        return jsonify({"erro": "Ainda não há projeto enviado."}), 404

    return jsonify({"url": "/uploads/projeto.pdf"})


@app.get("/uploads/projeto.pdf")
def abrir_pdf():
    caminho_pdf = UPLOAD_DIR / "projeto.pdf"
    if not caminho_pdf.exists():
        return jsonify({"erro": "Ainda não há projeto enviado."}), 404

    return send_from_directory(UPLOAD_DIR, "projeto.pdf")


if __name__ == "__main__":
    # Acessível pelo próprio PC e, na mesma rede, por outros dispositivos.
    app.run(host="0.0.0.0", port=5000, debug=False)
