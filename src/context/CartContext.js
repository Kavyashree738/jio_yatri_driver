import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

/**
 * cart shape:
 * {
 *   [shopId]: {
 *     shop: { _id, shopName, category, phone, phonePeNumber },
 *     items: [{ itemId, name, price, imageUrl, veg, category, quantity }]
 *   }
 * }
 */
export default function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jy_cart') || '{}'); }
    catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('jy_cart', JSON.stringify(cart));
  }, [cart]);

  const addItem = (shop, item) => {
    setCart(prev => {
      const shopId = shop._id;
      const bucket = prev[shopId] || { shop, items: [] };
      const idx = bucket.items.findIndex(i => i.itemId === item.itemId);
      let items;
      if (idx >= 0) {
        items = [...bucket.items];
        items[idx] = { ...items[idx], quantity: (items[idx].quantity || 0) + (item.quantity || 1) };
      } else {
        items = [...bucket.items, { ...item, quantity: item.quantity || 1 }];
      }
      return { ...prev, [shopId]: { ...bucket, items } };
    });
  };

  const removeItem = (shopId, itemId) => {
    setCart(prev => {
      const bucket = prev[shopId];
      if (!bucket) return prev;
      const items = bucket.items.filter(i => i.itemId !== itemId);
      const next = { ...prev, [shopId]: { ...bucket, items } };
      if (items.length === 0) delete next[shopId];
      return next;
    });
  };

  const setQty = (shopId, itemId, qty) => {
    setCart(prev => {
      const bucket = prev[shopId];
      if (!bucket) return prev;
      const items = bucket.items.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i);
      return { ...prev, [shopId]: { ...bucket, items } };
    });
  };

  const clearShopCart = (shopId) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
  };

  const value = useMemo(() => ({
    cart, addItem, removeItem, setQty, clearShopCart
  }), [cart]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
