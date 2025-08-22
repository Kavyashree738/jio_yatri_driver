// src/pages/OrderConfirmation.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/OrderConfirmation.css';

const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Small helper to safely format money
const num = (v) => Number(v ?? 0);
const fmt = (v) => num(v).toFixed(2);

const Confetti = () => {
  const boxRef = useRef(null);

  useEffect(() => {
    const colors = ['#ff5773', '#ff884b', '#ffd384', '#a6e3e9', '#4CAF50'];
    const holder = boxRef.current;
    if (!holder) return;

    const created = [];
    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = `${Math.random() * 100}vw`;
      el.style.animationDelay = `${Math.random() * 3}s`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      holder.appendChild(el);
      created.push(el);
    }

    return () => created.forEach(el => el.remove());
  }, []);

  return <div ref={boxRef} className="confetti-container" />;
};

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState(null);
  const [showTick, setShowTick] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const url = `${apiBase}/api/orders/${orderId}`;
        console.log('[OrderConfirmation] GET', url);
        const res = await axios.get(url);
        setOrder(res.data.data);
        setTimeout(() => setShowTick(true), 300);
      } catch (e) {
        console.error('[OrderConfirmation] load error:', e?.response?.status, e?.response?.data || e.message);
        setErr(e?.response?.data?.error || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading) return <div className="oc-loading">Loading...</div>;
  if (err) return <div className="oc-loading">Error: {err}</div>;
  if (!order) return <div className="oc-loading">Order not found.</div>;

  const pricing = order.pricing || {};
  const showTax = pricing.tax != null; // only show if present

  return (
    <div className="oc-container">
      <Confetti />

      <div className="oc-card">
        <div className={`oc-tick ${showTick ? 'show' : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>

        <h2>Order Confirmed</h2>

        <p className="oc-order-code">
          Order Code: <strong>{order.orderCode}</strong>
        </p>
        <p className="oc-shop-name">Shop: {order.shop?.name}</p>

        <div className="oc-section">
          <h3>Items</h3>
          <ul className="oc-items">
            {order.items?.map((it, i) => (
              <li key={i}>
                <span>{it.name} × {num(it.quantity)}</span>
                <span>₹{fmt(num(it.price) * num(it.quantity))}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="oc-section">
          <h3>Amount</h3>
          <div className="oc-amount-row">
            <span>Subtotal:</span>
            <span>₹{fmt(pricing.subtotal)}</span>
          </div>

          {showTax && (
            <div className="oc-amount-row">
              <span>Tax:</span>
              <span>₹{fmt(pricing.tax)}</span>
            </div>
          )}

          <div className="oc-amount-row">
            <span>Delivery:</span>
            <span>₹{fmt(pricing.deliveryFee)}</span>
          </div>

          {num(pricing.discount) > 0 && (
            <div className="oc-amount-row">
              <span>Discount:</span>
              <span>−₹{fmt(pricing.discount)}</span>
            </div>
          )}

          <div className="oc-amount-row total">
            <span>Total:</span>
            <span>₹{fmt(pricing.total)}</span>
          </div>
        </div>

        <Link to="/" className="oc-home-btn">Go Home</Link>
      </div>
    </div>
  );
}
