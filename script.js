/* =========================================================
   ESTANTE — script principal
   Tudo é salvo no LocalStorage. Sem servidor, sem banco de dados.
   ========================================================= */

/* ------------------- CHAVES DE ARMAZENAMENTO ------------------- */
const CHAVE_LIVROS = "estante_livros";
const CHAVE_META = "estante_meta";
const CHAVE_TEMA = "estante_tema";

/* ------------------- ESTADO ------------------- */
let livros = [];
let meta = { ano: new Date().getFullYear(), quantidade: 25 };

let estado = {
  filtro: "todos",
  ordenacao: "recente",
  modoVisualizacao: "grade",
  busca: "",
  livroDetalheId: null,
  editandoId: null,
  atualizacaoLivroId: null,
  emojiSelecionado: null,
  confirmarCallback: null,
  capaEncontradaIsbn: ""
};

const STATUS_LABEL = {
  lendo: "📖 Lendo",
  lido: "✅ Lido",
  relendo: "🔄 Relendo",
  abandonei: "❌ Abandonei"
};
const STATUS_COR_CLASSE = { lendo: "lendo", lido: "lido", relendo: "relendo", abandonei: "abandonei" };

/* ========================================================
   PERSISTÊNCIA
   ======================================================== */
function carregarDados(){
  try{
    const brutos = localStorage.getItem(CHAVE_LIVROS);
    livros = brutos ? JSON.parse(brutos) : [];
  }catch(e){ livros = []; }

  try{
    const metaBruta = localStorage.getItem(CHAVE_META);
    if(metaBruta) meta = JSON.parse(metaBruta);
  }catch(e){ /* mantém padrão */ }

  const tema = localStorage.getItem(CHAVE_TEMA);
  if(tema === "escuro"){
    document.documentElement.setAttribute("data-theme", "escuro");
    document.getElementById("btn-tema").textContent = "☀️";
  }
}

function salvarLivros(){
  localStorage.setItem(CHAVE_LIVROS, JSON.stringify(livros));
}
function salvarMeta(){
  localStorage.setItem(CHAVE_META, JSON.stringify(meta));
}

/* ========================================================
   UTILITÁRIOS
   ======================================================== */
function gerarId(){
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(str){
  if(!str) return "";
  return str.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function formatarDataBR(iso){
  if(!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  if(!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
function hojeISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function mostrarToast(mensagem, tipo){
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast" + (tipo === "erro" ? " erro" : "");
  el.textContent = mensagem;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function calcularPorcentagem(pagina, total){
  if(!total || total <= 0) return 0;
  const pct = (Number(pagina) / Number(total)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
function capaPadrao(){
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#E4D6BC"/><text x="50%" y="52%" font-size="60" text-anchor="middle" dominant-baseline="middle">📖</text></svg>`
  );
}
function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ========================================================
   NAVEGAÇÃO ENTRE TELAS
   ======================================================== */
function trocarView(nome){
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById("view-" + nome).classList.remove("hidden");
  document.querySelectorAll(".navlink").forEach(b => b.classList.toggle("active", b.dataset.view === nome));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if(nome === "estatisticas") renderizarEstatisticas();
}

document.querySelectorAll(".navlink").forEach(btn => {
  btn.addEventListener("click", () => trocarView(btn.dataset.view));
});
document.getElementById("btn-ir-inicio").addEventListener("click", () => trocarView("inicio"));
document.getElementById("btn-voltar-livro").addEventListener("click", () => trocarView("inicio"));

/* ========================================================
   TEMA CLARO / ESCURO
   ======================================================== */
document.getElementById("btn-tema").addEventListener("click", () => {
  const atual = document.documentElement.getAttribute("data-theme");
  const novo = atual === "escuro" ? "claro" : "escuro";
  document.documentElement.setAttribute("data-theme", novo);
  document.getElementById("btn-tema").textContent = novo === "escuro" ? "☀️" : "🌙";
  localStorage.setItem(CHAVE_TEMA, novo);
});

/* ========================================================
   MENU DE BACKUP (EXPORTAR / IMPORTAR)
   ======================================================== */
const btnMenu = document.getElementById("btn-menu");
const menuBackup = document.getElementById("menu-backup");
btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  menuBackup.classList.toggle("hidden");
});
document.addEventListener("click", () => menuBackup.classList.add("hidden"));

document.getElementById("btn-exportar").addEventListener("click", () => {
  const pacote = { livros, meta, exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estante-backup-${hojeISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast("Backup exportado com sucesso!");
});

document.getElementById("btn-importar").addEventListener("click", () => {
  document.getElementById("input-importar").click();
});
document.getElementById("input-importar").addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  if(!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try{
      const dados = JSON.parse(leitor.result);
      const listaImportada = Array.isArray(dados) ? dados : dados.livros;
      if(!Array.isArray(listaImportada)) throw new Error("formato inválido");
      livros = listaImportada;
      if(dados.meta) meta = dados.meta;
      salvarLivros();
      salvarMeta();
      renderizarTudo();
      mostrarToast("Biblioteca importada com sucesso!");
    }catch(err){
      mostrarToast("Não foi possível ler esse arquivo. Verifique se é um backup válido.", "erro");
    }
  };
  leitor.readAsText(arquivo);
  e.target.value = "";
});

/* ========================================================
   MODAIS — abrir / fechar genérico
   ======================================================== */
function abrirModal(id){ document.getElementById(id).classList.remove("hidden"); }
function fecharModal(id){ document.getElementById(id).classList.add("hidden"); }

document.querySelectorAll("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", () => fecharModal(btn.dataset.closeModal));
});
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) overlay.classList.add("hidden");
  });
});

