
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================
// CALEB INJEÇÃO ELETRÔNICA
// LOJA ONLINE - STORE.JS
// =====================================

// CONFIGURAÇÕES

const config = window.CALEB_CONFIG || {};

const $ = (id) => document.getElementById(id);

const LOGO =
  "45e78704-eff8-431c-944a-457536da2b92.png";

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// CONEXÃO COM SUPABASE

let supabase = null;

try {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new Error(
      "Configuração do Supabase não encontrada."
    );
  }

  supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
} catch (error) {
  console.error("Erro de configuração:", error);
}

// DADOS DA LOJA

let products = [];
let cart = [];

try {
  const saved = JSON.parse(
    localStorage.getItem("caleb_cart") || "[]"
  );

  if (Array.isArray(saved)) {
    cart = saved.filter((item) =>
      item &&
      typeof item.id !== "undefined" &&
      Number.isInteger(Number(item.qty)) &&
      Number(item.qty) > 0
    );
  }
} catch {
  cart = [];
}

// ELEMENTOS DO SITE

const grid = $("productGrid");
const search = $("search");

const cartDrawer = $("cartDrawer");
const cartOverlay =
  $("cartOverlay") || $("overlay");

const cartOpen =
  $("openCart") || $("cartOpen");

const cartClose =
  $("closeCart") || $("cartClose");

const cartItems = $("cartItems");
const cartCount = $("cartCount");
const cartTotal = $("cartTotal");

const checkoutForm = $("checkoutForm");
const paymentMessage = $("paymentMessage");

// =====================================
// CARREGAR PRODUTOS
// =====================================

async function loadProducts() {
  if (!grid) {
    console.error("Elemento productGrid não encontrado.");
    return;
  }

  grid.innerHTML =
    '<p>Carregando produtos...</p>';

  if (!supabase) {
    grid.innerHTML = `
      <p style="color:#b91c1c">
        Não foi possível conectar ao banco de dados.
        Verifique o arquivo config.js.
      </p>
    `;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,description,price,stock,image_url,active"
      )
      .eq("active", true)
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    products = data || [];

    // Remover itens inexistentes ou esgotados
    cart = cart.filter((item) => {
      const product = products.find(
        (p) => String(p.id) === String(item.id)
      );

      if (!product || Number(product.stock) < 1) {
        return false;
      }

      item.qty = Math.min(
        Number(item.qty),
        Number(product.stock)
      );

      return item.qty > 0;
    });

    renderProducts();
    persist();

  } catch (error) {
    console.error("Erro ao carregar produtos:", error);

    grid.innerHTML = `
      <p style="color:#b91c1c">
        Não foi possível carregar os produtos.
        Tente atualizar a página.
      </p>
    `;
  }
}

// =====================================
// MOSTRAR PRODUTOS
// =====================================

