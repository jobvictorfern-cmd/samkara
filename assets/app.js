(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const get = (id) => document.getElementById(id);
  const catalog = get("catalogo");
  const panels = all("dialog");
  const categories = all(".category[data-category]");
  const storageKey = "samkara-vitrine-v1";
  const previewLimit = 8;
  const sizeSelect = get("product-size");
  const sizes = new Set([...sizeSelect.options].map((option) => option.value).filter(Boolean));
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const formatPrice = (cents) => currency.format(cents / 100);

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }

  const products = new Map(all(".product").map((card) => {
    const photo = card.querySelector("img");
    const price = card.querySelector("data.product-price")?.value;
    return [card.dataset.id, {
      name: card.querySelector("h3").textContent.trim(),
      photo: photo.getAttribute("src"),
      gallery: (card.dataset.gallery || "").split(" ").filter(Boolean),
      description: photo.alt,
      searchLabel: card.dataset.search,
      price: /^\d+$/.test(price ?? "") && Number.isSafeInteger(Number(price)) ? Number(price) : null,
      categories: card.dataset.categories.split(" "),
      card,
      favorite: card.querySelector(".favorite"),
    }];
  }));

  const saved = readState();
  const favoriteIds = new Set(Array.isArray(saved.favorites) ? saved.favorites.filter((id) => products.has(id)) : []);
  const cart = new Map(Object.entries(saved.cart || {}).filter(([key, quantity]) => {
    const [id, size = "", extra] = key.split(":");
    return products.has(id) && extra === undefined && (size === "" || sizes.has(size))
      && Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
  }));
  let filters = { category: "", query: "", favorites: false };
  let showAll = false;
  let selectedProduct = "";
  let toastTimeout;

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        favorites: [...favoriteIds],
        cart: Object.fromEntries(cart),
      }));
    } catch {
      // The active catalog and cart remain usable when storage is unavailable.
    }
  }

  function notify(message) {
    const toast = get("toast");
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function normalize(value) {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
  }

  function renderCatalog() {
    const words = normalize(filters.query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const category = categories.find((link) => link.dataset.category === filters.category);
    const isFullCatalog = !filters.category && !filters.query && !filters.favorites;
    const limitResults = isFullCatalog && !showAll;
    let count = 0;

    for (const [id, product] of products) {
      const terms = normalize([product.name, product.description, product.searchLabel, ...product.categories].join(" "));
      const matches = (!filters.category || product.categories.includes(filters.category))
        && words.every((word) => terms.includes(word))
        && (!filters.favorites || favoriteIds.has(id));
      if (matches) count += 1;
      product.card.hidden = !matches || (limitResults && count > previewLimit);
      product.favorite.setAttribute("aria-pressed", String(favoriteIds.has(id)));
    }

    for (const link of categories) {
      if (link === category && !filters.query && !filters.favorites) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }

    get("catalog-title").textContent = filters.favorites
      ? "Favoritos"
      : filters.query ? "Resultados da busca" : category?.dataset.category ? category.textContent : "A coleção";
    const resultCount = `${count} ${count === 1 ? "peça" : "peças"}`;
    const hasMore = limitResults && count > previewLimit;
    get("catalog-more").hidden = !hasMore;
    if (hasMore) get("show-more").querySelector("span").textContent = `Ver todas as ${count} peças`;
    get("catalog-note").textContent = filters.query ? `${resultCount} para “${filters.query}”`
      : hasMore ? `${previewLimit} de ${resultCount}` : resultCount;
    get("no-products").hidden = count > 0;
    get("no-products-text").textContent = filters.favorites ? "Você ainda não tem peças favoritas." : "Nenhuma peça encontrada.";
    updateNavigation();
  }

  function showCatalog() {
    if (location.hash !== "#catalogo") location.hash = "catalogo";
    else catalog.scrollIntoView();
    get("catalog-title").focus({ preventScroll: true });
  }

  function openPanel(id) {
    for (const panel of panels) {
      if (panel.open) panel.close();
    }
    const panel = get(id);
    if (panel) panel.showModal();
  }

  for (const panel of panels) {
    panel.querySelector(".close-panel").addEventListener("click", () => panel.close());
    panel.addEventListener("click", (event) => {
      if (event.target !== panel) return;
      const bounds = panel.getBoundingClientRect();
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      if (!inside) panel.close();
    });
  }

  all("[data-open]").forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", button.dataset.open);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openPanel(button.dataset.open);
    });
  });

  all(".panel-links a").forEach((link) => link.addEventListener("click", () => get("menu").close()));

  all("[data-reset]").forEach((control) => control.addEventListener("click", (event) => {
    filters = { category: "", query: "", favorites: false };
    showAll = false;
    get("search-field").value = "";
    renderCatalog();
    if (control.closest("#menu")) get("menu").close();
    event.preventDefault();
    showCatalog();
  }));

  all("[data-category]").forEach((link) => link.addEventListener("click", (event) => {
    filters = { category: link.dataset.category, query: "", favorites: false };
    showAll = false;
    get("search-field").value = "";
    renderCatalog();
    if (link.classList.contains("category-card")) {
      event.preventDefault();
      showCatalog();
    }
  }));

  get("show-more").addEventListener("click", () => {
    showAll = true;
    renderCatalog();
    all(".product:not([hidden]) h3 a")[previewLimit]?.focus();
  });

  get("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    filters = { category: "", query: get("search-field").value.trim(), favorites: false };
    renderCatalog();
    get("search").close();
    showCatalog();
  });

  all("[data-favorites]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    filters = { category: "", query: "", favorites: true };
    get("search-field").value = "";
    renderCatalog();
    showCatalog();
  }));

  for (const [id, product] of products) {
    product.favorite.addEventListener("click", () => {
      const removing = favoriteIds.delete(id);
      if (!removing) favoriteIds.add(id);
      saveState();
      renderCatalog();
      if (removing && filters.favorites) {
        (catalog.querySelector(".product:not([hidden]) .favorite") || get("catalog-title")).focus({ preventScroll: true });
      }
      notify(removing ? "Peça removida dos favoritos." : "Peça salva nos favoritos.");
    });

    all("[data-product]", product.card).forEach((control) => {
      control.setAttribute("aria-haspopup", "dialog");
      control.addEventListener("click", (event) => {
        event.preventDefault();
        selectedProduct = id;
        get("product-title").textContent = product.name;
        get("product-description").textContent = product.description;
        get("detail-price").textContent = product.price === null ? "Consulte o valor com a loja" : formatPrice(product.price);
        get("product-order").reset();
        get("size-guide").open = false;
        renderProductPhotos(product);
        openPanel("product-dialog");
        get("product-dialog").scrollTop = 0;
      });
    });
  }

  function element(tagName, attributes, content = "") {
    const node = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    node.textContent = content;
    return node;
  }

  function renderProductPhotos(product) {
    const photo = get("product-image");
    const gallery = get("product-gallery");
    const photos = [product.photo, ...product.gallery];

    gallery.replaceChildren();
    gallery.hidden = photos.length < 2;
    const fullPhoto = get("product-original");
    photo.src = product.photo;
    photo.alt = product.description;
    photo.hidden = false;
    fullPhoto.href = product.photo;

    if (gallery.hidden) return;

    for (const [index, source] of photos.entries()) {
      const button = element("button", {
        type: "button",
        "aria-label": `Ver foto ${index + 1} de ${photos.length}`,
        "aria-pressed": String(index === 0),
      });
      button.append(element("img", { src: source.replace(".webp", "-320.webp"), alt: "" }));
      button.addEventListener("click", () => {
        photo.src = source;
        fullPhoto.href = source;
        photo.alt = index === 0 ? product.description : `${product.name}, ângulo ${index + 1}`;
        for (const thumbnail of gallery.children) {
          thumbnail.setAttribute("aria-pressed", String(thumbnail === button));
        }
      });
      gallery.append(button);
    }
  }

  function cartItems() {
    return [...cart].map(([key, quantity]) => {
      const [id, size = ""] = key.split(":");
      return { key, id, size, quantity, product: products.get(id) };
    });
  }

  function updateOrderLink() {
    const items = cartItems();
    const needsSize = items.some((item) => !item.size);
    get("pending-sizes").hidden = !needsSize;
    get("order-destination").hidden = needsSize;

    const orderLink = get("order-button");
    const destination = get("order-store").value;
    if (!items.length || needsSize || !destination) {
      orderLink.removeAttribute("href");
      orderLink.setAttribute("aria-disabled", "true");
      return;
    }

    const byProduct = new Map();
    for (const { product, size, quantity } of items) {
      if (!byProduct.has(product)) byProduct.set(product, []);
      byProduct.get(product).push(`${quantity} × tam. ${size}`);
    }
    const lines = [...byProduct].map(([product, variants]) =>
      `• ${product.name} — ${variants.join(", ")} (${product.description})`
    );
    const message = [
      "Olá, SAMKARA! Montei este pedido no site:",
      "",
      ...lines,
      "",
      "Podem confirmar a disponibilidade, os valores e as opções de entrega?",
    ].join("\n");
    const orderUrl = new URL(destination);
    orderUrl.searchParams.set("text", message);
    orderLink.href = orderUrl.href;
    orderLink.removeAttribute("aria-disabled");
  }

  function renderCart() {
    const items = cartItems();
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
    all(".cart-count").forEach((badge) => {
      badge.textContent = total;
      badge.hidden = !total;
    });
    all('[data-open="cart"]').forEach((button) => button.setAttribute("aria-label", total ? `Abrir carrinho, ${total} ${total === 1 ? "peça" : "peças"}` : "Abrir carrinho"));
    get("cart-content").hidden = !total;
    get("empty-cart").hidden = Boolean(total);
    get("keep-shopping").hidden = Boolean(total);
    get("subtotal-row").hidden = !total || items.some(({ product }) => product.price === null);
    get("cart-subtotal").textContent = formatPrice(subtotal);
    const list = get("cart-list");
    list.replaceChildren();

    for (const { key, size, quantity, product } of items) {
      const item = element("li", {});
      const photo = element("img", { src: product.photo.replace(".webp", "-320.webp"), alt: "" });
      const info = element("div", { class: "cart-item-info" });
      info.append(element("strong", {}, product.name));
      if (product.price !== null) info.append(element("span", {}, `${formatPrice(product.price)} / un.`));
      if (size) {
        info.append(element("span", {}, `Tamanho ${size}`));
      } else {
        const pendingSize = sizeSelect.cloneNode(true);
        pendingSize.removeAttribute("id");
        pendingSize.setAttribute("aria-label", `Escolher tamanho de ${product.name}`);
        pendingSize.dataset.key = key;
        pendingSize.value = "";
        info.append(pendingSize);
      }

      const controls = element("div", { class: "quantity" });
      const itemLabel = size ? `${product.name}, tamanho ${size}` : product.name;
      const decrease = element("button", { type: "button", "data-key": key, "data-change": "-1", "aria-label": `${quantity === 1 ? "Remover" : "Diminuir quantidade de"} ${itemLabel}` }, "−");
      const increase = element("button", { type: "button", "data-key": key, "data-change": "1", "aria-label": `Aumentar quantidade de ${itemLabel}` }, "+");
      increase.disabled = quantity >= 99;
      controls.append(decrease, element("span", {}, quantity), increase);
      item.append(photo, info, controls);
      list.append(item);
    }
    updateOrderLink();
  }

  function updateQuantity(key, adjustment) {
    const quantity = Math.min(99, (cart.get(key) || 0) + adjustment);
    if (quantity > 0) cart.set(key, quantity);
    else cart.delete(key);
    saveState();
    renderCart();
  }

  get("cart-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-change]");
    if (!button) return;
    const { key, change } = button.dataset;
    updateQuantity(key, Number(change));
    const next = all("button[data-change]", get("cart-list")).find((control) => control.dataset.key === key && control.dataset.change === change && !control.disabled)
      || get("cart-list").querySelector("button:not(:disabled)")
      || get("keep-shopping");
    next.focus();
  });

  get("cart-list").addEventListener("change", (event) => {
    const select = event.target.closest("select[data-key]");
    if (!select || !sizes.has(select.value)) return;

    const { key } = select.dataset;
    const nextKey = `${key}:${select.value}`;
    const quantity = (cart.get(nextKey) || 0) + cart.get(key);
    if (quantity > 99) {
      select.value = "";
      select.setCustomValidity("O limite é de 99 unidades da mesma peça e tamanho.");
      select.reportValidity();
      select.setCustomValidity("");
      return;
    }

    cart.delete(key);
    cart.set(nextKey, quantity);
    saveState();
    renderCart();
    const next = get("cart-list").querySelector("select[data-key]") || get("order-store");
    next.focus();
  });

  get("product-order").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedProduct || !sizes.has(sizeSelect.value)) return;
    updateQuantity(`${selectedProduct}:${sizeSelect.value}`, 1);
    openPanel("cart");
  });

  get("keep-shopping").addEventListener("click", () => {
    get("cart").close();
    showCatalog();
  });
  get("order-store").addEventListener("change", updateOrderLink);

  function updateNavigation() {
    const hash = location.hash || "#inicio";
    all(".mobile-nav a").forEach((link) => {
      const favoritesLink = "favorites" in link.dataset;
      const active = hash === "#catalogo"
        ? link.hash === hash && filters.favorites === favoritesLink
        : link.hash === hash;
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  window.addEventListener("hashchange", updateNavigation);
  renderCatalog();
  renderCart();
})();
