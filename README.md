# SAMKARA

Vitrine de moda feminina em HTML, CSS e JavaScript. Extraia o ZIP e abra `index.html` no navegador. Para hospedar o site, envie `index.html` e a pasta `assets/` para a mesma pasta da hospedagem. As fontes e imagens são locais. WhatsApp, mapas, Instagram e catálogo externo precisam de internet.

## Atualizar a vitrine

- As peças ficam em `index.html`, na seção `catalogo`. Cada cartão usa `data-id` para identificar a peça, `data-categories` para os filtros e `data-gallery` para as fotos adicionais. Mantenha o `data-id` de uma peça existente para preservar favoritos e carrinhos.
- A vitrine orienta a consultar valores e tamanhos com a loja. Para exibir um preço confirmado, substitua o `<span class="product-price">` do cartão por um `<data class="product-price">`. Informe o preço em centavos no atributo `value` e o texto formatado no conteúdo. O carrinho exibe o subtotal quando todas as peças selecionadas têm preço.
- Contatos e endereços vieram do site original. Ao alterar um WhatsApp, atualize o cartão da loja, a janela de atendimento e a opção correspondente no seletor `order-store`.
- Favoritos e carrinho ficam salvos no navegador. A cliente escolhe uma unidade e o site abre o WhatsApp com as peças, os tamanhos e as quantidades preenchidos. Ela envia a mensagem no WhatsApp e a equipe confirma o pedido.
