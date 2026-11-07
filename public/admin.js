
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CALEB_CONFIG || {};

const sb = (
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY
)
  ? createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    )
  : null;

const $ = (id) => document.getElementById(id);

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

let user = null;
let isAdmin = false;

// PROTEÇÃO CONTRA HTML INJETADO

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// MENSAGENS

function message(text) {
  alert(text);
}

function loginMessage(text) {
  $("loginMsg").textContent = text;
}

// VERIFICAR ADMINISTRADOR

async function checkAdmin() {
  if (!sb || !user) return false;

  const { data, error } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar administrador:", error);
    return false;
  }

  return !!data;
}

// INICIAR PAINEL

async function init() {
  if (!sb) {
    loginMessage(
      "Configure o Supabase em config.js."
    );
    return;
  }

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session?.user) {
    user = data.session.user;
    await show();
  }
}

// MOSTRAR PAINEL

async function show() {
  isAdmin = await checkAdmin();

  if (!isAdmin) {
    $("login").classList.remove("hidden");
    $("app").classList.add("hidden");

    loginMessage(
      "Esta conta não possui permissão de administrador."
    );
    return;
  }

  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");

  await load();
}

// LOGIN

$("loginForm").onsubmit = async (event) => {
  event.preventDefault();

  if (!sb) {
    loginMessage("Supabase não configurado.");
    return;
  }

  const form = event.currentTarget;
  const button = form.querySelector(
    'button[type="submit"]'
  );

  const fields = new FormData(form);

  button.disabled = true;
  button.textContent = "Entrando...";

  try {
    const { data, error } =
      await sb.auth.signInWithPassword({
        email: fields.get("email"),
        password: fields.get("password")
      });

    if (error) {
      loginMessage("E-mail ou senha inválidos.");
      return;
    }

    user = data.user;

    await show();
  } catch (error) {
    console.error(error);
    loginMessage(
      "Não foi possível conectar ao Supabase."
    );
  } finally {
    button.disabled = false;
    button.textContent = "Entrar no painel";
  }
};

// SAIR

$("logout").onclick = async () => {
  if (sb) {
    await sb.auth.signOut();
  }

  user = null;
  isAdmin = false;

  location.reload();
};

// CADASTRAR PRODUTO

$("productForm").onsubmit = async (event) => {
  event.preventDefault();

  // Guardar o formulário ANTES do await
  const form = event.currentTarget;

  const button = form.querySelector(
    'button[type="submit"]'
  );

  if (!sb || !isAdmin) {
    message("Acesso administrativo necessário.");
    return;
  }

  const fields = new FormData(form);

  const name = String(
    fields.get("name") || ""
  ).trim();

  const price = Number(fields.get("price"));
  const stock = Number(fields.get("stock"));

  const image_url = String(
    fields.get("image_url") || ""
  ).trim();

  const description = String(
    fields.get("description") || ""
  ).trim();

  // VALIDAR DADOS

  if (!name) {
    message("Digite o nome do produto.");
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    message("Digite um preço válido.");
    return;
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    message("Digite um estoque válido.");
    return;
  }

  const product = {
    name,
    price,
    stock,
    image_url: image_url || null,
    description,
    active: true
  };

  button.disabled = true;
  button.textContent = "Salvando produto...";

  try {
    const { error } = await sb
      .from("products")
      .insert(product);

    if (error) {
      console.error(error);
      message(
        "Erro ao cadastrar: " + error.message
      );
      return;
    }

    // CORREÇÃO DO ERRO ORIGINAL
    form.reset();

    await loadProducts();

    message("Produto cadastrado com sucesso!");
  } catch (error) {
    console.error(error);

    message(
      "Erro de conexão ao cadastrar o produto."
    );
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar produto";
  }
};

// CARREGAR DADOS

async function load() {
  await Promise.all([
    loadProducts(),
    loadOrders()
  ]);
}

// CARREGAR PRODUTOS

