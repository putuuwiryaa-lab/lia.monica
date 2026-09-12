(() => {
  const selectedOrder = [];

  function keyOfMarket(m) {
    return String(m?.id ?? m?.name ?? '');
  }

  function resolveMarketFromInput(input) {
    if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return null;

    const rawValue = String(input?.value ?? '');
    if (rawValue && rawValue !== 'on') {
      const byId = marketData.find(m => String(m.id) === rawValue);
      if (byId) return byId;
    }

    const label = input?.closest?.('.market-chip');
    const name = label?.querySelector?.('.market-name')?.textContent?.trim()?.toUpperCase();
    if (!name) return null;

    return marketData.find(m => String(m.name || m.id).trim().toUpperCase() === name) || null;
  }

  function removeKey(key) {
    const index = selectedOrder.indexOf(key);
    if (index !== -1) selectedOrder.splice(index, 1);
  }

  function syncSelectAllOrder() {
    if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return;
    selectedOrder.length = 0;
    for (const market of marketData) {
      if (market.selected) selectedOrder.push(keyOfMarket(market));
    }
  }

  function orderedMarkets() {
    if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return [];

    const selected = marketData.filter(m => m.selected);
    const byKey = new Map(selected.map(m => [keyOfMarket(m), m]));
    const ordered = [];

    for (const key of selectedOrder) {
      const market = byKey.get(key);
      if (market) {
        ordered.push(market);
        byKey.delete(key);
      }
    }

    // Fallback for selections made programmatically (for example Pilih Semua).
    for (const market of selected) {
      const key = keyOfMarket(market);
      if (byKey.has(key)) {
        ordered.push(market);
        byKey.delete(key);
      }
    }

    return ordered;
  }

  document.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox' || !input.closest('#market-list')) return;

    const market = resolveMarketFromInput(input);
    if (!market) return;

    const key = keyOfMarket(market);
    removeKey(key);
    if (input.checked) selectedOrder.push(key);
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#clear-all')) {
      selectedOrder.length = 0;
      return;
    }

    if (target.closest('#select-all')) {
      queueMicrotask(syncSelectAllOrder);
    }
  });

  // Capture the process click before each user's original click handler.
  // We run prosesPasaran ourselves with marketData temporarily ordered by click order,
  // then restore the original array immediately after the async function has taken its snapshot.
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('#process-button')) return;
    if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return;
    if (typeof prosesPasaran !== 'function') return;

    const ordered = orderedMarkets();
    if (ordered.length < 2) return; // Let the original handler show its normal validation.

    event.preventDefault();
    event.stopImmediatePropagation();

    const original = marketData.slice();
    const selectedKeys = new Set(ordered.map(keyOfMarket));
    marketData.splice(0, marketData.length, ...ordered, ...original.filter(m => !selectedKeys.has(keyOfMarket(m))));

    try {
      prosesPasaran();
    } finally {
      marketData.splice(0, marketData.length, ...original);
    }
  }, true);
})();