/* ========================================================
   CONFIRMAÇÃO GENÉRICA
   ======================================================== */
function pedirConfirmacao(texto, aoConfirmar){
  document.getElementById("confirmar-texto").textContent = texto;
  estado.confirmarCallback = aoConfirmar;
  abrirModal("modal-confirmar");
}
document.getElementById("btn-confirmar-cancelar").addEventListener("click", () => fecharModal("modal-confirmar"));
document.getElementById("btn-confirmar-ok").addEventListener("click", () => {
  if(typeof estado.confirmarCallback === "function") estado.confirmarCallback();
  fecharModal("modal-confirmar");
});

/* ========================================================
   DASHBOARD
   ======================================================== */
function renderizarDashboard(){
  const total = livros.length;
  const lidos = livros.filter(l => l.status === "lido").length;
  const lendo = livros.filter(l => l.status === "lendo").length;
  const relendo = livros.filter(l => l.status === "relendo").length;
  const abandonados = livros.filter(l => l.status === "abandonei").length;
  const favoritos = livros.filter(l => l.tags && l.tags.includes("favorito")).length;

  const paginasLidas = livros.reduce((soma, l) => {
    if(l.status === "lido") return soma + (Number(l.paginas) || 0);
    return soma + (Number(l.paginaAtual) || 0);
  }, 0);

  const avaliados = livros.filter(l => Number(l.avaliacao) > 0);
  const media = avaliados.length
    ? (avaliados.reduce((s, l) => s + Number(l.avaliacao), 0) / avaliados.length)
    : 0;

  document.getElementById("dash-total").textContent = total;
  document.getElementById("dash-lidos").textContent = lidos;
  document.getElementById("dash-lendo").textContent = lendo;
  document.getElementById("dash-relendo").textContent = relendo;
  document.getElementById("dash-abandonados").textContent = abandonados;
  document.getElementById("dash-favoritos").textContent = favoritos;
  document.getElementById("dash-paginas").textContent = paginasLidas.toLocaleString("pt-BR");
  document.getElementById("dash-media").textContent = media.toFixed(1);

  // Meta
  document.getElementById("goal-year").textContent = meta.ano;
  document.getElementById("goal-target").textContent = meta.quantidade;
  const lidosNoAno = livros.filter(l => l.status === "lido" && l.dataFim && l.dataFim.startsWith(String(meta.ano))).length;
  document.getElementById("goal-current").textContent = lidosNoAno;
  const pctMeta = meta.quantidade > 0 ? Math.min(100, Math.round((lidosNoAno / meta.quantidade) * 100)) : 0;
  document.getElementById("goal-progress-fill").style.width = pctMeta + "%";
}

document.getElementById("btn-editar-meta").addEventListener("click", () => {
  document.getElementById("meta-ano").value = meta.ano;
  document.getElementById("meta-quantidade").value = meta.quantidade;
  abrirModal("modal-meta");
});
document.getElementById("form-meta").addEventListener("submit", (e) => {
  e.preventDefault();
  meta.ano = Number(document.getElementById("meta-ano").value);
  meta.quantidade = Number(document.getElementById("meta-quantidade").value);
  salvarMeta();
  renderizarDashboard();
  fecharModal("modal-meta");
  mostrarToast("Meta atualizada!");
});

/* ========================================================
   CARTÃO DE LIVRO (usado na grade, carrosséis e busca)
   ======================================================== */
function criarCartaoLivro(livro){
  const card = document.createElement("div");
  card.className = "livro-card";
  card.addEventListener("click", () => abrirDetalheLivro(livro.id));

  const isFavorito = livro.tags && livro.tags.includes("favorito");
  const estrelas = "★".repeat(Number(livro.avaliacao) || 0) + "☆".repeat(5 - (Number(livro.avaliacao) || 0));
  const totalPag = Number(livro.paginas) || 0;
  const pctProgresso = livro.status === "lido" ? 100 : calcularPorcentagem(livro.paginaAtual, totalPag);

  card.innerHTML = `
    <div class="livro-capa-wrap">
      <img src="${livro.capa || capaPadrao()}" alt="Capa de ${escapeHtml(livro.titulo)}" loading="lazy" onerror="this.src='${capaPadrao()}'">
      <span class="status-badge ${STATUS_COR_CLASSE[livro.status]}">${STATUS_LABEL[livro.status].replace(/^\S+\s/, "")}</span>
      ${isFavorito ? '<span class="livro-fav">❤️</span>' : ""}
    </div>
    <div class="livro-info">
      <span class="livro-titulo">${escapeHtml(livro.titulo)}</span>
      <span class="livro-autor">${escapeHtml(livro.autor || "")}</span>
      <span class="livro-estrelas">${estrelas}</span>
      <div class="livro-progresso-mini"><div class="livro-progresso-mini-fill" style="width:${pctProgresso}%"></div></div>
    </div>
  `;
  return card;
}

