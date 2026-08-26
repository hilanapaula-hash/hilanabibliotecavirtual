/* ===========================================
   MINHA BIBLIOTECA — script.js
   Responsável por: salvar/carregar livros no LocalStorage,
   abrir/fechar o modal de cadastro, renderizar a estante
   e atualizar o dashboard.
   =========================================== */

// Chave usada para guardar os dados no LocalStorage
const STORAGE_KEY = "minhaBiblioteca_livros";

// Lista de livros em memória (carregada do LocalStorage ao abrir o site)
let livros = [];

// Filtro e modo de visualização atuais
let filtroAtual = "todos";
let modoVisualizacao = "grid"; // ou "list"

/* ---------- ELEMENTOS DA TELA ---------- */
const modalOverlay = document.getElementById("modalOverlay");
const bookForm = document.getElementById("bookForm");
const modalTitle = document.getElementById("modalTitle");
const addBookBtn = document.getElementById("addBookBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const cancelBtn = document.getElementById("cancelBtn");
const toast = document.getElementById("toast");
const libraryGrid = document.getElementById("libraryGrid");
const recentBooksRow = document.getElementById("recentBooksRow");
const currentlyReadingRow = document.getElementById("currentlyReadingRow");
const gridViewBtn = document.getElementById("gridViewBtn");
const listViewBtn = document.getElementById("listViewBtn");

/* ===========================================
   FUNÇÕES DE ARMAZENAMENTO (LocalStorage)
   =========================================== */

// Carrega os livros salvos no navegador
function carregarLivros() {
  const dados = localStorage.getItem(STORAGE_KEY);
  livros = dados ? JSON.parse(dados) : [];
}

// Salva a lista de livros atual no navegador
function salvarLivros() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(livros));
}

// Gera um ID único para cada livro (baseado na data/hora atual)
function gerarId() {
  return "livro_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

/* ===========================================
   MODAL — abrir, fechar, salvar
   =========================================== */

function abrirModalParaAdicionar() {
  modalTitle.textContent = "Adicionar Livro";
  bookForm.reset();
  document.getElementById("bookId").value = "";
  modalOverlay.classList.add("active");
}

function fecharModal() {
  modalOverlay.classList.remove("active");
}

addBookBtn.addEventListener("click", abrirModalParaAdicionar);
modalCloseBtn.addEventListener("click", fecharModal);
cancelBtn.addEventListener("click", fecharModal);

// Fecha o modal se clicar fora da caixa branca
modalOverlay.addEventListener("click", function (evento) {
  if (evento.target === modalOverlay) {
    fecharModal();
  }
});

// Quando o formulário é enviado (botão "Salvar Livro")
bookForm.addEventListener("submit", function (evento) {
  evento.preventDefault(); // impede a página de recarregar

  const idExistente = document.getElementById("bookId").value;

  const dadosLivro = {
    id: idExistente || gerarId(),
    capa: document.getElementById("inputCapa").value.trim(),
    titulo: document.getElementById("inputTitulo").value.trim(),
    autor: document.getElementById("inputAutor").value.trim(),
    editora: document.getElementById("inputEditora").value.trim(),
    genero: document.getElementById("inputGenero").value.trim(),
    paginas: document.getElementById("inputPaginas").value || 0,
    ano: document.getElementById("inputAno").value || "",
    isbn: document.getElementById("inputIsbn").value.trim(),
    status: document.getElementById("inputStatus").value,
    sinopse: document.getElementById("inputSinopse").value.trim(),
    // Campos que ainda vamos usar nas próximas etapas (avaliação, etiquetas, datas, resenha, histórico)
    avaliacao: 0,
    etiquetas: [],
    dataInicio: "",
    dataFim: "",
    resenha: "",
    historico: [],
    dataCadastro: idExistente
      ? livros.find(l => l.id === idExistente).dataCadastro
      : new Date().toISOString()
  };

  if (idExistente) {
    // Editando um livro que já existe
    const indice = livros.findIndex(l => l.id === idExistente);
    livros[indice] = dadosLivro;
  } else {
    // Adicionando um livro novo
    livros.push(dadosLivro);
  }

  salvarLivros();
  fecharModal();
  mostrarToast("Livro salvo com sucesso! 📖");
  renderizarTudo();
});

/* ===========================================
   AVISO DISCRETO (TOAST)
   =========================================== */
function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("show");
  setTimeout(function () {
    toast.classList.remove("show");
  }, 2500);
}

/* ===========================================
   RENDERIZAÇÃO — desenhar os livros na tela
   =========================================== */

// Cria o HTML de um card de livro
function criarCardLivro(livro) {
  const capaHtml = livro.capa
    ? `<img class="book-cover" src="${livro.capa}" alt="Capa de ${livro.titulo}">`
    : `<div class="book-cover">📖</div>`;

  const nomesStatus = {
    lendo: "📚 Lendo",
    lido: "✅ Lido",
    relendo: "🔄 Relendo",
    abandonei: "❌ Abandonei"
  };

  const card = document.createElement("div");
  card.className = "book-card";
  card.innerHTML = `
    ${capaHtml}
    <div class="book-info">
      <div class="book-title">${livro.titulo}</div>
      <div class="book-author">${livro.autor}</div>
      <span class="book-status-badge status-${livro.status}">${nomesStatus[livro.status]}</span>
    </div>
  `;
  return card;
}

// Filtra os livros de acordo com o filtro rápido selecionado
function filtrarLivros() {
  if (filtroAtual === "todos") return livros;
  if (filtroAtual === "favoritos") return livros.filter(l => l.etiquetas.includes("favorito"));
  return livros.filter(l => l.status === filtroAtual);
}

