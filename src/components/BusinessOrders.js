import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Header from './Header';
import '../styles/BusinessOrders.css';
import { initializeOwnerFCM } from '../services/ownerFCM';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const apiBase = 'https://jio-yatri-driver.onrender.com';

export default function BusinessOrders({ shopId }) {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [hidePaid, setHidePaid] = useState(true);

    const { shopId: shopIdFromParams } = useParams();
    const resolvedShopId = shopId || shopIdFromParams; // undefined on /business-orders
    const navigate = useNavigate();

    console.log('[BusinessOrders] Component rendered', {
        resolvedShopId,
        hasUser: !!user,
        userId: user?.uid
    });

    const load = async () => {
        try {
            console.log('[BusinessOrders] Loading orders...');
            setLoading(true);
            setErr(null);

            let url;
            if (resolvedShopId) {
                url = `${apiBase}/api/orders/shop/${resolvedShopId}`;
                console.log('[BusinessOrders] Loading orders for shop:', resolvedShopId);
            } else {
                if (!user?.uid) {
                    console.error('[BusinessOrders] Missing owner id for aggregate orders');
                    throw new Error('Missing owner id');
                }
                url = `${apiBase}/api/orders/owner/${user.uid}`;
                console.log('[BusinessOrders] Loading orders for owner:', user.uid);
            }

            console.log('[BusinessOrders] Making GET request to:', url);
            const res = await axios.get(url);
            console.log('[BusinessOrders] Response received:', {
                status: res.status,
                dataCount: res.data?.data?.length || 0
            });

            setOrders(res.data.data || []);
            console.log('[BusinessOrders] Orders state updated with', res.data.data?.length || 0, 'orders');
        } catch (e) {
            console.error('[BusinessOrders] Error loading orders:', {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e.message
            });
            setErr(e.response?.data?.error || e.message || 'Failed to load orders');
        } finally {
            setLoading(false);
            console.log('[BusinessOrders] Loading completed');
        }
    };

    // Load when we have either a shopId or (for aggregate) the user id
    useEffect(() => {
        console.log('[BusinessOrders] useEffect triggered for load', {
            resolvedShopId,
            userId: user?.uid
        });

        if (resolvedShopId || user?.uid) {
            console.log('[BusinessOrders] Conditions met, calling load()');
            load();
        } else {
            console.log('[BusinessOrders] Conditions not met, not loading orders');
        }
    }, [resolvedShopId, user?.uid]);

    // FCM useEffect - Fixed version
    useEffect(() => {
        console.log('[BusinessOrders] FCM useEffect triggered', { resolvedShopId });

        const initializeFCMForAllShops = async () => {
            try {
                if (resolvedShopId) {
                    // Single shop view - initialize for this specific shop
                    console.log('[BusinessOrders] Initializing FCM for shopId:', resolvedShopId);
                    await initializeOwnerFCM(resolvedShopId);
                } else if (user?.uid) {
                    // Aggregate view - initialize for ALL shops owned by this user
                    console.log('[BusinessOrders] Loading shops for user:', user.uid);

                    const shopsResponse = await axios.get(`${apiBase}/api/shops/owner/${user.uid}`);
                    const shops = shopsResponse.data?.data || []; // FIX: Access the data property

                    console.log('[BusinessOrders] Found shops for user:', shops.length, shops);

                    // Check if shops is actually an array before iterating
                    if (Array.isArray(shops) && shops.length > 0) {
                        // Initialize FCM for each shop
                        for (const shop of shops) {
                            console.log('[BusinessOrders] Initializing FCM for shop:', shop._id);
                            await initializeOwnerFCM(shop._id);
                        }
                    } else {
                        console.log('[BusinessOrders] No shops found or shops is not an array');
                    }
                }
            } catch (error) {
                console.error('[BusinessOrders] FCM initialization error:', error);
            }
        };

        initializeFCMForAllShops();
    }, [resolvedShopId, user?.uid]);
    // Debug first order
    useEffect(() => {
        if (Array.isArray(orders) && orders.length) {
            console.log('[BusinessOrders] Orders updated. First order:', {
                orderId: orders[0]?._id,
                shopId: orders[0]?.shop?._id,
                status: orders[0]?.status,
                paymentStatus: orders[0]?.payment?.status
            });
        } else {
            console.log('[BusinessOrders] Orders updated. No orders or empty array');
        }
    }, [orders]);

    // Actions
    const acceptOrder = async (id) => {
        try {
            console.log('[BusinessOrders] Accepting order:', id);
            setBusy(id);
            const url = `${apiBase}/api/orders/${id}/status`;
            const payload = { status: 'accepted' };
            console.log('[BusinessOrders] Making PATCH request to:', url, 'with payload:', payload);

            const res = await axios.patch(url, payload);
            console.log('[BusinessOrders] Order accepted successfully:', {
                status: res.status,
                data: res.data?.data
            });

            // Optimistic local update
            setOrders((prev) => {
                const updatedOrders = prev.map((o) => (o._id === id ? { ...o, status: 'accepted' } : o));
                console.log('[BusinessOrders] Orders after optimistic update:', updatedOrders);
                return updatedOrders;
            });
        } catch (e) {
            console.error('[BusinessOrders] Error accepting order:', {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e.message
            });
            alert(e.response?.data?.error || 'Failed to accept order');
        } finally {
            setBusy(null);
            console.log('[BusinessOrders] Accept order process completed');
        }
    };

    const markPaymentDone = async (id) => {
        try {
            console.log('[BusinessOrders] Marking payment done for order:', id);
            setBusy(id);
            const url = `${apiBase}/api/orders/${id}/payment`;
            const payload = { status: 'paid', method: 'cod' };
            console.log('[BusinessOrders] Making PATCH request to:', url, 'with payload:', payload);

            const res = await axios.patch(url, payload);
            console.log('[BusinessOrders] Payment marked successfully:', {
                status: res.status,
                data: res.data?.data
            });

            const updated = res.data?.data;
            if (updated) {
                console.log('[BusinessOrders] Updating orders with complete response data');
                setOrders((prev) => {
                    const updatedOrders = prev.map((o) => (o._id === id ? updated : o));
                    console.log('[BusinessOrders] Orders after update:', updatedOrders);
                    return updatedOrders;
                });
            } else {
                console.log('[BusinessOrders] Updating orders with partial payment data');
                setOrders((prev) => {
                    const updatedOrders = prev.map((o) =>
                        o._id === id ? { ...o, payment: { ...(o.payment || {}), status: 'paid' } } : o
                    );
                    console.log('[BusinessOrders] Orders after partial update:', updatedOrders);
                    return updatedOrders;
                });
            }
        } catch (e) {
            console.error('[BusinessOrders] Error marking payment done:', {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e.message
            });
            alert(e.response?.data?.error || 'Failed to update payment');
        } finally {
            setBusy(null);
            console.log('[BusinessOrders] Mark payment done process completed');
        }
    };

    // Filter list by Hide paid toggle
    // Filter list by Hide paid toggle + ALWAYS hide cancelled
    const visibleOrders = useMemo(() => {
        const list = Array.isArray(orders) ? orders : [];
        // always drop cancelled
        const notCancelled = list.filter(o => o.status !== 'cancelled');
        // optionally hide paid
        return hidePaid
            ? notCancelled.filter(o => (o.payment?.status || 'unpaid') !== 'paid')
            : notCancelled;
    }, [orders, hidePaid]);


    const title = resolvedShopId ? 'Incoming Orders' : 'All Incoming Orders';
    console.log('[BusinessOrders] Rendering with title:', title);

    if (!resolvedShopId && !user?.uid) {
        console.log('[BusinessOrders] Rendering: Please sign in to view your orders.');
        return <div className="bo">Please sign in to view your orders.</div>;
    }

    if (loading) {
        console.log('[BusinessOrders] Rendering: Loading state');
        return <div className="bo">Loading…</div>;
    }

    console.log('[BusinessOrders] Rendering main component with', visibleOrders.length, 'visible orders');

    return (
        <>
            <Header />
            <div className="bo">
                <div className="bo-header">
                    <div className="cart-topbar">
                        <button className="back-btn" onClick={() => navigate('/business-dashboard')}>← Back</button>
                    </div>
                    <h2>{title}</h2>
                    <label className="bo-toggle">
                        <input
                            type="checkbox"
                            checked={hidePaid}
                            onChange={(e) => {
                                console.log('[BusinessOrders] Hide paid toggle changed:', e.target.checked);
                                setHidePaid(e.target.checked);
                            }}
                        />
                        <span>Hide paid orders</span>
                    </label>
                </div>

                {err && (
                    console.log('[BusinessOrders] Rendering error message:', err),
                    <p style={{ color: 'crimson' }}>Error: {err}</p>
                )}

                {visibleOrders.length === 0 && !err && (
                    console.log('[BusinessOrders] Rendering: No orders message'),
                    <p>{hidePaid ? 'All done! No unpaid orders.' : 'No orders yet.'}</p>
                )}

                {visibleOrders.map((o) => {
                    console.log('[BusinessOrders] Rendering order:', o._id);
                    return (
                        <div key={o._id} className="bo-card">
                            <div className="bo-top">
                                <div>
                                    <b>{o.orderCode}</b> • {new Date(o.createdAt).toLocaleString()}
                                    {!resolvedShopId && o.shop?.name ? (
                                        <> • Shop: <b>{o.shop.name}</b></>
                                    ) : null}
                                </div>
                                <div>
                                    Status: <b>{o.status}</b> • Payment: <b>{o.payment?.status || 'unpaid'}</b>
                                </div>
                            </div>

                            <div className="bo-customer">
                                <div>Customer: {o.customer?.name} ({o.customer?.phone})</div>
                                <div>Address: {o.customer?.address?.line}</div>
                                {o.notes ? <div>Notes: {o.notes}</div> : null}
                            </div>

                            <div className="bo-items">
                                {(o.items || []).map((it, i) => (
                                    <div key={i} className="bo-item">
                                        <img src={it.imageUrl || '/placeholder-food.jpg'} alt={it.name} />
                                        <div>{it.name} × {it.quantity}</div>
                                        <div>₹{(Number(it.price) * Number(it.quantity)).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="bo-total">
                                Total: ₹{Number(o.pricing?.total || 0).toFixed(2)}
                            </div>

                            <div className="bo-actions">
                                {o.status === 'pending' && (
                                    <button
                                        className="bo-btn accept"
                                        onClick={() => {
                                            console.log('[BusinessOrders] Accept button clicked for order:', o._id);
                                            acceptOrder(o._id);
                                        }}
                                        disabled={busy === o._id}
                                    >
                                        {busy === o._id ? 'Accepting…' : 'Accept order'}
                                    </button>
                                )}

                                {o.payment?.status !== 'paid' && (
                                    <button
                                        className="bo-btn paid"
                                        onClick={() => {
                                            console.log('[BusinessOrders] Payment button clicked for order:', o._id);
                                            markPaymentDone(o._id);
                                        }}
                                        disabled={busy === o._id}
                                    >
                                        {busy === o._id ? 'Marking…' : 'Payment done'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}