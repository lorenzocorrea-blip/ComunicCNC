const form = document.querySelector("#upload-form");
const fileInput = document.querySelector("#pdf-file");
const uploadButton = document.querySelector("#upload-button");
const statusText = document.querySelector("#status");
const viewer = document.querySelector("#pdf-viewer");
const refreshButton = document.querySelector("#refresh-button");

function mostrarPdf(url) {
  // O parâmetro evita que o navegador mostre uma versão antiga do PDF.
  viewer.src = `${url}?atualizado=${Date.now()}`;
}

async function carregarProjeto() {
  try {
    const resposta = await fetch("/api/projeto");
    const dados = await resposta.json();

    if (!resposta.ok) {
      viewer.removeAttribute("src");
      statusText.textContent = dados.erro || "Nenhum projeto disponível.";
      return;
    }

    mostrarPdf(dados.url);
    statusText.textContent = "Projeto carregado.";
  } catch (erro) {
    statusText.textContent = "Não foi possível conectar ao servidor.";
  }
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const arquivo = fileInput.files[0];
  if (!arquivo) {
    statusText.textContent = "Escolha um arquivo PDF primeiro.";
    return;
  }

  const dados = new FormData();
  dados.append("arquivo", arquivo);
  uploadButton.disabled = true;
  statusText.textContent = "Enviando PDF...";

  try {
    const resposta = await fetch("/api/upload", {
      method: "POST",
      body: dados
    });
    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Falha ao enviar o PDF.");
    }

    statusText.textContent = resultado.mensagem;
    mostrarPdf(resultado.url);
    form.reset();
  } catch (erro) {
    statusText.textContent = erro.message || "Não foi possível conectar ao servidor.";
  } finally {
    uploadButton.disabled = false;
  }
});

refreshButton.addEventListener("click", carregarProjeto);
carregarProjeto();
