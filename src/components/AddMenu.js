import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaSpinner,
  FaCheck,
  FaUpload,
  FaChevronLeft,
  FaEdit,
  FaTimes,
} from "react-icons/fa";
import axios from "axios";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/ShopItemsManager.css";
import { useAuth } from "../context/AuthContext";

// ===============================
// Category Config
// ===============================
const CATEGORY_CONFIG = {
  hotel: {
    label: "Restaurant",
    requireImage: true,
    itemFields: [
      { key: "veg", type: "boolean", label: "Vegetarian" },
      {
        key: "category",
        type: "select",
        label: "Menu Category",
        options: ["main", "breakfast", "lunch", "dinner", "snacks", "beverages"],
      },
      {
        key: "spiceLevel",
        type: "select",
        label: "Spice Level",
        options: ["mild", "medium", "spicy"],
      },
    ],
    defaultItem: {
      veg: true,
      category: "main",
      spiceLevel: "medium",
    },
  },
  grocery: { label: "Grocery", requireImage: false, defaultItem: {} },
  vegetable: {
    label: "Vegetable",
    requireImage: false,
    itemFields: [{ key: "organic", type: "boolean", label: "Organic" }],
    defaultItem: { organic: false },
  },
  provision: {
    label: "Provision",
    requireImage: false,
    itemFields: [
      { key: "weight", type: "text", label: "Weight" },
      { key: "brand", type: "text", label: "Brand" },
    ],
    defaultItem: { weight: "", brand: "" },
  },
  medical: { label: "Medical", requireImage: false },
};

const ShopItemsManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { shopId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [shopCategory, setShopCategory] = useState(null);
  const [shopName, setShopName] = useState("");
  const [existingShopImages, setExistingShopImages] = useState([]);
  const [formData, setFormData] = useState({ items: [] });
  const [view, setView] = useState("list");
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const catCfg = useMemo(
    () => CATEGORY_CONFIG[shopCategory] || CATEGORY_CONFIG.hotel,
    [shopCategory]
  );

  const API_BASE =
    process.env.REACT_APP_API_BASE_URL ||
    "https://jio-yatri-driver.onrender.com";

  // ===============================
  // Fetch Shop on mount
  // ===============================
  useEffect(() => {
    const init = async () => {
      if (!user) {
        navigate("/home");
        return;
      }
      setIsLoading(true);
      setError("");
      setSuccess("");

      try {
        const token = await user.getIdToken(true);
        const url = `${API_BASE}/api/shops/${shopId}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const shopData = res?.data?.data || {};
        setShopCategory(shopData.category || null);
        setShopName(shopData.shopName || "");
        setExistingShopImages(
          Array.isArray(shopData.shopImages) ? shopData.shopImages : []
        );

        const items = Array.isArray(shopData.items)
          ? shopData.items.map((item) => ({
            ...item,
            existingImageId:
              item.image ||
              (item.imageUrl
                ? String(item.imageUrl).split("/").pop()
                : undefined),
            existingImageUrl: item.imageUrl,
            image: null,
          }))
          : [];

        setFormData({ items });
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load shop data");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [user, shopId, navigate]);

  // ===============================
  // Item Handlers
  // ===============================
  const handleItemChange = (index, field, value) => {
    if (view === "add") {
      setFormData((prev) => ({
        ...prev,
        currentNewItem: {
          ...(prev.currentNewItem || {}),
          [field]: value,
        },
      }));
    } else if (view === "edit") {
      setEditDraft((prev) => ({
        ...prev,
        [field]: value,
      }));
    } else {
      setFormData((prev) => {
        const items = [...prev.items];
        items[index] = { ...items[index], [field]: value };
        return { ...prev, items };
      });
    }
  };

  const handleItemImageUpload = (index, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Each image must be 5MB or less");
      return;
    }

    if (view === "add") {
      setFormData((prev) => ({
        ...prev,
        currentNewItem: {
          ...(prev.currentNewItem || {}),
          image: file,
          existingImageUrl: URL.createObjectURL(file),
        },
      }));
    } else if (view === "edit") {
      setEditDraft((prev) => ({
        ...prev,
        image: file,
        existingImageUrl: URL.createObjectURL(file),
      }));
    }
  };

  const addItem = () => {
    const defaults = catCfg.defaultItem || {};
    const newItem = {
      name: "",
      price: "",
      image: null,
      existingImageId: undefined,
      existingImageUrl: undefined,
      ...defaults,
    };
    setFormData((prev) => ({ ...prev, currentNewItem: newItem }));
    setCurrentIndex(null);
    setView("add");
  };

  const editItem = (index) => {
    setCurrentIndex(index);
    const itemCopy = { ...formData.items[index] }; // make a copy
    setEditDraft(itemCopy); // store temp editable copy
    setView("edit");
  };

  // ===============================
  // Delete Item
  // ===============================
  const openConfirm = (index) => {
    setDeleteIndex(index);
    setShowConfirm(true);
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setDeleteIndex(null);
  };

  const confirmDelete = async () => {
    if (deleteIndex === null) return;

    try {
      setShowConfirm(false);
      setIsSubmitting(true);
      setError("");
      setSuccess("");

      const updatedItems = formData.items.filter((_, i) => i !== deleteIndex);

      const token = await user.getIdToken();
      const fd = new FormData();
      fd.append("userId", user.uid);
      fd.append("shopId", shopId);
      fd.append("existingShopImages", JSON.stringify(existingShopImages || []));
      fd.append("items", JSON.stringify(updatedItems));

      const url = `${API_BASE}/api/shops/${shopId}`;
      await axios.put(url, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setFormData({ items: updatedItems });
      setDeleteIndex(null);
      setSuccess("Item removed successfully!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError("Failed to remove item. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===============================
  // Save / Update
  // ===============================
  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (
        view === "add" &&
        (!formData.currentNewItem?.name || !formData.currentNewItem?.price)
      ) {
        setError("Please fill item name and price before saving.");
        setIsSubmitting(false);
        return;
      }

      const token = await user.getIdToken();
      const fd = new FormData();
      fd.append("userId", user.uid);
      fd.append("shopId", shopId);
      fd.append(
        "existingShopImages",
        JSON.stringify(existingShopImages || [])
      );

      let updatedItems = [...formData.items];
      if (view === "add" && formData.currentNewItem) {
        updatedItems.push({ ...formData.currentNewItem });
      }

      // ✅ commit draft only now
      if (view === "edit" && editDraft && currentIndex !== null) {
        updatedItems[currentIndex] = editDraft;
      }

      const allowed = new Set([
        "name",
        "price",
        ...(catCfg.itemFields?.map((f) => f.key) || []),
      ]);

      const itemsToSend = updatedItems.map((item) => {
        const out = {};
        allowed.forEach((k) => {
          if (item[k] !== undefined && item[k] !== null && item[k] !== "")
            out[k] = item[k];
        });
        if (!item.image && item.existingImageId) out.image = item.existingImageId;
        if (typeof out.price === "string" && out.price.trim() !== "")
          out.price = parseInt(out.price);
        return out;
      });

      fd.append("items", JSON.stringify(itemsToSend));
      updatedItems.forEach((item) => {
        if (item.image instanceof File) fd.append("itemImages", item.image);
      });

      const url = `${API_BASE}/api/shops/${shopId}`;
      const res = await axios.put(url, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res?.data?.success) throw new Error("Update failed");

      setFormData({ items: updatedItems });
      setSuccess("Menu updated successfully!");
      setTimeout(() => setView("list"), 700);
    } catch (err) {
      console.error("PUT error:", err.response?.data || err.message);
      setError(err?.response?.data?.error || "Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===============================
  // Render
  // ===============================
  if (isLoading) {
    return (
      <>
        <Header />
        <div className="item-manager-loading-container">
          <div className="item-manager-loading-card">
            <FaSpinner className="item-manager-loading-spinner" />
            <p>Loading items…</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const currentItem =
    view === "add" ? formData.currentNewItem : view === "edit" ? editDraft : null;

  return (
    <>
      <Header />
      <div className="shop-items-manager">
        {error && <div className="item-manager-error-message">{error}</div>}
        {success && <div className="item-manager-success-message">{success}</div>}

        <div className="top-bar">
          <button
            onClick={() => {
              if (view === "list") {
                navigate("/business-dashboard");
              } else {
                setView("list");
              }
            }}
          >
            <FaChevronLeft />
          </button>

          {view === "list" && <span>Edit Menu</span>}
          {view === "add" && <span>Add Item</span>}
          {view === "edit" && <span>Edit Item</span>}
        </div>


        {view === "list" && (
          <div className="menu-list">
            <button className="add-item-btn" onClick={addItem}>
              <FaPlus /> Add Item
            </button>

            <div className="item-cards">
              {formData.items.map((it, i) => (
                <div className="item-card" key={i}>
                  <img
                    src={it.existingImageUrl || "/placeholder.png"}
                    alt={it.name || "item"}
                    className="item-img"
                    onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                  />
                  <div className="item-details">
                    <h3>{it.name || "Unnamed"}</h3>
                    <p>₹{it.price || 0}</p>
                  </div>
                  <div className="item-actions">
                    <button className="edit-btn" onClick={() => editItem(i)}>
                      <FaEdit /> Edit
                    </button>
                    <button className="delete-btn" onClick={() => openConfirm(i)}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
              {formData.items.length === 0 && (
                <div className="empty-hint">
                  No items yet. Click “Add Item” to create your first item.
                </div>
              )}
            </div>
          </div>
        )}

        {(view === "add" || view === "edit") && (
          <div className="add-edit-form">
            <form onSubmit={handleSave} className="form-section">
              <div className="photo-box">
                {currentItem?.existingImageUrl ? (
                  <div className="photo-preview-wrap">
                    <img
                      src={currentItem.existingImageUrl}
                      alt="preview"
                      className="photo-preview"
                    />
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() =>
                        handleItemChange(currentIndex, "existingImageUrl", undefined)
                      }
                    >
                      <FaTimes />
                    </button>
                  </div>
                ) : (
                  <label className="photo-upload">
                    <FaUpload />
                    <p>Add Photo</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleItemImageUpload(currentIndex, e.target.files?.[0])
                      }
                    />
                  </label>
                )}
              </div>

              <div className="edit-item-container">
                <div className="input-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    value={currentItem?.name || ""}
                    onChange={(e) =>
                      handleItemChange(currentIndex, "name", e.target.value)
                    }
                    placeholder="Enter item name"
                  />
                </div>

                <div className="input-group">
                  <label>Price (₹)</label>
                  <input
                    type="text"
                    min="0"
                    value={currentItem?.price || ""}
                    onChange={(e) =>
                      handleItemChange(currentIndex, "price", e.target.value)
                    }
                    placeholder="Enter price"
                  />
                </div>

                {catCfg.itemFields?.map((f) => (
                  <div className="input-group" key={f.key}>
                    <label>{f.label}</label>
                    {f.type === "boolean" && (
                      <button
                        type="button"
                        className={`toggle-btn ${currentItem?.[f.key] ? "active" : ""}`}
                        onClick={() =>
                          handleItemChange(currentIndex, f.key, !currentItem?.[f.key])
                        }
                      >
                        {currentItem?.[f.key] ? "Yes" : "No"}
                      </button>
                    )}
                    {f.type === "select" && (
                      <select
                        value={currentItem?.[f.key] ?? f.options?.[0]}
                        onChange={(e) =>
                          handleItemChange(currentIndex, f.key, e.target.value)
                        }
                      >
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt[0].toUpperCase() + opt.slice(1)}
                          </option>
                        ))}
                      </select>
                    )}
                    {f.type === "text" && (
                      <input
                        type="text"
                        value={currentItem?.[f.key] || ""}
                        onChange={(e) =>
                          handleItemChange(currentIndex, f.key, e.target.value)
                        }
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}

                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <FaCheck /> Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {showConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <h3>Remove this item?</h3>
              <p>This action cannot be undone.</p>
              <div className="confirm-actions">
                <button className="cancel-buttons" onClick={cancelDelete}>
                  Cancel
                </button>
                <button className="remove-btn" onClick={confirmDelete}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default ShopItemsManager;
