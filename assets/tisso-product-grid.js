/**
 * Tisso Product Grid controller
 * ----------------------------------------------------------------------------
 * Vanilla JS only. Handles:
 *   - Opening/closing the shared product modal (click, Escape, overlay click)
 *   - Rendering variant options and resolving the matching variant
 *   - Adding to cart via Shopify's AJAX Cart API (/cart/add.js)
 *   - The "Black + Medium" bonus-product rule
 *
 * Uses event delegation on each grid section instead of binding a listener
 * per card, since the grid only ever has up to six items but the pattern
 * scales cleanly regardless.
 */
(function () {
  'use strict';

  var OPTION_COLOR_KEYS = ['color', 'colour'];
  var OPTION_SIZE_KEYS = ['size'];

  document.querySelectorAll('[data-tisso-grid]').forEach(initGrid);

  function initGrid(gridEl) {
    var modal = gridEl.querySelector('[data-tisso-modal]');
    if (!modal) return;

    var body = modal.querySelector('[data-tisso-modal-body]');
    var bonusProduct = parseJSONAttr(gridEl, 'data-bonus-product');
    var state = { product: null, selectedOptions: {}, variant: null };

    // --- Open / close -------------------------------------------------------

    gridEl.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-tisso-open-modal]');
      if (!trigger) return;

      var productId = trigger.getAttribute('data-product-id');
      var json = gridEl.querySelector(
        '[data-tisso-product-json="' + cssEscape(productId) + '"]'
      );
      if (!json) return;

      var product = JSON.parse(json.textContent);
      openModal(product);
    });

    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-tisso-close-modal]')) closeModal();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
    });

    var lastFocusedEl = null;

    function openModal(product) {
      lastFocusedEl = document.activeElement;
      state.product = product;
      state.selectedOptions = {};
      product.options.forEach(function (name, index) {
        var firstAvailable = product.variants.find(function (v) {
          return v.available;
        });
        state.selectedOptions[name] =
          (firstAvailable && firstAvailable.options[index]) ||
          product.variants[0].options[index];
      });

      render();
      modal.removeAttribute('hidden');
      document.body.classList.add('tisso-modal-open');
      var closeBtn = modal.querySelector('.tisso-modal__close');
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      modal.setAttribute('hidden', '');
      document.body.classList.remove('tisso-modal-open');
      if (lastFocusedEl) lastFocusedEl.focus();
    }

    // --- Rendering -----------------------------------------------------------

    function render() {
      var product = state.product;
      var variant = findMatchingVariant(product, state.selectedOptions);
      state.variant = variant;

      body.innerHTML = buildProductMarkup(product, variant, state.selectedOptions);
      updateOptionAvailability(product, state.selectedOptions);
    }

    // Event delegation for option selection + add to cart inside the modal
    body.addEventListener('click', function (event) {
      var optionBtn = event.target.closest('[data-tisso-option-value]');
      if (optionBtn && !optionBtn.disabled) {
        var name = optionBtn.getAttribute('data-option-name');
        var value = optionBtn.getAttribute('data-option-value');
        state.selectedOptions[name] = value;
        render();
        return;
      }

      var addBtn = event.target.closest('[data-tisso-add-to-cart]');
      if (addBtn) {
        handleAddToCart(addBtn);
      }
    });

    function handleAddToCart(button) {
      var variant = state.variant;
      var statusEl = body.querySelector('[data-tisso-status]');
      if (!variant || !variant.available) return;

      setButtonLoading(button, true);
      setStatus(statusEl, '', null);

      var items = [{ id: variant.id, quantity: 1 }];
      var qualifiesForBonus = variantQualifiesForBonus(variant);

      var addPromise = qualifiesForBonus
        ? maybeAppendBonusItem(items)
        : Promise.resolve(items);

      addPromise
        .then(function (finalItems) {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: finalItems }),
          });
        })
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (err) {
              throw new Error(err.description || 'Could not add item to cart.');
            });
          }
          return response.json();
        })
        .then(function () {
          setButtonLoading(button, false);
          setStatus(
            statusEl,
            qualifiesForBonus
              ? 'Added to cart — your bonus Soft Winter Jacket was included!'
              : 'Added to cart.',
            'success'
          );
          refreshCartState();
        })
        .catch(function (error) {
          setButtonLoading(button, false);
          setStatus(statusEl, error.message || 'Something went wrong. Please try again.', 'error');
        });
    }

    // --- Bonus product logic --------------------------------------------------

    function variantQualifiesForBonus(variant) {
      var product = state.product;
      var color = getOptionValue(product, variant, OPTION_COLOR_KEYS);
      var size = getOptionValue(product, variant, OPTION_SIZE_KEYS);
      return (
        color && size && color.trim().toLowerCase() === 'black' && size.trim().toLowerCase() === 'medium'
      );
    }

    function maybeAppendBonusItem(items) {
      if (!bonusProduct || !bonusProduct.variants || !bonusProduct.variants.length) {
        return Promise.resolve(items);
      }

      var bonusVariant =
        bonusProduct.variants.find(function (v) {
          return v.available;
        }) || bonusProduct.variants[0];

      if (!bonusVariant || !bonusVariant.available) {
        // Bonus product exists but has no sellable variant right now.
        return Promise.resolve(items);
      }

      return fetch('/cart.js')
        .then(function (res) {
          return res.json();
        })
        .then(function (cart) {
          var alreadyInCart = cart.items.some(function (item) {
            return item.variant_id === bonusVariant.id;
          });
          if (!alreadyInCart) {
            items.push({ id: bonusVariant.id, quantity: 1 });
          }
          return items;
        })
        .catch(function () {
          // If the cart lookup fails, fall back to adding without the bonus
          // rather than risking a duplicate or a broken request.
          return items;
        });
    }

    function refreshCartState() {
      // Let the rest of the theme (cart drawer/count bubble) know the cart
      // changed, without assuming a specific theme's cart implementation.
      fetch('/cart.js')
        .then(function (res) {
          return res.json();
        })
        .then(function (cart) {
          document.dispatchEvent(new CustomEvent('cart:update', { detail: cart }));
          document.querySelectorAll('[data-cart-count]').forEach(function (el) {
            el.textContent = cart.item_count;
          });
        })
        .catch(function () {
          /* non-fatal */
        });
    }
  }

  // --- Markup builders --------------------------------------------------------

  function buildProductMarkup(product, variant, selectedOptions) {
    var image = (variant && variant.featured_image && variant.featured_image.src) || product.featured_image;
    var price = variant ? formatMoney(variant.price) : formatMoney(product.price);
    var compareAt =
      variant && variant.compare_at_price > variant.price ? formatMoney(variant.compare_at_price) : null;

    var optionsMarkup = product.options
      .map(function (name, index) {
        var values = uniqueValuesForOption(product, index);
        return (
          '<div class="tisso-modal__option">' +
          '<span class="tisso-modal__option-label">' + escapeHtml(name) + '</span>' +
          '<div class="tisso-modal__option-values">' +
          values
            .map(function (value) {
              var pressed = selectedOptions[name] === value;
              return (
                '<button type="button" class="tisso-modal__option-value" data-tisso-option-value ' +
                'data-option-name="' + escapeHtml(name) + '" data-option-value="' + escapeHtml(value) + '" ' +
                'aria-pressed="' + pressed + '">' + escapeHtml(value) + '</button>'
              );
            })
            .join('') +
          '</div></div>'
        );
      })
      .join('');

    var addLabel = !variant ? 'Unavailable' : variant.available ? 'Add to cart' : 'Sold out';

    return (
      '<div class="tisso-modal__product">' +
      '<div class="tisso-modal__image">' +
      (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.title) + '" loading="lazy">' : '') +
      '</div>' +
      '<div class="tisso-modal__details">' +
      '<h2 class="tisso-modal__title" id="tisso-modal-title">' + escapeHtml(product.title) + '</h2>' +
      '<p class="tisso-modal__price">' +
      (compareAt ? '<span class="tisso-modal__price--compare">' + compareAt + '</span>' : '') +
      price +
      '</p>' +
      '<div class="tisso-modal__description">' + (product.description || '') + '</div>' +
      optionsMarkup +
      '<button type="button" class="tisso-modal__add-to-cart" data-tisso-add-to-cart ' +
      (!variant || !variant.available ? 'disabled' : '') + '>' + addLabel + '</button>' +
      '<p class="tisso-modal__status" data-tisso-status role="status" aria-live="polite"></p>' +
      '</div></div>'
    );
  }

  function updateOptionAvailability(product, selectedOptions) {
    document.querySelectorAll('[data-tisso-option-value]').forEach(function (btn) {
      var name = btn.getAttribute('data-option-name');
      var value = btn.getAttribute('data-option-value');
      var testOptions = Object.assign({}, selectedOptions);
      testOptions[name] = value;
      var match = findMatchingVariant(product, testOptions);
      btn.disabled = !match || !match.available;
    });
  }

  // --- Variant helpers ---------------------------------------------------------

  function findMatchingVariant(product, selectedOptions) {
    return product.variants.find(function (variant) {
      return product.options.every(function (name, index) {
        return variant.options[index] === selectedOptions[name];
      });
    });
  }

  function uniqueValuesForOption(product, index) {
    var seen = [];
    product.variants.forEach(function (variant) {
      var value = variant.options[index];
      if (seen.indexOf(value) === -1) seen.push(value);
    });
    return seen;
  }

  function getOptionValue(product, variant, keyAliases) {
    var optionIndex = product.options.findIndex(function (name) {
      return keyAliases.indexOf(name.trim().toLowerCase()) !== -1;
    });
    return optionIndex === -1 ? null : variant.options[optionIndex];
  }

  // --- Small utilities -----------------------------------------------------------

  function setButtonLoading(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Adding…' : 'Add to cart';
  }

  function setStatus(el, message, state) {
    if (!el) return;
    el.textContent = message;
    if (state) {
      el.setAttribute('data-state', state);
    } else {
      el.removeAttribute('data-state');
    }
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function parseJSONAttr(el, attr) {
    var raw = el.getAttribute(attr);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value;
  }
})();
