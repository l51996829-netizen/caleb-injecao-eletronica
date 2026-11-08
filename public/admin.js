
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CALEB_CONFIG || {};

const sb = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);

const money = (value) =>
  Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

let user = null;
let isAdmin = false;

const bucket = "product-images";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function checkAdmin() {
  const { data, error } = await sb.rpc("is_caleb_admin");

  if (error) throw error;

  return data === true;
}

async function showPanel() {
  isAdmin = await checkAdmin();

  if (!isAdmin) {
    await sb.auth.signOut();
    user = null;
    $("loginMsg").textContent =
      "Esta conta não tem permissão de administrador.";
    return;
  }

  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");

  await loadProducts();
  await loadOrders();
}

async function init() {
  try {
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    if (data.session) {
      user = data.session.user;
      await showPanel();
    }
  } catch (error) {
    console.error(error);
    $("loginMsg").textContent =
      "Erro ao conectar ao Supabase: " + error.message;
  }
}

$("loginForm").onsubmit = async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const fields = new FormData(form);

  $("loginMsg").textContent = "Entrando...";

  const { data, error } = await sb.auth.signInWithPassword({
    email: fields.get("email"),
    password: fields.get("password")
  });

  if (error) {
    $("loginMsg").textContent = "E-mail ou senha inválidos.";
    return;
  }

  user = data.user;

  try {
    await showPanel();
  } catch (error) {
    $("loginMsg").textContent = error.message;
  }
};

$("logout").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

async function uploadPhoto(file) {
  if (!file || file.size === 0) return null;

  const types = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  if (!types[file.type]) {
    throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A foto deve ter no máximo 5 MB.");
  }

  const path =
    `${user.id}/${crypto.randomUUID()}.${types[file.type]}`;

  const { error } = await sb.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = sb.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path
  };
}

async function removeUploadedPhoto(path) {
  if (!path) return;

  const { error } = await sb.storage
    .from(bucket)
    .remove([path]);

  if (error) console.error("Erro ao remover foto:", error);
}

$("productForm").onsubmit = async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const fields = new FormData(form);

  const name = String(fields.get("name") || "").trim();
  const price = Number(fields.get("price"));
  const stock = Number(fields.get("stock"));
  const description =
    String(fields.get("description") || "").trim();

  const photo = fields.get("product_photo");

  if (
    !name ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    alert("Confira o nome, preço e estoque.");
    return;
  }

  let uploaded = null;
  let productSaved = false;

  button.disabled = true;

  try {
    if (!isAdmin || !user) {
      throw new Error("Faça login como administrador.");
    }

    if (photo instanceof File && photo.size > 0) {
      button.textContent = "Enviando foto...";
      uploaded = await uploadPhoto(photo);
    }

    button.textContent = "Salvando produto...";

    const { error } = await sb.from("products").insert({
      name,
      price,
      stock,
      description,
      image_url: uploaded?.url || null,
      active: true
    });

    if (error) throw error;

    productSaved = true;

    form.reset();

    await loadProducts();

    alert("Produto cadastrado com sucesso!");
  } catch (error) {
    console.error(error);

    if (uploaded && !productSaved) {
      await removeUploadedPhoto(uploaded.path);
    }

    alert("Erro: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar produto";
  }
};

async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("products").textContent = error.message;
    return;
  }

  $("products").innerHTML = (data || []).map((p) => `
    <div class="admin-row">
      <div>
        <b>${escapeHTML(p.name)}</b>
        <small>
          ${money(p.price)}
          • Estoque: ${p.stock}
          • ${p.active ? "Ativo" : "Oculto"}
        </small>
      </div>

      <button
        class="btn"
        data-edit="${p.id}"
        type="button"
      >Editar</button>

      <button
        class="btn"
        data-toggle="${p.id}"
        type="button"
      >${p.active ? "Ocultar" : "Ativar"}</button>

      <button
        class="danger"
        data-delete="${p.id}"
        type="button"
      >Excluir</button>
    </div>
  `).join("") ||
    '<p class="muted">Nenhum produto cadastrado.</p>';

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = async () => {
      const p = data.find((item) => item.id === button.dataset.edit);
      if (!p) return;

      const name = prompt("Nome do produto:", p.name);
      if (name === null) return;

      const price = prompt("Preço:", p.price);
      if (price === null) return;

      const stock = prompt("Estoque:", p.stock);
      if (stock === null) return;

      const description = prompt(
        "Descrição:",
        p.description || ""
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
        alert("Dados inválidos.");
        return;
      }

      const { error } = await sb.from("products")
        .update({
          name: name.trim(),
          price: newPrice,
          stock: newStock,
          description
        })
        .eq("id", p.id);

      if (error) {
        alert("Erro: " + error.message);
        return;
      }

      await loadProducts();
    };
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.onclick = async () => {
      const p = data.find((item) => item.id === button.dataset.toggle);
      if (!p) return;

      const { error } = await sb.from("products")
        .update({ active: !p.active })
        .eq("id", p.id);

      if (error) {
        alert("Erro: " + error.message);
        return;
      }

      await loadProducts();
    };
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("Deseja excluir este produto?")) return;

      const { error } = await sb.from("products")
        .delete()
        .eq("id", button.dataset.delete);

      if (error) {
        alert("Erro: " + error.message);
        return;
      }

      await loadProducts();
    };
  });
}

async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select("id,customer_name,total,status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    $("orders").textContent = error.message;
    return;
  }

  $("orders").innerHTML = (data || []).map((order) => `
    <div class="admin-row">
      <div>
        <b>Pedido ${escapeHTML(order.id.slice(0, 8))}</b>
        <small>
          ${escapeHTML(order.customer_name)}
          • ${money(order.total)}
          • ${new Date(order.created_at).toLocaleString("pt-BR")}
        </small>
      </div>
      <b>
        ${
          order.status === "paid"
            ? "PAGO"
            : order.status === "pending"
              ? "AGUARDANDO"
              : "CANCELADO"
        }
      </b>
    </div>
  `).join("") ||
    '<p class="muted">Nenhum pedido ainda.</p>';
}

init();