function criarLinhaLivro(livro){
  const row = document.createElement("div");
  row.className = "livro-row";
  row.addEventListener("click", () => abrirDetalheLivro(livro.id));
  const totalPag = Number(livro.paginas) || 0;
  const pct = livro.status === "lido" ? 100 : calcularPorcentagem(livro.paginaAtual, totalPag);
  const estrelas = "★".repeat(Number(livro.avaliacao) || 0) + "☆".repeat(5 - (Number(livro.avaliacao) || 0));

  row.innerHTML = `
    <img src="${livro.capa || capaPadrao()}" alt="" onerror="this.src='${capaPadrao()}'">
    <div class="lr-info">
      <div class="lr-titulo">${escapeHtml(livro.titulo)}</div>
      <div class="lr-autor">${escapeHtml(livro.autor || "")} · <span style="color:var(--dourado)">${estrelas}</span></div>
    </div>
    <div class="lr-progresso">
      <div class="progress-bar" style="height:6px;background:var(--bg-elev-2)"><div class="progress-fill" style="width:${pct}%;background:var(--dourado)"></div></div>
      <div style="font-size:.72rem;color:var(--texto-suave);margin-top:2px">${pct}%</div>
    </div>
    <span class="lr-status status-badge ${STATUS_COR_CLASSE[livro.status]}" style="position:static">${STATUS_LABEL[livro.status].replace(/^\S+\s/, "")}</span>
  `;
  return row;
}

/* ========================================================
   BIBLIOTECA — FILTROS, ORDENAÇÃO, RENDERIZAÇÃO
   ======================================================== */
function aplicarFiltrosEOrdenacao(){
  let lista = [...livros];

  // filtro
  switch(estado.filtro){
    case "lendo": case "lido": case "relendo": case "abandonei":
      lista = lista.filter(l => l.status === estado.filtro); break;
    case "favorito": case "superestimado": case "nunca-mais":
      lista = lista.filter(l => l.tags && l.tags.includes(estado.filtro)); break;
    default: break;
  }

  // ordenação
  switch(estado.ordenacao){
    case "titulo": lista.sort((a,b) => a.titulo.localeCompare(b.titulo, "pt-BR")); break;
    case "autor": lista.sort((a,b) => (a.autor||"").localeCompare(b.autor||"", "pt-BR")); break;
    case "avaliacao": lista.sort((a,b) => (Number(b.avaliacao)||0) - (Number(a.avaliacao)||0)); break;
    case "paginas": lista.sort((a,b) => (Number(b.paginas)||0) - (Number(a.paginas)||0)); break;
    case "leitura": lista.sort((a,b) => new Date(b.dataFim || b.dataInicio || 0) - new Date(a.dataFim || a.dataInicio || 0)); break;
    default: lista.sort((a,b) => (b.criadoEm||0) - (a.criadoEm||0));
  }

  return lista;
}

function renderizarBiblioteca(){
  const lista = aplicarFiltrosEOrdenacao();
  const container = document.getElementById("biblioteca-grade");
  const vazio = document.getElementById("biblioteca-vazia");
  container.innerHTML = "";
  container.className = "biblioteca " + estado.modoVisualizacao;

  if(lista.length === 0){
    vazio.classList.remove("hidden");
  }else{
    vazio.classList.add("hidden");
    lista.forEach(livro => {
      container.appendChild(estado.modoVisualizacao === "grade" ? criarCartaoLivro(livro) : criarLinhaLivro(livro));
    });
  }
}

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    estado.filtro = chip.dataset.filtro;
    renderizarBiblioteca();
  });
});
document.getElementById("select-ordenar").addEventListener("change", (e) => {
  estado.ordenacao = e.target.value;
  renderizarBiblioteca();
});
document.getElementById("btn-view-grade").addEventListener("click", () => {
  estado.modoVisualizacao = "grade";
  document.getElementById("btn-view-grade").classList.add("active");
  document.getElementById("btn-view-lista").classList.remove("active");
  renderizarBiblioteca();
});
document.getElementById("btn-view-lista").addEventListener("click", () => {
  estado.modoVisualizacao = "lista";
  document.getElementById("btn-view-lista").classList.add("active");
  document.getElementById("btn-view-grade").classList.remove("active");
  renderizarBiblioteca();
});

/* ========================================================
   CARROSSÉIS: LENDO AGORA / RECENTES
   ======================================================== */
function renderizarCarrosseis(){
  const lendo = livros.filter(l => l.status === "lendo").sort((a,b) => (b.criadoEm||0)-(a.criadoEm||0));
  const recentes = [...livros].sort((a,b) => (b.criadoEm||0)-(a.criadoEm||0)).slice(0, 10);

  const cLendo = document.getElementById("carrossel-lendo");
  const cRecentes = document.getElementById("carrossel-recentes");
  cLendo.innerHTML = "";
  cRecentes.innerHTML = "";
  lendo.forEach(l => cLendo.appendChild(criarCartaoLivro(l)));
  recentes.forEach(l => cRecentes.appendChild(criarCartaoLivro(l)));

  document.getElementById("section-lendo-agora").classList.toggle("hidden", lendo.length === 0);
}

