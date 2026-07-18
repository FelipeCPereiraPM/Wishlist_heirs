// Seletores de elementos
const loadingScreen = document.getElementById("loading-screen");
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const wishlistSelect = document.getElementById("wishlist-select");
const addItemForm = document.getElementById("add-item-form");
const statusMsg = document.getElementById("status-msg");

const itemNameInput = document.getElementById("item-name");
const itemLinkInput = document.getElementById("item-link");
const itemCategoryInput = document.getElementById("item-category");
const itemSizeColorInput = document.getElementById("item-size-color");
const itemNotesInput = document.getElementById("item-notes");

let session = null; // { accessToken, user }

// Chave do localStorage do Supabase baseada no project ID do seu .env
const SUPABASE_LOCAL_STORAGE_KEY = "sb-uyzrkibtcpkdflhmommm-auth-token";

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  await initSession();
});

// Inicializa a sessão buscando no storage local da extensão ou tentando ler de abas da aplicação
async function initSession() {
  showScreen("loading");

  try {
    // 1. Tentar ler do storage local da própria extensão
    const storage = await chrome.storage.local.get(["session"]);
    if (storage.session && storage.session.accessToken) {
      session = storage.session;
      await loadApp();
      return;
    }

    // 2. Tentar capturar a sessão a partir de abas abertas da aplicação (localhost ou vercel)
    const sessionFound = await tryDetectSessionFromTabs();
    if (sessionFound) {
      await loadApp();
      return;
    }

    // 3. Fallback para tela de login se nada for encontrado
    showScreen("login");
  } catch (error) {
    console.error("Erro na inicialização da sessão:", error);
    showScreen("login");
  }
}

// Tenta detectar sessão a partir de abas abertas da aplicação
async function tryDetectSessionFromTabs() {
  return new Promise((resolve) => {
    // Busca por abas que possam ser a nossa aplicação web
    chrome.tabs.query({}, async (tabs) => {
      const appTabs = tabs.filter(tab => 
        tab.url && (tab.url.includes("localhost") || tab.url.includes("vercel.app") || tab.url.includes("wishlist"))
      );

      for (const tab of appTabs) {
        try {
          // Executa um script na aba para obter o valor do localStorage do Supabase
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (key) => localStorage.getItem(key),
            args: [SUPABASE_LOCAL_STORAGE_KEY]
          });

          if (results && results[0] && results[0].result) {
            const parsed = JSON.parse(results[0].result);
            if (parsed && parsed.access_token && parsed.user) {
              session = {
                accessToken: parsed.access_token,
                user: parsed.user
              };
              // Salva no storage da extensão para futuros acessos
              await chrome.storage.local.set({ session });
              resolve(true);
              return;
            }
          }
        } catch (e) {
          // Ignora abas que falham por falta de permissão ou segurança
          console.warn("Falha ao ler localStorage da aba:", tab.url, e);
        }
      }
      resolve(false);
    });
  });
}

// Carrega as informações e exibe a tela principal
async function loadApp() {
  try {
    logoutBtn.classList.remove("hidden");
    showScreen("main");
    await fillActiveTabDetails();
    await loadWishlists();
  } catch (error) {
    console.error("Erro ao carregar app:", error);
    showScreen("login");
  }
}

// Preenche os campos do produto baseado na aba ativa do navegador
async function fillActiveTabDetails() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs && tabs[0]) {
      const activeTab = tabs[0];
      itemLinkInput.value = activeTab.url || "";
      itemNameInput.value = activeTab.title ? activeTab.title.split("-")[0].trim() : "";

      // Executa content script leve para tentar pegar metadados Open Graph de produto
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
            const price = document.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") ||
                          document.querySelector('[class*="price"], [id*="price"]')?.innerText;
            return { ogTitle, price };
          }
        });

        if (results && results[0] && results[0].result) {
          const { ogTitle, price } = results[0].result;
          if (ogTitle) itemNameInput.value = ogTitle.trim();
          if (price) {
            const sanitizedPrice = price.replace(/\s+/g, ' ').trim();
            itemNotesInput.value = `Preço estimado detectado: ${sanitizedPrice}`;
          }
        }
      } catch (err) {
        console.warn("Não foi possível ler metadados detalhados:", err);
      }
    }
  });
}

// Carrega as Wishlists do usuário logado
async function loadWishlists() {
  try {
    wishlistSelect.innerHTML = '<option value="" disabled selected>Carregando listas...</option>';
    const lists = await SupabaseAPI.getWishLists(session.accessToken);
    
    if (lists.length === 0) {
      wishlistSelect.innerHTML = '<option value="" disabled>Nenhuma lista encontrada</option>';
      return;
    }

    wishlistSelect.innerHTML = "";
    lists.forEach(list => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name;
      wishlistSelect.appendChild(option);
    });
  } catch (err) {
    showStatus("Erro ao carregar listas. Tente logar novamente.", "error");
  }
}

// Manipulador do formulário de login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.textContent = "Entrando...";

  try {
    const data = await SupabaseAPI.signIn(email, password);
    session = data;
    await chrome.storage.local.set({ session });
    await loadApp();
  } catch (error) {
    loginError.textContent = error.message || "Erro ao fazer login.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

// Manipulador do formulário de adição de item
addItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();

  const listId = wishlistSelect.value;
  const name = itemNameInput.value.trim();
  const link = itemLinkInput.value.trim();
  const category = itemCategoryInput.value;
  const sizeColor = itemSizeColorInput.value.trim();
  const notes = itemNotesInput.value.trim();

  if (!listId) {
    showStatus("Selecione uma lista de desejos.", "error");
    return;
  }

  const btn = document.getElementById("btn-add");
  btn.disabled = true;
  btn.textContent = "Adicionando...";

  try {
    await SupabaseAPI.addWishItem(session.accessToken, {
      userId: session.user.id,
      listId,
      name,
      link,
      category,
      sizeColor,
      notes
    });

    showStatus("✨ Item adicionado com sucesso!", "success");
    
    // Limpar formulário mantendo apenas a lista selecionada
    itemNameInput.value = "";
    itemLinkInput.value = "";
    itemSizeColorInput.value = "";
    itemNotesInput.value = "";
    
    // Recarregar os detalhes da aba para caso o usuário queira adicionar novamente
    await fillActiveTabDetails();
  } catch (error) {
    showStatus(error.message || "Erro ao adicionar item.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Adicionar à Lista";
  }
});

// Botão de Logout
logoutBtn.addEventListener("click", async () => {
  session = null;
  await chrome.storage.local.remove(["session"]);
  logoutBtn.classList.add("hidden");
  showScreen("login");
});

// Utilitários de UI
function showScreen(screenName) {
  loadingScreen.classList.add("hidden");
  loginScreen.classList.add("hidden");
  mainScreen.classList.add("hidden");

  if (screenName === "loading") loadingScreen.classList.remove("hidden");
  if (screenName === "login") loginScreen.classList.remove("hidden");
  if (screenName === "main") mainScreen.classList.remove("hidden");
}

function showStatus(message, type) {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg ${type}`;
}

function clearStatus() {
  statusMsg.textContent = "";
  statusMsg.className = "status-msg";
}
