(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const get = (id) => document.getElementById(id);
  const catalog = get("catalogo");
  const panels = all("dialog");
  const categories = all(".category[data-category]");
  const route = new URLSearchParams(location.search);
  const categorySlug = route.get("categoria");
  const pageCategory = categories.find((link) => link.dataset.category && link.dataset.category === categorySlug);
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
  const productId = route.get("produto");
  const pageProduct = products.get(productId);
  const hasCategory = Boolean(pageCategory) || categorySlug === "todas";
  const categoryPage = !pageProduct && hasCategory;
  const standalonePage = categoryPage || Boolean(pageProduct);
  const categoryFilter = categoryPage ? pageCategory?.dataset.category || "" : "";
  const openFavorites = !standalonePage && location.hash === "#favoritos";
  const initialQuery = pageProduct ? "" : (route.get("busca") || "").slice(0, 80).trim();
  const catalogReturn = hasCategory ? `?${new URLSearchParams({ categoria: categorySlug })}` : "index.html#catalogo";

  function loadShoppingState() {
    const saved = readState();
    const favorites = Array.isArray(saved.favorites) ? saved.favorites.filter((id) => products.has(id)) : [];
    const cartItems = Object.entries(saved.cart || {}).filter(([key, quantity]) => {
      const [id, size = "", extra] = key.split(":");
      return products.has(id) && extra === undefined && (size === "" || sizes.has(size))
        && Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
    });
    return { favoriteIds: new Set(favorites), cart: new Map(cartItems) };
  }

  let { favoriteIds, cart } = loadShoppingState();
  let filters = { category: categoryFilter, query: initialQuery, favorites: openFavorites };
  let showAll = false;
  let toastTimeout;

  if (standalonePage) {
    document.body.classList.add("standalone-page");
    const pageSection = pageProduct ? get("produto") : catalog;
    for (const section of all("main > section")) section.hidden = section !== pageSection;
    for (const link of all('a[href="#inicio"], a[href="#categorias"], a[href="#lojas"], a[href="#como-comprar"], a[data-reset]')) {
      link.setAttribute("href", `index.html${link.hash}`);
    }
    for (const link of all("[data-favorites]")) link.setAttribute("href", "index.html#favoritos");
  }
  if (categoryPage) {
    document.body.classList.add("category-page");
    document.title = `${pageCategory?.textContent || "A coleção"} | SAMKARA`;
    get("category-back").hidden = false;
    get("catalog-title").setAttribute("aria-level", "1");
    get("no-products").querySelector("button span").textContent = "Limpar busca";
  }

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
    const limitResults = isFullCatalog && !showAll && !categoryPage;
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
      if (link === category && (categoryPage || (!filters.query && !filters.favorites))) {
        link.setAttribute("aria-current", categoryPage ? "page" : "true");
      }
      else link.removeAttribute("aria-current");
    }

    get("catalog-title").textContent = filters.favorites
      ? "Favoritos"
      : pageCategory?.textContent || (filters.query ? "Resultados da busca" : "A coleção");
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

  const photoViewer = get("photo-viewer");
  const productImage = get("product-image");
  const fullProductImage = get("full-product-image");
  const photoSteps = all(".photo-step", photoViewer);
  let productPhotos = [];
  let selectedPhotoIndex = 0;
  let swipeStart = null;

  function stepProductPhoto(direction) {
    const length = productPhotos.length;
    if (length > 1) selectProductPhoto((selectedPhotoIndex + direction + length) % length);
  }

  get("product-photo").addEventListener("click", () => {
    for (const button of photoSteps) button.hidden = productPhotos.length < 2;
    photoViewer.showModal();
    selectProductPhoto(selectedPhotoIndex);
  });
  get("photo-previous").addEventListener("click", () => stepProductPhoto(-1));
  get("photo-next").addEventListener("click", () => stepProductPhoto(1));
  photoViewer.addEventListener("click", (event) => {
    if (event.target === photoViewer || event.target === fullProductImage) photoViewer.close();
  });
  photoViewer.addEventListener("keydown", (event) => {
    if (productPhotos.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    stepProductPhoto(event.key === "ArrowLeft" ? -1 : 1);
  });
  photoViewer.addEventListener("touchstart", (event) => {
    swipeStart = productPhotos.length > 1 && event.touches.length === 1 && !event.target.closest("button")
      ? event.touches[0] : null;
  }, { passive: true });
  photoViewer.addEventListener("touchmove", (event) => {
    if (!swipeStart || !event.cancelable) return;
    const { clientX, clientY } = event.touches[0];
    if (Math.abs(clientX - swipeStart.clientX) > Math.abs(clientY - swipeStart.clientY)) event.preventDefault();
  }, { passive: false });
  photoViewer.addEventListener("touchcancel", () => { swipeStart = null; });
  photoViewer.addEventListener("touchend", (event) => {
    if (!swipeStart) return;
    const { clientX, clientY } = event.changedTouches[0];
    const dx = clientX - swipeStart.clientX;
    const dy = clientY - swipeStart.clientY;
    swipeStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    if (event.cancelable) event.preventDefault();
    stepProductPhoto(dx < 0 ? 1 : -1);
  }, { passive: false });

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
    if (standalonePage && control.matches("a")) return;
    filters = { category: categoryFilter, query: "", favorites: false };
    showAll = false;
    get("search-field").value = "";
    renderCatalog();
    if (control.closest("#menu")) get("menu").close();
    event.preventDefault();
    showCatalog();
  }));

  get("show-more").addEventListener("click", () => {
    showAll = true;
    renderCatalog();
    all(".product:not([hidden]) h3 a")[previewLimit]?.focus();
  });

  get("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = get("search-field").value.trim();
    if (pageProduct) {
      const destination = new URL(catalogReturn, location.href);
      if (query) destination.searchParams.set("busca", query);
      location.assign(destination.href);
      return;
    }
    filters = { category: categoryFilter, query, favorites: false };
    renderCatalog();
    get("search").close();
    showCatalog();
  });

  all("[data-favorites]").forEach((link) => link.addEventListener("click", (event) => {
    if (standalonePage) return;
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

    if (categoryPage) {
      const productHref = `?${new URLSearchParams({ produto: id, categoria: categorySlug })}`;
      for (const link of all("[data-product]", product.card)) link.setAttribute("href", productHref);
    }
  }

  function element(tagName, attributes, content = "") {
    const node = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    node.textContent = content;
    return node;
  }

  function renderProductPhotos(product) {
    const gallery = get("product-gallery");
    productPhotos = [product.photo, ...product.gallery].map((source, index) => ({
      source,
      description: index === 0 ? product.description : `${product.name}, ângulo ${index + 1}`,
    }));

    gallery.replaceChildren();
    gallery.hidden = productPhotos.length < 2;
    if (!gallery.hidden) {
      for (const [index, { source }] of productPhotos.entries()) {
        const button = element("button", {
          type: "button",
          "aria-label": `Ver foto ${index + 1} de ${productPhotos.length}`,
        });
        button.append(element("img", { src: source.replace(".webp", "-320.webp"), alt: "" }));
        button.addEventListener("click", () => selectProductPhoto(index));
        gallery.append(button);
      }
    }
    selectProductPhoto(0);
  }

  function selectProductPhoto(index) {
    const { source, description } = productPhotos[index];
    selectedPhotoIndex = index;
    productImage.src = source;
    productImage.alt = description;
    for (const [thumbnailIndex, thumbnail] of all("#product-gallery button").entries()) {
      thumbnail.setAttribute("aria-pressed", String(thumbnailIndex === index));
    }
    if (photoViewer.open) {
      fullProductImage.src = source;
      fullProductImage.alt = description;
      get("photo-status").textContent = `Foto ${index + 1} de ${productPhotos.length}`;
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
    if (!pageProduct || !sizes.has(sizeSelect.value)) return;
    updateQuantity(`${productId}:${sizeSelect.value}`, 1);
    openPanel("cart");
  });

  get("keep-shopping").addEventListener("click", () => {
    get("cart").close();
    if (pageProduct) location.assign(catalogReturn);
    else showCatalog();
  });
  get("order-store").addEventListener("change", updateOrderLink);

  function updateNavigation() {
    const hash = standalonePage ? "#catalogo" : location.hash || "#inicio";
    all(".mobile-nav a").forEach((link) => {
      const favoritesLink = "favorites" in link.dataset;
      const active = hash === "#catalogo"
        ? link.hash === hash && filters.favorites === favoritesLink
        : link.hash === hash;
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  const siteHeader = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  const heroCopy = hero.querySelector(".hero-copy");
  function updateHeader() {
    const headerBounds = siteHeader.getBoundingClientRect();
    const heroBounds = hero.getBoundingClientRect();
    const copyBounds = heroCopy.getBoundingClientRect();
    const pastHero = heroBounds.bottom <= headerBounds.bottom;
    const headerCenter = headerBounds.top + headerBounds.height / 2;
    const darkHeroDepth = Math.min(heroBounds.height / 2, 286);

    siteHeader.classList.toggle("is-past-hero", pastHero);
    siteHeader.classList.toggle("is-over-dark-hero", !pastHero && heroBounds.bottom - headerCenter <= darkHeroDepth);
    const overlap = Math.min(copyBounds.height, Math.max(0, headerBounds.bottom - copyBounds.top));
    heroCopy.style.setProperty("--hero-header-overlap", `${overlap}px`);
  }

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", updateHeader);
  window.addEventListener("hashchange", updateNavigation);
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    ({ favoriteIds, cart } = loadShoppingState());
    renderCatalog();
    renderCart();
  });
  if (openFavorites) history.replaceState(history.state, "", "#catalogo");
  if (!pageProduct && route.has("busca")) {
    const url = new URL(location.href);
    url.searchParams.delete("busca");
    history.replaceState(history.state, "", url);
    get("search-field").value = initialQuery;
  }
  if (pageProduct) {
    document.title = `${pageProduct.name} | SAMKARA`;
    get("product-back").setAttribute("href", catalogReturn);
    if (pageCategory) get("product-back").querySelector("span").textContent = `Voltar para ${pageCategory.textContent}`;
    get("product-title").textContent = pageProduct.name;
    get("product-description").textContent = pageProduct.description;
    get("detail-price").textContent = pageProduct.price === null ? "Consulte o valor com a loja" : formatPrice(pageProduct.price);
    renderProductPhotos(pageProduct);
  }
  updateHeader();
  renderCatalog();
  renderCart();
  if (openFavorites || (initialQuery && !categoryPage)) showCatalog();
})();