/* ========================================================
   BUSCA (barra superior, resultados instantâneos)
   ======================================================== */
const inputBusca = document.getElementById("input-busca");
const searchResults = document.getElementById("search-results");

function buscarLivros(termo){
  const t = termo.trim().toLowerCase();
  if(!t) return [];
  return livros.filter(l =>
    (l.titulo||"").toLowerCase().includes(t) ||
    (l.autor||"").toLowerCase().includes(t) ||
    (l.isbn||"").toLowerCase().includes(t) ||
    (l.genero||"").toLowerCase().includes(t) ||
    (l.editora||"").toLowerCase().includes(t) ||
    (STATUS_LABEL[l.status]||"").toLowerCase().includes(t)
  );
}

inputBusca.addEventListener("input", debounce(() => {
  const termo = inputBusca.value;
  if(!termo.trim()){
    searchResults.classList.add("hidden");
    return;
  }
  const resultados = buscarLivros(termo).slice(0, 8);
  searchResults.innerHTML = "";
  if(resultados.length === 0){
    searchResults.innerHTML = `<div class="search-empty">Nenhum livro encontrado para "${escapeHtml(termo)}".</div>`;
  }else{
    resultados.forEach(l => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `<img src="${l.capa || capaPadrao()}" onerror="this.src='${capaPadrao()}'"><div><div class="sr-title">${escapeHtml(l.titulo)}</div><div class="sr-autor">${escapeHtml(l.autor||"")}</div></div>`;
      item.addEventListener("click", () => {
        searchResults.classList.add("hidden");
        inputBusca.value = "";
        abrirDetalheLivro(l.id);
      });
      searchResults.appendChild(item);
    });
  }
  searchResults.classList.remove("hidden");
}, 180));

document.addEventListener("click", (e) => {
  if(!e.target.closest(".search-wrap")) searchResults.classList.add("hidden");
});

/* ========================================================
   MODAL: ADICIONAR / EDITAR LIVRO
   ======================================================== */
const formLivro = document.getElementById("form-livro");
const estrelasForm = document.getElementById("estrelas-form");

document.getElementById("btn-add-livro").addEventListener("click", () => abrirModalNovoLivro());

function abrirModalNovoLivro(){
  estado.editandoId = null;
  document.getElementById("modal-livro-titulo").textContent = "Adicionar livro";
  formLivro.reset();
  document.getElementById("livro-id").value = "";
  document.getElementById("preview-capa").src = capaPadrao();
  definirEstrelas(0);
  document.querySelectorAll('.tag-check input').forEach(cb => cb.checked = false);
  document.getElementById("resenha-contador").textContent = "0";
  document.getElementById("campo-status").value = "lendo";
  document.getElementById("campo-data-inicio").value = hojeISO();
  trocarAba("isbn");
  document.getElementById("isbn-preview").classList.add("hidden");
  document.getElementById("isbn-status").textContent = "";
  document.getElementById("input-isbn-busca").value = "";
  abrirModal("modal-livro");
}

function abrirModalEditarLivro(livro){
  estado.editandoId = livro.id;
  document.getElementById("modal-livro-titulo").textContent = "Editar livro";
  trocarAba("manual");
  document.getElementById("tabs-adicionar").classList.add("hidden");

  document.getElementById("livro-id").value = livro.id;
  document.getElementById("campo-capa").value = livro.capa || "";
  document.getElementById("preview-capa").src = livro.capa || capaPadrao();
  document.getElementById("campo-titulo").value = livro.titulo || "";
  document.getElementById("campo-autor").value = livro.autor || "";
  document.getElementById("campo-editora").value = livro.editora || "";
  document.getElementById("campo-genero").value = livro.genero || "";
  document.getElementById("campo-paginas").value = livro.paginas || "";
  document.getElementById("campo-ano").value = livro.ano || "";
  document.getElementById("campo-isbn").value = livro.isbn || "";
  document.getElementById("campo-sinopse").value = livro.sinopse || "";
  document.getElementById("campo-status").value = livro.status || "lendo";
  document.getElementById("campo-pagina-atual").value = livro.paginaAtual || "";
  document.getElementById("campo-data-inicio").value = livro.dataInicio || "";
  document.getElementById("campo-data-fim").value = livro.dataFim || "";
  definirEstrelas(Number(livro.avaliacao) || 0);
  document.querySelectorAll('.tag-check input').forEach(cb => {
    cb.checked = (livro.tags || []).includes(cb.value);
  });
  document.getElementById("campo-resenha").value = livro.resenha || "";
  document.getElementById("resenha-contador").textContent = String((livro.resenha||"").length);

  abrirModal("modal-livro");
}

// Restaurar abas ao fechar (para próxima vez que abrir modal "adicionar")
document.getElementById("modal-livro").addEventListener("transitionend", () => {});
function resetarTabsVisibilidade(){
  document.getElementById("tabs-adicionar").classList.remove("hidden");
}

