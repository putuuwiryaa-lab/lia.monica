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
      queueMicrotask(() => {
        if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return;
        selectedOrder.length = 0;
        for (const market of marketData) {
          if (market.selected) selectedOrder.push(keyOfMarket(market));
        }
      });
    }
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('#process-button')) return;
    if (typeof marketData === 'undefined' || !Array.isArray(marketData)) return;

    const original = marketData.slice();
    const selected = original.filter(m => m.selected);
    if (selected.length < 2) return;

    const selectedByKey = new Map(selected.map(m => [keyOfMarket(m), m]));
    const orderedSelected = [];

    for (const key of selectedOrder) {
      const market = selectedByKey.get(key);
      if (market) {
        orderedSelected.push(market);
        selectedByKey.delete(key);
      }
    }

    for (const market of selected) {
      const key = keyOfMarket(market);
      if (selectedByKey.has(key)) {
        orderedSelected.push(market);
        selectedByKey.delete(key);
      }
    }

    const selectedKeys = new Set(orderedSelected.map(keyOfMarket));
    marketData.splice(0, marketData.length, ...orderedSelected, ...original.filter(m => !selectedKeys.has(keyOfMarket(m))));

    queueMicrotask(() => {
      marketData.splice(0, marketData.length, ...original);
    });
  }, true);
})();
