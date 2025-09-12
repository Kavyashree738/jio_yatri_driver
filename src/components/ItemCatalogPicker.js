// src/components/ItemCatalogPicker.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../styles/ItemCatalogPicker.css';

const FIELDS_BY_CATEGORY = {
  hotel: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 1 },
    { key: 'veg', label: 'Vegetarian', type: 'boolean', def: true },
    {
      key: 'category', label: 'Menu Category', type: 'select', required: true,
      options: ['main', 'breakfast', 'lunch', 'dinner', 'snacks', 'beverages'], def: 'main'
    },
    {
      key: 'spiceLevel', label: 'Spice Level', type: 'select',
      options: ['mild', 'medium', 'spicy'], def: 'medium'
    },
    // { key: 'description', label: 'Description', type: 'textarea', maxLength: 100 },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  // NEW: Bakery — like hotel but no category/spice/description; has veg
  bakery: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 1 },
    { key: 'veg', label: 'Vegetarian', type: 'boolean', def: true },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  // NEW: Cafe — simple: price + available (no veg/spice/description)
  cafe: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 1 },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  grocery: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 0 },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  vegetable: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 0 },
    { key: 'organic', label: 'Organic', type: 'boolean', def: false },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  provision: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 0 },
    { key: 'weight', label: 'Weight (e.g., 1kg / 500g)', type: 'text' },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
  medical: [
    { key: 'price', label: 'Price (₹)', type: 'number', required: true, min: 0 },
    { key: 'prescriptionRequired', label: 'Prescription Required', type: 'boolean', def: false },
    { key: 'available', label: 'Available', type: 'boolean', def: true },
  ],
};

export default function ItemCatalogPicker({ category, onAdd }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const fields = FIELDS_BY_CATEGORY[category] || [];

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
  }, [category]); // eslint-disable-line

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
        if (v === '' || v === undefined || v === null) {
          setError(`Please fill ${f.label}`);
          return;
        }
        if (f.type === 'number' && f.min != null && Number(v) < f.min) {
          setError(`${f.label} must be at least ${f.min}`);
          return;
        }
      }
    }

    const item = {
      name: picked.name,
      image: picked.imageId,
      ...form,
      price: form.price != null ? Number(form.price) : undefined,
      available: form.available === true || form.available === 'true',
    };

    // only add these if they exist in form
    if ('veg' in form) item.veg = form.veg === true || form.veg === 'true';
    if ('organic' in form) item.organic = form.organic === true || form.organic === 'true';
    if ('prescriptionRequired' in form) item.prescriptionRequired = form.prescriptionRequired === true || form.prescriptionRequired === 'true';

    onAdd(item);
    setPicked(null);
  };

  return (
    <div className="catalog-picker">
      <div className="catalog-picker-header">
        <h3 className="catalog-picker-title">Select from Catalog</h3>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search item…"
          className="catalog-picker-search"
        />
      </div>

      <div className="catalog-picker-grid-horizontal">
        {filtered.map(it => (
          <div className="catalog-picker-card-horizontal" key={it._id}>
            <div className="catalog-picker-image-horizontal" style={{ backgroundImage: `url(${it.imageUrl})` }} />
            <div className="catalog-picker-content-horizontal">
              <div className="catalog-picker-name-horizontal">{it.name}</div>
              <button className="catalog-picker-add-btn-horizontal" onClick={() => openDialog(it)}>Add</button>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="catalog-picker-empty">No items found</div>}
      </div>

      {picked && (
        <div className="catalog-picker-modal">
          <div className="catalog-picker-dialog">
            <div className="catalog-picker-dialog-header">
              <div className="catalog-picker-thumb" style={{ backgroundImage: `url(${picked.imageUrl})` }} />
              <div className="catalog-picker-dialog-title">{picked.name}</div>
            </div>

            <div className="catalog-picker-fields">
              {fields.map(f => (
                <div key={f.key} className="catalog-picker-field">
                  <label>{f.label}{f.required && <span className="required">*</span>}</label>
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
                  {f.type === 'textarea' && (
                    <textarea
                      maxLength={f.maxLength}
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
                  {f.type === 'select' && (
                    <select
                      value={form[f.key] ?? f.options?.[0]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    >
                      {(f.options || []).map(opt => (
                        <option key={opt} value={opt}>
                          {opt[0].toUpperCase() + opt.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            {error && <div className="catalog-picker-error">{error}</div>}

            <div className="catalog-picker-dialog-actions">
              <button onClick={() => setPicked(null)} className="catalog-picker-cancel-btn">Cancel</button>
              <button onClick={commit} className="catalog-picker-confirm-btn">Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