/* Abas dentro do modal (ISBN / manual) */
function trocarAba(nome){
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === nome));
  document.getElementById("tab-isbn").classList.toggle("ativo", nome === "isbn");
  document.getElementById("form-livro").classList.toggle("ativo", nome === "manual" || nome === "isbn");
}
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => trocarAba(btn.dataset.tab));
});
// O formulário manual sempre fica visível junto do preview de ISBN (fluxo: buscar -> confirmar -> preenche form -> salvar)
document.getElementById("form-livro").classList.add("ativo");

/* Preview de capa ao digitar URL manualmente */
document.getElementById("campo-capa").addEventListener("input", (e) => {
  document.getElementById("preview-capa").src = e.target.value || capaPadrao();
});

/* Estrelas do formulário */
function definirEstrelas(valor){
  estrelasForm.dataset.valor = valor;
  estrelasForm.querySelectorAll(".estrela").forEach(btn => {
    btn.classList.toggle("selecionada", Number(btn.dataset.valor) <= valor);
  });
}
estrelasForm.querySelectorAll(".estrela").forEach(btn => {
  btn.addEventListener("click", () => {
    const novoValor = Number(btn.dataset.valor) === Number(estrelasForm.dataset.valor) ? 0 : Number(btn.dataset.valor);
    definirEstrelas(novoValor);
  });
});

/* Contador de caracteres da resenha */
document.getElementById("campo-resenha").addEventListener("input", (e) => {
  document.getElementById("resenha-contador").textContent = String(e.target.value.length);
});

/* Salvar livro (novo ou edição) */
formLivro.addEventListener("submit", (e) => {
  e.preventDefault();

  const titulo = document.getElementById("campo-titulo").value.trim();
  const autor = document.getElementById("campo-autor").value.trim();
  if(!titulo || !autor){
    mostrarToast("Preencha ao menos o título e o autor.", "erro");
    return;
  }

  const tags = Array.from(document.querySelectorAll('.tag-check input:checked')).map(cb => cb.value);

  const dadosForm = {
    capa: document.getElementById("campo-capa").value.trim(),
    titulo,
    autor,
    editora: document.getElementById("campo-editora").value.trim(),
    genero: document.getElementById("campo-genero").value.trim(),
    paginas: Number(document.getElementById("campo-paginas").value) || 0,
    ano: document.getElementById("campo-ano").value || "",
    isbn: document.getElementById("campo-isbn").value.trim(),
    sinopse: document.getElementById("campo-sinopse").value.trim(),
    status: document.getElementById("campo-status").value,
    paginaAtual: Number(document.getElementById("campo-pagina-atual").value) || 0,
    dataInicio: document.getElementById("campo-data-inicio").value,
    dataFim: document.getElementById("campo-data-fim").value,
    avaliacao: Number(estrelasForm.dataset.valor) || 0,
    tags,
    resenha: document.getElementById("campo-resenha").value
  };

  const idExistente = document.getElementById("livro-id").value;

  if(idExistente){
    const livro = livros.find(l => l.id === idExistente);
    Object.assign(livro, dadosForm);
    mostrarToast("Livro atualizado!");
  }else{
    const novoLivro = {
      id: gerarId(),
      ...dadosForm,
      historico: [],
      criadoEm: Date.now()
    };
    livros.unshift(novoLivro);
    mostrarToast("Livro adicionado com sucesso!");
  }

  salvarLivros();
  resetarTabsVisibilidade();
  fecharModal("modal-livro");
  renderizarTudo();
  if(idExistente && estado.livroDetalheId === idExistente) abrirDetalheLivro(idExistente);
});

/* ========================================================
   BUSCA POR ISBN (Google Books API, com fallback Open Library)
   ======================================================== */
document.getElementById("btn-buscar-isbn").addEventListener("click", buscarPorIsbn);
document.getElementById("input-isbn-busca").addEventListener("keydown", (e) => {
  if(e.key === "Enter"){ e.preventDefault(); buscarPorIsbn(); }
});

let ultimoLivroEncontrado = null;

async function buscarPorIsbn(){
  const isbn = document.getElementById("input-isbn-busca").value.replace(/[^0-9Xx]/g, "");
  const statusEl = document.getElementById("isbn-status");
  const previewEl = document.getElementById("isbn-preview");
  previewEl.classList.add("hidden");
  ultimoLivroEncontrado = null;

  if(!isbn){
    statusEl.textContent = "Digite um ISBN válido para buscar.";
    return;
  }
  statusEl.textContent = "🔎 Buscando informações do livro...";

  try{
    const resposta = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const dados = await resposta.json();

    if(dados.totalItems > 0 && dados.items && dados.items[0]){
      const info = dados.items[0].volumeInfo;
      ultimoLivroEncontrado = {
        capa: (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) || "").replace("http://", "https://"),
        titulo: info.title || "",
        autor: (info.authors || []).join(", "),
        editora: info.publisher || "",
        genero: (info.categories || []).join(", "),
        paginas: info.pageCount || "",
        ano: info.publishedDate ? info.publishedDate.slice(0,4) : "",
        sinopse: info.description || "",
        isbn
      };
      statusEl.textContent = "Livro encontrado! Confira abaixo e confirme para preencher o formulário.";
      mostrarPreviewIsbn(ultimoLivroEncontrado);
    }else{
      throw new Error("não encontrado no Google Books");
    }
  }catch(err){
    // fallback: Open Library
    try{
      const resp2 = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const dados2 = await resp2.json();
      const chave = "ISBN:" + isbn;
      if(dados2[chave]){
        const info = dados2[chave];
        ultimoLivroEncontrado = {
          capa: (info.cover && (info.cover.large || info.cover.medium || info.cover.small)) || "",
          titulo: info.title || "",
          autor: (info.authors || []).map(a => a.name).join(", "),
          editora: (info.publishers || []).map(p => p.name).join(", "),
          genero: (info.subjects || []).slice(0,3).map(s => s.name).join(", "),
          paginas: info.number_of_pages || "",
          ano: info.publish_date ? info.publish_date.slice(-4) : "",
          sinopse: info.notes || "",
          isbn
        };
        statusEl.textContent = "Livro encontrado! Confira abaixo e confirme para preencher o formulário.";
        mostrarPreviewIsbn(ultimoLivroEncontrado);
      }else{
        throw new Error("não encontrado");
      }
    }catch(err2){
      statusEl.textContent = "Não encontramos esse ISBN. Você pode preencher os dados manualmente logo abaixo.";
    }
  }
}

