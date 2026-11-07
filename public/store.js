
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.CALEB_CONFIG || {};

const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);

const LOGO = "/45e78704-eff8-431c-944a-457536da2b92.png";

const money = n => Number(n || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

let products = [];
let cart = [];

try {
  const saved = JSON.parse(localStorage.getItem("caleb-cart") || "[]");
  cart = Array.isArray(saved) ? saved : [];
} catch {
  cart = [];
}

let currentOrder = null;
let paymentPoll = null;

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

// ESTILO DOS PRODUTOS

const style = document.createElement("style");

style.textContent = `
  #productGrid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 24px;
    align-items: stretch;
  }

  #productGrid .product {
    display: flex !important;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    background: #ffffff !important;
    border: 1px solid #dce8f5 !important;
    border-radius: 18px !important;
    box-shadow: 0 8px 24px rgba(16, 54, 95, .07);
    transition: transform .2s, box-shadow .2s;
  }

  #productGrid .product:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 30px rgba(16, 54, 95, .12);
  }

  #productGrid .product-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 210px;
    padding: 18px;
    background: #f5f9ff;
    border-bottom: 1px solid #e5edf7;
  }

  #productGrid .product-image img {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    object-fit: contain !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  #productGrid .product-image img.fallback-logo {
    width: 75% !important;
    height: 75% !important;
  }

  #productGrid .product-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
  }

  #productGrid .product-body h3 {
    margin: 0;
    color: #10365f !important;
    font-size: 19px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  #productGrid .product-description {
    margin: 0;
    color: #64748b !important;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  #productGrid .price {
    margin-top: auto;
    padding-top: 12px;
    color: #1675d1 !important;
    font-size: 25px;
    font-weight: 800;
  }

  #productGrid .stock {
    margin: 0;
    color: #16804a !important;
    font-size: 13px;
    font-weight: 600;
  }

  #productGrid .stock.empty {
    color: #dc3545 !important;
  }

  #productGrid .product button {
    display: block;
    width: 100%;
    margin-top: 5px;
    padding: 14px;
    border: none !important;
    border-radius: 10px;
    background: #1675d1 !important;
    color: #ffffff !important;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  #productGrid .product button:hover:not(:disabled) {
    background: #095eae !important;
  }

  #productGrid .product button:disabled {
    background: #a9bacd !important;
    cursor: not-allowed;
  }

  .cart-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #e5edf7;
  }

  .cart-line small {
    display: block;
    margin-top: 5px;
    color: #64748b;
  }

  .qty {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .qty button {
    width: 32px;
    height: 32px;
    border: 1px solid #dce8f5;
    border-radius: 8px;
    background: #edf6ff;
    color: #10365f;
    font-weight: bold;
    cursor: pointer;
  }

  @media (max-width: 600px) {
    #productGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    #productGrid .product-image {
      height: 150px;
      padding: 10px;
    }

    #productGrid .product-body {
      padding: 13px;
    }

    #productGrid .product-body h3 {
      font-size: 16px;
    }

    #productGrid .price {
      font-size: 20px;
    }

    #productGrid .product button {
      padding: 12px 7px;
      font-size: 12px;
    }
  }
`;

document.head.appendChild(style);

// SALVAR CARRINHO

function persist() {
  localStorage.setItem("caleb-cart", JSON.stringify(cart));
  renderCart();
}

// CARREGAR PRODUTOS

async function loadProducts() {
  if (!supabase) {
    $("productGrid").textContent =
      "A loja está em configuração. Verifique o Supabase.";
    return;
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    $("productGrid").textContent =
      "Não foi possível carregar os produtos.";
    return;
  }

  products = data || [];

  // Remover do carrinho produtos que não existem mais
  cart = cart.filter(item =>
    products.some(p => String(p.id) === String(item.id))
  );

  renderProducts();
  persist();
}

// EXIBIR PRODUTOS

function renderProducts() {
  const query = ($("search")?.value || "")
    .toLowerCase()
    .trim();

  const list = products.filter(p =>
    (
      String(p.name || "") + " " +
      String(p.description || "")
    ).toLowerCase().includes(query)
  );

  if (!list.length) {
    $("productGrid").innerHTML =
      '<p class="muted">Nenhum produto encontrado.</p>';
    return;
  }

  $("productGrid").innerHTML = list.map(p => {
    const hasImage = !!String(p.image_url || "").trim();

    const image = hasImage
      ? String(p.image_url).trim()
      : LOGO;

    const stock = Math.max(0, Number(p.stock) || 0);

    return `
      <article class="product">

        <div class="product-image">
          <img
            src="${esc(image)}"
            alt="${esc(p.name)}"
            loading="lazy"
            ${!hasImage ? 'class="fallback-logo"' : ""}
          >
        </div>

        <div class="product-body">

          <h3>${esc(p.name)}</h3>

          <p class="product-description">
            ${esc(p.description || "Peça disponível na Caleb Injeção Eletrônica.")}
          </p>

          <div class="price">
            ${money(p.price)}
          </div>

          <p class="stock ${stock < 1 ? "empty" : ""}">
            ${stock > 0
              ? `${stock} disponível(is)`
              : "Produto esgotado"}
          </p>

          <button
            type="button"
            data-add="${esc(p.id)}"
            ${stock < 1 ? "disabled" : ""}
          >
            ${stock > 0 ? "Adicionar ao carrinho" : "Esgotado"}
          </button>

        </div>

      </article>
    `;
  }).join("");

  // Corrigir imagens que não carregam
  document.querySelectorAll(
    "#productGrid .product-image img"
  ).forEach(img => {
    img.addEventListener("error", () => {
      if (img.getAttribute("src") !== LOGO) {
        img.src = LOGO;
        img.classList.add("fallback-logo");
      }
    });
  });

  document.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => add(button.dataset.add);
  });
}

