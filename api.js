/* ===========================================
   api.js
   Responsável por buscar dados de livros em APIs
   públicas gratuitas a partir do ISBN.
   Tenta primeiro o Google Books, e se não achar,
   tenta a Open Library.
   =========================================== */

// Busca os dados de um livro pelo ISBN.
// Retorna uma Promise que resolve com um objeto padronizado,
// ou null se o livro não for encontrado em nenhuma das duas APIs.
async function buscarLivroPorISBN(isbn) {
  // Remove espaços e traços do ISBN, para evitar erros de busca
  const isbnLimpo = isbn.replace(/[-\s]/g, "");

  // 1ª tentativa: Google Books API
  const resultadoGoogle = await buscarNoGoogleBooks(isbnLimpo);
  if (resultadoGoogle) return resultadoGoogle;

  // 2ª tentativa: Open Library
  const resultadoOpenLibrary = await buscarNaOpenLibrary(isbnLimpo);
  if (resultadoOpenLibrary) return resultadoOpenLibrary;

  // Não encontrado em nenhuma das duas
  return null;
}

// ---------- GOOGLE BOOKS ----------
async function buscarNoGoogleBooks(isbn) {
  try {
    const resposta = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const dados = await resposta.json();

    if (!dados.items || dados.items.length === 0) return null;

    const info = dados.items[0].volumeInfo;

    return {
      titulo: info.title || "",
      autor: info.authors ? info.authors.join(", ") : "",
      editora: info.publisher || "",
      sinopse: info.description || "",
      paginas: info.pageCount || "",
      ano: info.publishedDate ? info.publishedDate.substring(0, 4) : "",
      genero: info.categories ? info.categories.join(", ") : "",
      capa: info.imageLinks ? info.imageLinks.thumbnail.replace("http://", "https://") : "",
      isbn: isbn
    };
  } catch (erro) {
    console.error("Erro ao buscar no Google Books:", erro);
    return null;
  }
}

// ---------- OPEN LIBRARY ----------
async function buscarNaOpenLibrary(isbn) {
  try {
    const resposta = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const dados = await resposta.json();

    const chave = `ISBN:${isbn}`;
    if (!dados[chave]) return null;

    const info = dados[chave];

    return {
      titulo: info.title || "",
      autor: info.authors ? info.authors.map(a => a.name).join(", ") : "",
      editora: info.publishers ? info.publishers.map(p => p.name).join(", ") : "",
      sinopse: info.notes || info.excerpts?.[0]?.text || "",
      paginas: info.number_of_pages || "",
      ano: info.publish_date ? info.publish_date.slice(-4) : "",
      genero: info.subjects ? info.subjects.slice(0, 3).map(s => s.name).join(", ") : "",
      capa: info.cover ? info.cover.medium : "",
      isbn: isbn
    };
  } catch (erro) {
    console.error("Erro ao buscar na Open Library:", erro);
    return null;
  }
}