function renderProducts() {
  if (!grid) return;

  const query = String(search?.value || "")
    .toLowerCase()
    .trim();

  const filtered = products.filter((product) => {
    const text = (
      String(product.name || "") + " " +
      String(product.description || "")
    ).toLowerCase();

    return text.includes(query);
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <p style="color:#64748b">
        Nenhum produto encontrado.
      </p>
    `;
    return;
  }

  grid.innerHTML = filtered.map((product) => {
    const stock = Math.max(
      0,
      Number(product.stock) || 0
    );

    const imageUrl =
      String(product.image_url || "").trim();

    const image = imageUrl || LOGO;

    return `
      <article class="product-card">

        <img
          src="${esc(image)}"
          alt="${esc(product.name)}"
          loading="lazy"
        >

        <div class="content">

          <h3>${esc(product.name)}</h3>

          <p style="
            color:#64748b;
            line-height:1.5;
            min-height:45px;
          ">
            ${esc(
              product.description ||
              "Produto disponível na Caleb."
            )}
          </p>

          <p class="price">
            ${money(product.price)}
          </p>

          <p style="
            color:${stock > 0 ? "#16803c" : "#b91c1c"};
            font-size:14px;
          ">
            ${
              stock > 0
                ? `${stock} disponível(is)`
                : "Produto esgotado"
            }
          </p>

          <button
            class="btn"
            type="button"
            data-add="${esc(product.id)}"
            ${stock < 1 ? "disabled" : ""}
            style="width:100%;margin-top:10px"
          >
            ${
              stock > 0
                ? "Adicionar ao carrinho"
                : "Esgotado"
            }
          </button>

        </div>

      </article>
    `;
  }).join("");

  // Foto alternativa se a imagem não carregar
  grid.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      if (!img.src.endsWith(LOGO)) {
        img.src = LOGO;
      }
    });
  });

  // Botões adicionar ao carrinho
  grid.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.add);
    });
  });
}

// =====================================
// CARRINHO
// =====================================

function persist() {
  localStorage.setItem(
    "caleb_cart",
    JSON.stringify(cart)
  );

  renderCart();
}

function addToCart(id) {
  const product = products.find(
    (p) => String(p.id) === String(id)
  );

  if (!product || Number(product.stock) < 1) {
    alert("Produto indisponível.");
    return;
  }

  const item = cart.find(
    (p) => String(p.id) === String(id)
  );

  if (item) {
    if (item.qty >= Number(product.stock)) {
      alert("Quantidade máxima em estoque.");
      return;
    }

    item.qty++;
  } else {
    cart.push({
      id: product.id,
      qty: 1
    });
  }

  persist();
  openCart();
}

function changeQty(id, amount) {
  const item = cart.find(
    (p) => String(p.id) === String(id)
  );

  const product = products.find(
    (p) => String(p.id) === String(id)
  );

  if (!item || !product) return;

  item.qty += amount;

  if (item.qty <= 0) {
    cart = cart.filter(
      (p) => String(p.id) !== String(id)
    );
  } else {
    item.qty = Math.min(
      item.qty,
      Number(product.stock)
    );
  }

  persist();
}

function renderCart() {
  if (!cartItems || !cartCount || !cartTotal) {
    return;
  }

  cartCount.textContent = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  if (!cart.length) {
    cartItems.innerHTML = `
      <p style="color:#64748b">
        Seu carrinho está vazio.
      </p>
    `;
  } else {
    cartItems.innerHTML = cart.map((item) => {
      const product = products.find(
        (p) => String(p.id) === String(item.id)
      );

      if (!product) return "";

      return `
        <div style="
          padding:15px 0;
          border-bottom:1px solid #dce8f7;
        ">

          <b>${esc(product.name)}</b>

          <p style="color:#64748b">
            ${money(product.price)} cada
          </p>

          <div style="
            display:flex;
            align-items:center;
            gap:15px;
          ">

            <button
              type="button"
              data-minus="${esc(product.id)}"
              class="close"
            >−</button>

            <strong>${Number(item.qty)}</strong>

            <button
              type="button"
              data-plus="${esc(product.id)}"
              class="close"
            >+</button>

          </div>

        </div>
      `;
    }).join("");
  }

  const total = cart.reduce((sum, item) => {
    const product = products.find(
      (p) => String(p.id) === String(item.id)
    );

    return sum +
      (Number(product?.price) || 0) * item.qty;
  }, 0);

  cartTotal.textContent = money(total);

  cartItems.querySelectorAll("[data-minus]")
    .forEach((button) => {
      button.onclick = () =>
        changeQty(button.dataset.minus, -1);
    });

  cartItems.querySelectorAll("[data-plus]")
    .forEach((button) => {
      button.onclick = () =>
        changeQty(button.dataset.plus, 1);
    });
}

// =====================================
// ABRIR E FECHAR CARRINHO
// =====================================

function openCart() {
  if (cartDrawer) {
    cartDrawer.classList.remove("hidden");
    cartDrawer.classList.add("open");
  }

  if (cartOverlay) {
    cartOverlay.classList.remove("hidden");
    cartOverlay.classList.add("show");
  }
}

function closeCart() {
  if (cartDrawer) {
    cartDrawer.classList.add("hidden");
    cartDrawer.classList.remove("open");
  }

  if (cartOverlay) {
    cartOverlay.classList.add("hidden");
    cartOverlay.classList.remove("show");
  }
}

if (cartOpen) {
  cartOpen.onclick = openCart;
}

if (cartClose) {
  cartClose.onclick = closeCart;
}

if (cartOverlay) {
  cartOverlay.onclick = closeCart;
}

if (search) {
  search.oninput = renderProducts;
}

// =====================================
// FORMAS DE PAGAMENTO
// =====================================

const paymentNames = {
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  pix: "Pix"
};

const paymentInput = $("paymentMethod");

document.querySelectorAll("[data-method]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-method]")
        .forEach((option) => {
          option.classList.remove("selected");
        });

      button.classList.add("selected");

      const method = button.dataset.method;

      if (paymentInput) {
        paymentInput.value = method;
      }

      if (paymentMessage) {
        paymentMessage.classList.remove("hidden");
        paymentMessage.textContent =
          paymentNames[method] +
          " selecionado. Pagamento em configuração.";
      }
    });
  });

// =====================================
// FINALIZAR COMPRA
// =====================================

// Pagamentos reais ainda não estão ativos.
// Não enviar dados de cartão ou gerar cobrança.

if (checkoutForm) {
  checkoutForm.onsubmit = (event) => {
    event.preventDefault();

    if (!cart.length) {
      alert("Adicione produtos ao carrinho.");
      return;
    }

    const method = paymentInput?.value;

    if (!method || !paymentNames[method]) {
      alert("Escolha uma forma de pagamento.");
      return;
    }

    const message =
      "Pagamento por " +
      paymentNames[method] +
      " ainda está sendo configurado. " +
      "Nenhuma cobrança foi realizada.";

    if (paymentMessage) {
      paymentMessage.textContent = message;
      paymentMessage.classList.remove("hidden");
    } else {
      alert(message);
    }
  };
}

// =====================================
// MODAL PIX
// =====================================

const pixModal = $("pixModal");
const pixClose = $("pixClose");

if (pixClose) {
  pixClose.onclick = () => {
    if (pixModal) {
      pixModal.classList.add("hidden");
      pixModal.classList.remove("show");
    }
  };
}

// =====================================
// INICIAR LOJA
// =====================================

renderCart();
loadProducts();

console.log("Caleb Injeção Eletrônica iniciada.");