async function loadProducts() {
  if (!sb || !isAdmin) return;

  const container = $("products");

  container.textContent = "Carregando produtos...";

  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(error);

    container.textContent =
      "Erro ao carregar produtos: " + error.message;

    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML =
      '<p class="muted">Nenhum produto cadastrado.</p>';
    return;
  }

  container.innerHTML = data.map((product) => `
    <div class="admin-row">

      <div>
        <b>${escapeHTML(product.name)}</b>

        <small>
          ${money(product.price)}
          • Estoque: ${Number(product.stock)}
          • ${product.active ? "Ativo" : "Oculto"}
        </small>
      </div>

      <button
        type="button"
        class="btn"
        data-edit="${escapeHTML(product.id)}"
      >
        Editar
      </button>

      <button
        type="button"
        class="btn"
        data-toggle="${escapeHTML(product.id)}"
      >
        ${product.active ? "Ocultar" : "Ativar"}
      </button>

      <button
        type="button"
        class="danger"
        data-del="${escapeHTML(product.id)}"
      >
        Excluir
      </button>

    </div>
  `).join("");

  // EDITAR PRODUTO

  container.querySelectorAll(
    "[data-edit]"
  ).forEach((button) => {

    button.onclick = async () => {
      const product = data.find(
        (item) => String(item.id) === button.dataset.edit
      );

      if (!product) return;

      const name = prompt(
        "Nome do produto:",
        product.name
      );

      if (name === null) return;

      const price = prompt(
        "Preço em reais:",
        product.price
      );

      if (price === null) return;

      const stock = prompt(
        "Quantidade em estoque:",
        product.stock
      );

      if (stock === null) return;

      const image_url = prompt(
        "URL da imagem:",
        product.image_url || ""
      );

      if (image_url === null) return;

      const description = prompt(
        "Descrição:",
        product.description || ""
      );

      if (description === null) return;

      const newPrice = Number(price);
      const newStock = Number(stock);

      if (
        !name.trim() ||
        !Number.isFinite(newPrice) ||
        newPrice <= 0 ||
        !Number.isInteger(newStock) ||
        newStock < 0
      ) {
        message(
          "Confira nome, preço e estoque."
        );
        return;
      }

      const { error } = await sb
        .from("products")
        .update({
          name: name.trim(),
          price: newPrice,
          stock: newStock,
          image_url: image_url.trim() || null,
          description
        })
        .eq("id", product.id);

      if (error) {
        message(
          "Erro ao editar: " + error.message
        );
        return;
      }

      message("Produto atualizado!");

      await loadProducts();
    };
  });

  // ATIVAR OU OCULTAR

  container.querySelectorAll(
    "[data-toggle]"
  ).forEach((button) => {

    button.onclick = async () => {
      const product = data.find(
        (item) => String(item.id) === button.dataset.toggle
      );

      if (!product) return;

      const { error } = await sb
        .from("products")
        .update({
          active: !product.active
        })
        .eq("id", product.id);

      if (error) {
        message(
          "Erro ao alterar produto: " + error.message
        );
        return;
      }

      await loadProducts();
    };
  });

  // EXCLUIR PRODUTO

  container.querySelectorAll(
    "[data-del]"
  ).forEach((button) => {

    button.onclick = async () => {
      const confirmed = confirm(
        "Tem certeza que deseja excluir este produto?"
      );

      if (!confirmed) return;

      const { error } = await sb
        .from("products")
        .delete()
        .eq("id", button.dataset.del);

      if (error) {
        message(
          "Erro ao excluir: " + error.message
        );
        return;
      }

      message("Produto excluído!");

      await loadProducts();
    };
  });
}

// CARREGAR PEDIDOS

async function loadOrders() {
  if (!sb || !isAdmin) return;

  const container = $("orders");

  container.textContent = "Carregando pedidos...";

  const { data, error } = await sb
    .from("orders")
    .select(
      "id,customer_name,total,status,created_at"
    )
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {
    console.error(error);

    container.textContent =
      "Erro ao carregar pedidos: " + error.message;

    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML =
      '<p class="muted">Nenhum pedido ainda.</p>';
    return;
  }

  container.innerHTML = data.map((order) => {

    const status =
      order.status === "paid"
        ? "PAGO"
        : order.status === "pending"
          ? "AGUARDANDO"
          : "CANCELADO";

    const date = new Date(
      order.created_at
    ).toLocaleString("pt-BR");

    return `
      <div class="admin-row">

        <div>
          <b>
            Pedido ${escapeHTML(
              String(order.id).slice(0, 8)
            )}
          </b>

          <small>
            ${escapeHTML(order.customer_name)}
            • ${money(order.total)}
            • ${escapeHTML(date)}
          </small>
        </div>

        <strong>
          ${status}
        </strong>

      </div>
    `;
  }).join("");
}

// INICIAR
init();
