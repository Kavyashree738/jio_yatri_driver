// src/components/ItemCatalogPicker.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../styles/ItemCatalogPicker.css';
import { useTranslation } from "react-i18next";

const getFieldsByCategory = (t) => ({
  grocery: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 0 },
    { key: 'weight', label: t("weight_example"), type: 'text' },
    { key: 'quantity', label: t("quantity_stock"), type: 'number', required: true, min: 0, def: 1 },
  ],
  provision: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 0 },
    { key: 'weight', label: t("weight_example"), type: 'text' },
    { key: 'quantity', label: t("quantity_stock"), type: 'number', required: true, min: 0, def: 1 },
  ],
  hotel: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 1 },
    { key: 'veg', label: t("vegetarian"), type: 'boolean', def: true },
  ],
  bakery: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 1 },
    { key: 'veg', label: t("vegetarian"), type: 'boolean', def: true },
  ],
  cafe: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 1 },
  ],
  vegetable: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 0 },
    { key: 'organic', label: t("organic"), type: 'boolean', def: false },
  ],
  medical: [
    { key: 'price', label: t("price_amount"), type: 'number', required: true, min: 0 },
  ],
});


export default function ItemCatalogPicker({ category, onAdd }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const { t } = useTranslation();

  // ❌ OLD → const fields = FIELDS_BY_CATEGORY[category] || [];
  // ✅ FIX:
  const fields = getFieldsByCategory(t)[category] || [];

  useEffect(() => {
    const run = async () => {
      if (!category) return;
      const apiBase = 'https://jio-yatri-driver.onrender.com';
      const res = await axios.get(`${apiBase}/api/catalog/${category}`);
      setList(Array.isArray(res?.data?.data) ? res.data.data : []);
    };
    run();
  }, [category]);

  useEffect(() => {
    setPicked(null);
    const init = {};
    fields.forEach(f => {
      if (f.def !== undefined) init[f.key] = f.def;
      else if (f.type === 'boolean') init[f.key] = false;
      else init[f.key] = '';
    });
    setForm(init);
  }, [category, t]); // 🔥 Rebuild when language changes

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(x => x.name.toLowerCase().includes(s));
  }, [list, q]);

  const openDialog = (item) => {
    setError('');
    setPicked(item);
    const init = {};
    fields.forEach(f => {
      if (f.def !== undefined) init[f.key] = f.def;
      else if (f.type === 'boolean') init[f.key] = false;
      else init[f.key] = '';
    });
    setForm(init);
  };

  const commit = () => {
    for (const f of fields) {
      if (f.required) {
        const v = form[f.key];
        if (!v && v !== 0) {
          setError(t("fill_required", { field: f.label }));
          return;
        }
        if (f.type === 'number' && f.min != null && Number(v) < f.min) {
          setError(t("value_min", { field: f.label, min: f.min }));
          return;
        }
      }
    }

    const item = {
      name: picked.name,
      image: picked.imageId,
      ...form,
      price: form.price != null ? Number(form.price) : undefined,
    };

    if ('veg' in form) item.veg = form.veg === true || form.veg === 'true';
    if ('organic' in form) item.organic = form.organic === true || form.organic === 'true';
    if ('prescriptionRequired' in form) item.prescriptionRequired = form.prescriptionRequired === true || form.prescriptionRequired === 'true';
    if ('quantity' in form) item.quantity = Number(form.quantity);

    onAdd(item);
    setPicked(null);
  };

  return (
    <div className="catalog-picker">
      <div className="catalog-picker-header">
        <h3 className="catalog-picker-title">{t("select_from_catalog")}</h3>

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t("search_item")}
          className="catalog-picker-search"
        />
      </div>

      <div className="catalog-picker-grid-horizontal">
        {filtered.map(it => (
          <div className="catalog-picker-card-horizontal" key={it._id}>
            <div
              className="catalog-picker-image-horizontal"
              style={{ backgroundImage: `url(${it.imageUrl})` }}
            />
            <div className="catalog-picker-content-horizontal">
              <div className="catalog-picker-name-horizontal">{it.name}</div>
              <button
                className="catalog-picker-add-btn-horizontal"
                onClick={() => openDialog(it)}
              >
                {t("add")}
              </button>
            </div>
          </div>
        ))}

        {!filtered.length && <div className="catalog-picker-empty">{t("no_items_found")}</div>}
      </div>

      {picked && (
        <div className="catalog-picker-modal">
          <div className="catalog-picker-dialog">
            {/* Header */}
            <div className="catalog-picker-dialog-header">
              <div
                className="catalog-picker-thumb"
                style={{ backgroundImage: `url(${picked.imageUrl})` }}
              />
              <div className="catalog-picker-dialog-title">{picked.name}</div>
            </div>

            {/* Form */}
            <div className="catalog-picker-fields">
              {fields.map(f => (
                <div key={f.key} className="catalog-picker-field">
                  <label>
                    {f.label}
                    {f.required && <span className="required">*</span>}
                  </label>

                  {f.type === 'text' && (
                    <input
                      type="text"
                      value={form[f.key] ?? ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}

                  {f.type === 'number' && (
                    <input
                      type="number"
                      min={f.min ?? 0}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}

                  {f.type === 'boolean' && (
                    <label className="catalog-picker-toggle">
                      <input
                        type="checkbox"
                        checked={!!form[f.key]}
                        onChange={e => setForm({ ...form, [f.key]: e.target.checked })}
                      />
                      <span className="catalog-picker-toggle-slider"></span>
                    </label>
                  )}
                </div>
              ))}
            </div>

            {error && <div className="catalog-picker-error">{error}</div>}

            {/* Buttons */}
            <div className="catalog-picker-dialog-actions">
              <button
                onClick={() => setPicked(null)}
                className="catalog-picker-cancel-btn"
              >
                {t("cancel")}
              </button>

              <button
                onClick={commit}
                className="catalog-picker-confirm-btn"
              >
                {t("add_item")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