function mostrarPreviewIsbn(livro){
  const previewEl = document.getElementById("isbn-preview");
  previewEl.classList.remove("hidden");
  previewEl.innerHTML = `
    <img src="${livro.capa || capaPadrao()}" onerror="this.src='${capaPadrao()}'">
    <div class="isbn-preview-info">
      <h4>${escapeHtml(livro.titulo || "Título não encontrado")}</h4>
      <p>${escapeHtml(livro.autor || "Autor desconhecido")} ${livro.editora ? "· " + escapeHtml(livro.editora) : ""}</p>
      <button type="button" class="btn btn-primary" id="btn-usar-isbn">Usar estes dados</button>
    </div>
  `;
  document.getElementById("btn-usar-isbn").addEventListener("click", () => {
    document.getElementById("campo-capa").value = livro.capa || "";
    document.getElementById("preview-capa").src = livro.capa || capaPadrao();
    document.getElementById("campo-titulo").value = livro.titulo || "";
    document.getElementById("campo-autor").value = livro.autor || "";
    document.getElementById("campo-editora").value = livro.editora || "";
    document.getElementById("campo-genero").value = livro.genero || "";
    document.getElementById("campo-paginas").value = livro.paginas || "";
    document.getElementById("campo-ano").value = livro.ano || "";
    document.getElementById("campo-isbn").value = livro.isbn || "";
    document.getElementById("campo-sinopse").value = livro.sinopse || "";
    trocarAba("manual");
    mostrarToast("Dados preenchidos! Confira e complete o que quiser antes de salvar.");
  });
}

/* ========================================================
   DETALHE DO LIVRO
   ======================================================== */
function abrirDetalheLivro(id){
  estado.livroDetalheId = id;
  renderizarDetalheLivro();
  trocarView("livro");
}