// ADICIONAR AO CARRINHO

function add(id) {
  const product = products.find(p =>
    String(p.id) === String(id)
  );

  if (!product || Number(product.stock) < 1) return;

  const line = cart.find(item =>
    String(item.id) === String(id)
  );

  if (line) {
    if (line.qty >= Number(product.stock)) {
      alert("Quantidade máxima disponível em estoque.");
      return;
    }

    line.qty++;
  } else {
    cart.push({
      id: product.id,
      qty: 1
    });
  }

  persist();
  openCart();
}

// EXIBIR CARRINHO

function renderCart() {
  $("cartCount").textContent = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  $("cartItems").innerHTML = cart.length
    ? cart.map(item => {
        const product = products.find(p =>
          String(p.id) === String(item.id)
        );

        if (!product) return "";

        return `
          <div class="cart-line">

            <div>
              <b>${esc(product.name)}</b>
              <small>${money(product.price)} cada</small>
            </div>

            <div class="qty">
              <button
                type="button"
                data-minus="${esc(product.id)}"
              >−</button>

              <span>${Number(item.qty)}</span>

              <button
                type="button"
                data-plus="${esc(product.id)}"
              >+</button>
            </div>

          </div>
        `;
      }).join("")
    : '<p class="muted">Seu carrinho está vazio.</p>';

  const total = cart.reduce((sum, item) => {
    const product = products.find(p =>
      String(p.id) === String(item.id)
    );

    return sum + (Number(product?.price) || 0) * item.qty;
  }, 0);

  $("cartTotal").textContent = money(total);

  document.querySelectorAll("[data-minus]").forEach(button => {
    button.onclick = () => changeQty(button.dataset.minus, -1);
  });

  document.querySelectorAll("[data-plus]").forEach(button => {
    button.onclick = () => changeQty(button.dataset.plus, 1);
  });
}

// ALTERAR QUANTIDADE

function changeQty(id, difference) {
  const line = cart.find(item =>
    String(item.id) === String(id)
  );

  const product = products.find(p =>
    String(p.id) === String(id)
  );

  if (!line || !product) return;

  line.qty += difference;

  if (line.qty < 1) {
    cart = cart.filter(item =>
      String(item.id) !== String(id)
    );
  } else {
    line.qty = Math.min(
      line.qty,
      Number(product.stock)
    );
  }

  persist();
}

// ABRIR E FECHAR CARRINHO

function openCart() {
  $("cartDrawer").classList.add("open");
  $("overlay").classList.add("show");
}

function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("overlay").classList.remove("show");
}

$("cartOpen").onclick = openCart;
$("cartClose").onclick = closeCart;
$("overlay").onclick = closeCart;

$("search").oninput = renderProducts;

// FINALIZAR COMPRA COM PIX

$("checkoutForm").onsubmit = async event => {
  event.preventDefault();

  if (!cart.length) {
    alert("Adicione produtos ao carrinho.");
    return;
  }

  if (!supabase) {
    alert("A loja não está conectada ao banco de dados.");
    return;
  }

  const fields = new FormData(event.currentTarget);

  const customer = {
    name: fields.get("name"),
    email: fields.get("email"),
    phone: fields.get("phone"),
    address: fields.get("address")
  };

  $("pixModal").classList.add("show");
  $("paymentStatus").textContent = "Aguardando pagamento...";

  $("pixContent").innerHTML =
    "<p>Gerando sua cobrança Pix...</p>";

  closeCart();

  try {
    const response = await fetch("/api/create-pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer,
        items: cart
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Não foi possível gerar o Pix."
      );
    }

    currentOrder = data.orderId;

    $("pixContent").innerHTML = `
      <img
        class="qr"
        alt="QR Code Pix"
        src="data:image/png;base64,${data.qrCode.encodedImage}"
      >

      <div class="copy" id="pixPayload">
        ${esc(data.qrCode.payload)}
      </div>

      <button
        class="btn full"
        id="copyPix"
        type="button"
      >
        Copiar código Pix
      </button>

      <small>
        Após pagar, esta tela será atualizada automaticamente.
      </small>
    `;

    $("copyPix").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          data.qrCode.payload
        );

        alert("Código Pix copiado!");
      } catch {
        alert("Não foi possível copiar o código.");
      }
    };

    watchOrder(data.orderId, data.statusToken);

  } catch (error) {
    $("pixContent").innerHTML =
      `<p>${esc(error.message)}</p>`;

    $("paymentStatus").textContent =
      "Não foi possível iniciar o pagamento.";
  }
};

// VERIFICAR PAGAMENTO

function watchOrder(id, token) {
  if (paymentPoll) {
    clearInterval(paymentPoll);
  }

  paymentPoll = setInterval(async () => {
    try {
      const response = await fetch(
        "/api/order-status?orderId=" +
        encodeURIComponent(id) +
        "&token=" +
        encodeURIComponent(token)
      );

      const data = await response.json();

      if (response.ok && data.status === "paid") {
        $("paymentStatus").textContent =
          "Pagamento confirmado! Pedido pago.";

        clearInterval(paymentPoll);
        paymentPoll = null;

        cart = [];
        persist();
        loadProducts();
      }

      if (response.ok && data.status === "cancelled") {
        $("paymentStatus").textContent =
          "Esta cobrança foi cancelada ou expirou.";

        clearInterval(paymentPoll);
        paymentPoll = null;
      }
    } catch (error) {
      console.error("Erro ao consultar pagamento:", error);
    }
  }, 5000);
}

$("pixClose").onclick = () => {
  $("pixModal").classList.remove("show");
};

// INICIAR LOJA

loadProducts();
renderCart();