// Desenha a estante principal
function renderizarEstante() {
  const listaFiltrada = filtrarLivros();
  libraryGrid.innerHTML = "";
  libraryGrid.className = modoVisualizacao === "list" ? "books-grid list-view" : "books-grid";

  if (listaFiltrada.length === 0) {
    libraryGrid.innerHTML = `<p class="empty-message">Nenhum livro encontrado para este filtro.</p>`;
    return;
  }

  listaFiltrada.forEach(function (livro) {
    libraryGrid.appendChild(criarCardLivro(livro));
  });
}

// Desenha a fileira de "Adicionados recentemente" (5 últimos)
function renderizarRecentes() {
  const recentes = [...livros]
    .sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro))
    .slice(0, 8);

  recentBooksRow.innerHTML = "";
  if (recentes.length === 0) {
    recentBooksRow.innerHTML = `<p class="empty-message">Nenhum livro cadastrado ainda.</p>`;
    return;
  }
  recentes.forEach(function (livro) {
    recentBooksRow.appendChild(criarCardLivro(livro));
  });
}

// Desenha a fileira de "Estou Lendo"
function renderizarLendoAgora() {
  const lendo = livros.filter(l => l.status === "lendo");
  currentlyReadingRow.innerHTML = "";
  if (lendo.length === 0) {
    currentlyReadingRow.innerHTML = `<p class="empty-message">Nenhuma leitura em andamento.</p>`;
    return;
  }
  lendo.forEach(function (livro) {
    currentlyReadingRow.appendChild(criarCardLivro(livro));
  });
}

// Atualiza os números do dashboard
function renderizarDashboard() {
  document.getElementById("statTotal").textContent = livros.length;
  document.getElementById("statLidos").textContent = livros.filter(l => l.status === "lido").length;
  document.getElementById("statLendo").textContent = livros.filter(l => l.status === "lendo").length;
  document.getElementById("statRelendo").textContent = livros.filter(l => l.status === "relendo").length;
  document.getElementById("statAbandonei").textContent = livros.filter(l => l.status === "abandonei").length;
  document.getElementById("statFavoritos").textContent = livros.filter(l => l.etiquetas.includes("favorito")).length;

  const totalPaginas = livros
    .filter(l => l.status === "lido")
    .reduce((soma, l) => soma + Number(l.paginas || 0), 0);
  document.getElementById("statPaginas").textContent = totalPaginas;

  const avaliados = livros.filter(l => l.avaliacao > 0);
  const media = avaliados.length
    ? (avaliados.reduce((s, l) => s + l.avaliacao, 0) / avaliados.length).toFixed(1)
    : "0.0";
  document.getElementById("statMedia").textContent = media;
}

// Chama todas as funções de renderização de uma vez
function renderizarTudo() {
  renderizarDashboard();
  renderizarRecentes();
  renderizarLendoAgora();
  renderizarEstante();
}

/* ===========================================
   FILTROS RÁPIDOS
   =========================================== */
document.querySelectorAll(".filter-chip").forEach(function (botao) {
  botao.addEventListener("click", function () {
    document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
    botao.classList.add("active");
    filtroAtual = botao.dataset.filter;
    renderizarEstante();
  });
});

/* ===========================================
   ALTERNAR ENTRE GRADE E LISTA
   =========================================== */
gridViewBtn.addEventListener("click", function () {
  modoVisualizacao = "grid";
  gridViewBtn.classList.add("active");
  listViewBtn.classList.remove("active");
  renderizarEstante();
});

listViewBtn.addEventListener("click", function () {
  modoVisualizacao = "list";
  listViewBtn.classList.add("active");
  gridViewBtn.classList.remove("active");
  renderizarEstante();
});

/* ===========================================
   INICIALIZAÇÃO — roda assim que a página carrega
   =========================================== */
carregarLivros();
renderizarTudo();
/* ===========================================
   BUSCA AUTOMÁTICA POR ISBN
   =========================================== */
const buscarIsbnBtn = document.getElementById("buscarIsbnBtn");
const isbnStatus = document.getElementById("isbnStatus");

buscarIsbnBtn.addEventListener("click", async function () {
  const isbn = document.getElementById("inputIsbn").value.trim();

  if (!isbn) {
    definirStatusIsbn("Digite um ISBN antes de buscar.", "error");
    return;
  }

  definirStatusIsbn("Buscando...", "loading");
  buscarIsbnBtn.disabled = true;

  const resultado = await buscarLivroPorISBN(isbn);

  buscarIsbnBtn.disabled = false;

  if (!resultado) {
    definirStatusIsbn("Livro não encontrado. Preencha manualmente.", "error");
    return;
  }

  // Preenche o formulário com os dados encontrados
  document.getElementById("inputTitulo").value = resultado.titulo;
  document.getElementById("inputAutor").value = resultado.autor;
  document.getElementById("inputEditora").value = resultado.editora;
  document.getElementById("inputGenero").value = resultado.genero;
  document.getElementById("inputPaginas").value = resultado.paginas;
  document.getElementById("inputAno").value = resultado.ano;
  document.getElementById("inputSinopse").value = resultado.sinopse;
  document.getElementById("inputCapa").value = resultado.capa;

  definirStatusIsbn("Livro encontrado! Confira os dados abaixo. ✓", "success");
});

// Atualiza a mensagem de status abaixo do campo de ISBN
function definirStatusIsbn(mensagem, tipo) {
  isbnStatus.textContent = mensagem;
  isbnStatus.className = "isbn-status " + tipo;
}