function renderizarDetalheLivro(){
  const livro = livros.find(l => l.id === estado.livroDetalheId);
  const container = document.getElementById("book-detail-content");
  if(!livro){
    container.innerHTML = "<p>Livro não encontrado.</p>";
    return;
  }

  const totalPag = Number(livro.paginas) || 0;
  const pct = livro.status === "lido" ? 100 : calcularPorcentagem(livro.paginaAtual, totalPag);
  const estrelas = "★".repeat(Number(livro.avaliacao) || 0) + "☆".repeat(5 - (Number(livro.avaliacao) || 0));

  const rotulosTag = { favorito: "❤️ Favorito", superestimado: "📈 Superestimado", "nunca-mais": "🚫 Nunca mais ler" };
  const tagsHtml = (livro.tags || []).map(t => `<span class="tag-badge">${rotulosTag[t] || t}</span>`).join("");

  const historicoOrdenado = [...(livro.historico || [])].sort((a,b) => new Date(b.data) - new Date(a.data));
  const timelineHtml = historicoOrdenado.length
    ? historicoOrdenado.map(h => `
        <div class="timeline-item">
          <div class="timeline-head">
            <span>📅 ${formatarDataBR(h.data)} · 📖 Página ${h.pagina}${totalPag ? " de " + totalPag : ""} · <span class="timeline-pct">📊 ${h.porcentagem}%</span></span>
            <span class="timeline-emoji">${h.emoji || ""}</span>
          </div>
          ${h.nota ? `<p class="timeline-nota">${escapeHtml(h.nota)}</p>` : ""}
        </div>
      `).join("")
    : `<p class="empty-msg" style="padding:1rem 0">Nenhuma atualização registrada ainda. Adicione a primeira!</p>`;

  container.innerHTML = `
    <div>
      <img class="bd-capa" src="${livro.capa || capaPadrao()}" onerror="this.src='${capaPadrao()}'">
      <div class="bd-acoes">
        <button class="btn btn-primary" id="btn-nova-atualizacao">+ Adicionar atualização</button>
        <button class="btn btn-ghost" id="btn-editar-livro">✏️ Editar livro</button>
        <button class="btn btn-perigo" id="btn-excluir-livro">🗑️ Excluir livro</button>
      </div>
    </div>
    <div>
      <h1 class="bd-titulo">${escapeHtml(livro.titulo)}</h1>
      <p class="bd-autor">${escapeHtml(livro.autor || "")}</p>

      <div class="bd-status-row">
        <span class="status-badge ${STATUS_COR_CLASSE[livro.status]}" style="position:static">${STATUS_LABEL[livro.status]}</span>
        <span class="livro-estrelas" style="font-size:1.1rem">${estrelas}</span>
      </div>

      ${tagsHtml ? `<div class="bd-tags">${tagsHtml}</div>` : ""}

      <div class="bd-meta">
        ${livro.editora ? `<span>🏢 ${escapeHtml(livro.editora)}</span>` : ""}
        ${livro.genero ? `<span>🏷️ ${escapeHtml(livro.genero)}</span>` : ""}
        ${livro.ano ? `<span>📅 ${escapeHtml(String(livro.ano))}</span>` : ""}
        ${totalPag ? `<span>📄 ${totalPag} páginas</span>` : ""}
        ${livro.isbn ? `<span>🔖 ISBN ${escapeHtml(livro.isbn)}</span>` : ""}
      </div>

      ${livro.sinopse ? `<p class="bd-sinopse">${escapeHtml(livro.sinopse)}</p>` : ""}

      <div class="bd-progress-box">
        <div class="bd-progress-head">
          <span>Progresso de leitura</span>
          <span>${livro.paginaAtual || 0}${totalPag ? " / " + totalPag : ""} páginas — ${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="bd-meta" style="margin-top:.6rem">
          <span>▶️ Início: ${formatarDataBR(livro.dataInicio)}</span>
          <span>⏹️ Término: ${formatarDataBR(livro.dataFim)}</span>
        </div>
      </div>

      <div class="bd-section">
        <h3>📝 Resenha</h3>
        ${livro.resenha ? `<div class="resenha-texto">${escapeHtml(livro.resenha)}</div>` : `<p style="color:var(--texto-suave)">Nenhuma resenha escrita ainda. Você pode adicionar uma editando o livro.</p>`}
      </div>

      <div class="bd-section">
        <h3>📖 Histórico de leituras</h3>
        <div class="timeline">${timelineHtml}</div>
      </div>
    </div>
  `;

  document.getElementById("btn-editar-livro").addEventListener("click", () => abrirModalEditarLivro(livro));
  document.getElementById("btn-excluir-livro").addEventListener("click", () => {
    pedirConfirmacao(`Tem certeza que deseja excluir "${livro.titulo}"? Essa ação não pode ser desfeita.`, () => {
      livros = livros.filter(l => l.id !== livro.id);
      salvarLivros();
      renderizarTudo();
      trocarView("inicio");
      mostrarToast("Livro excluído.");
    });
  });
  document.getElementById("btn-nova-atualizacao").addEventListener("click", () => abrirModalAtualizacao(livro));
}

/* ========================================================
   MODAL: NOVA ATUALIZAÇÃO DE LEITURA
   ======================================================== */
function abrirModalAtualizacao(livro){
  estado.atualizacaoLivroId = livro.id;
  estado.emojiSelecionado = null;
  document.getElementById("atualizacao-livro-id").value = livro.id;
  document.getElementById("atualizacao-data").value = hojeISO();
  document.getElementById("atualizacao-pagina").value = livro.paginaAtual || "";
  document.getElementById("atualizacao-nota").value = "";
  document.querySelectorAll(".emoji-opt").forEach(b => b.classList.remove("selecionado"));
  abrirModal("modal-atualizacao");
}

document.querySelectorAll(".emoji-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".emoji-opt").forEach(b => b.classList.remove("selecionado"));
    btn.classList.add("selecionado");
    estado.emojiSelecionado = btn.dataset.emoji;
  });
});

document.getElementById("form-atualizacao").addEventListener("submit", (e) => {
  e.preventDefault();
  const livro = livros.find(l => l.id === estado.atualizacaoLivroId);
  if(!livro) return;

  const pagina = Number(document.getElementById("atualizacao-pagina").value) || 0;
  const totalPag = Number(livro.paginas) || 0;
  const porcentagem = calcularPorcentagem(pagina, totalPag);

  const registro = {
    id: gerarId(),
    data: document.getElementById("atualizacao-data").value || hojeISO(),
    pagina,
    porcentagem,
    emoji: estado.emojiSelecionado || "",
    nota: document.getElementById("atualizacao-nota").value.trim()
  };

  if(!livro.historico) livro.historico = [];
  livro.historico.push(registro);
  livro.paginaAtual = pagina;
  if(totalPag && pagina >= totalPag && livro.status !== "lido"){
    livro.status = "lido";
    if(!livro.dataFim) livro.dataFim = registro.data;
  }

  salvarLivros();
  fecharModal("modal-atualizacao");
  renderizarTudo();
  renderizarDetalheLivro();
  mostrarToast("Atualização salva!");
});

/* ========================================================
   ESTATÍSTICAS
   ======================================================== */
let graficos = {};
function destruirGraficos(){
  Object.values(graficos).forEach(g => g && g.destroy());
  graficos = {};
}

function renderizarEstatisticas(){
  const total = livros.length;
  const lidos = livros.filter(l => l.status === "lido");
  const paginasLidas = livros.reduce((s,l) => s + (l.status === "lido" ? (Number(l.paginas)||0) : (Number(l.paginaAtual)||0)), 0);
  const avaliados = livros.filter(l => Number(l.avaliacao) > 0);
  const media = avaliados.length ? (avaliados.reduce((s,l)=>s+Number(l.avaliacao),0)/avaliados.length) : 0;
  const favoritos = livros.filter(l => l.tags && l.tags.includes("favorito")).length;
  const pctConcluidos = total ? Math.round((lidos.length/total)*100) : 0;

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card"><span class="stat-icon">📚</span><span class="stat-num">${total}</span><span class="stat-label">Total de livros</span></div>
    <div class="stat-card"><span class="stat-icon">✅</span><span class="stat-num">${lidos.length}</span><span class="stat-label">Livros lidos</span></div>
    <div class="stat-card"><span class="stat-icon">📄</span><span class="stat-num">${paginasLidas.toLocaleString("pt-BR")}</span><span class="stat-label">Páginas lidas</span></div>
    <div class="stat-card"><span class="stat-icon">⭐</span><span class="stat-num">${media.toFixed(1)}</span><span class="stat-label">Média de estrelas</span></div>
    <div class="stat-card"><span class="stat-icon">🎯</span><span class="stat-num">${pctConcluidos}%</span><span class="stat-label">Concluídos</span></div>
  `;

  destruirGraficos();
  const corMarrom = getComputedStyle(document.documentElement).getPropertyValue("--marrom").trim();
  const corVerde = getComputedStyle(document.documentElement).getPropertyValue("--verde").trim();
  const corDourado = getComputedStyle(document.documentElement).getPropertyValue("--dourado").trim();
  const corTexto = getComputedStyle(document.documentElement).getPropertyValue("--texto").trim();
  const paletaBase = [corVerde, corDourado, corMarrom, "#8A6A4D", "#B8863C", "#6B5C9E", "#A25444", "#D9AE6B"];

  Chart.defaults.color = corTexto;
  Chart.defaults.font.family = "Karla, sans-serif";

  // Gêneros
  const contagemGeneros = {};
  livros.forEach(l => (l.genero||"Sem gênero").split(",").map(g=>g.trim()).filter(Boolean).forEach(g => {
    contagemGeneros[g] = (contagemGeneros[g]||0) + 1;
  }));
  const generosOrdenados = Object.entries(contagemGeneros).sort((a,b)=>b[1]-a[1]).slice(0,7);
  graficos.generos = new Chart(document.getElementById("chart-generos"), {
    type: "doughnut",
    data: { labels: generosOrdenados.map(g=>g[0]), datasets: [{ data: generosOrdenados.map(g=>g[1]), backgroundColor: paletaBase }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } }, maintainAspectRatio: false }
  });

  // Livros lidos por mês (ano atual da meta)
  const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const contagemMeses = new Array(12).fill(0);
  lidos.forEach(l => {
    if(l.dataFim){
      const [ano, mes] = l.dataFim.split("-");
      if(Number(ano) === Number(meta.ano)) contagemMeses[Number(mes)-1]++;
    }
  });
  graficos.meses = new Chart(document.getElementById("chart-meses"), {
    type: "bar",
    data: { labels: mesesNomes, datasets: [{ label: `Lidos em ${meta.ano}`, data: contagemMeses, backgroundColor: corVerde, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  // Autores mais lidos
  const contagemAutores = {};
  livros.forEach(l => (l.autor||"Desconhecido").split(",").map(a=>a.trim()).filter(Boolean).forEach(a => {
    contagemAutores[a] = (contagemAutores[a]||0) + 1;
  }));
  const autoresOrdenados = Object.entries(contagemAutores).sort((a,b)=>b[1]-a[1]).slice(0,6);
  graficos.autores = new Chart(document.getElementById("chart-autores"), {
    type: "bar",
    data: { labels: autoresOrdenados.map(a=>a[0]), datasets: [{ label: "Livros", data: autoresOrdenados.map(a=>a[1]), backgroundColor: corDourado, borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  // Distribuição de avaliações
  const contagemEstrelas = [0,0,0,0,0];
  avaliados.forEach(l => { const v = Number(l.avaliacao); if(v>=1 && v<=5) contagemEstrelas[v-1]++; });
  graficos.avaliacoes = new Chart(document.getElementById("chart-avaliacoes"), {
    type: "bar",
    data: { labels: ["1★","2★","3★","4★","5★"], datasets: [{ label: "Livros", data: contagemEstrelas, backgroundColor: corMarrom, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

/* ========================================================
   RENDERIZAR TUDO
   ======================================================== */
function renderizarTudo(){
  renderizarDashboard();
  renderizarCarrosseis();
  renderizarBiblioteca();
  if(!document.getElementById("view-estatisticas").classList.contains("hidden")) renderizarEstatisticas();
}

/* ========================================================
   INICIALIZAÇÃO
   ======================================================== */
carregarDados();
renderizarTudo();
