// import React, { useState, useEffect } from "react";
// import axios from "axios";
// import { useParams, useNavigate } from "react-router-dom";
// import {
//   FaStar, FaClock, FaMapMarkerAlt, FaChevronLeft,
//   FaChevronRight, FaPhone, FaWhatsapp, FaShoppingBag,
//   FaUtensils, FaStore, FaCarrot, FaBoxes, FaMedkit,
//   FaLeaf, FaFire,FaPrescriptionBottleAlt
// } from "react-icons/fa";
// import Header from "../components/Header";
// import Footer from "../components/Footer";
// import "../styles/ShopDetails.css";
// import { useCart } from '../context/CartContext';
// const categoryIcons = {
//   hotel: <FaUtensils />,
//   grocery: <FaStore />,
//   vegetable: <FaCarrot />,
//   provision: <FaBoxes />,
//   medical: <FaMedkit />
// };

// const ShopDetails = () => {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const [shop, setShop] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [currentImageIndex, setCurrentImageIndex] = useState(0);
//   const [showPhone, setShowPhone] = useState(false);
//   const [error, setError] = useState(null);
//   const [filter, setFilter] = useState('all');
//   const [vegFilter, setVegFilter] = useState('all');


//   const formatTime = (timeStr) => {
//     if (!timeStr) return '';
//     const [hour, minute] = timeStr.split(':').map(Number);
//     const ampm = hour >= 12 ? 'PM' : 'AM';
//     const hour12 = hour % 12 === 0 ? 12 : hour % 12;
//     return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
//   };

//   useEffect(() => {
//     const fetchShop = async () => {
//       try {
//         const res = await axios.get(
//           `${process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"}/api/shops/${id}`
//         );
//         setShop(res.data.data);
//       } catch (err) {
//         setError(err.response?.data?.error || err.message || 'Failed to fetch shop details');
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchShop();
//   }, [id]);

//   const handleThumbnailClick = (index) => {
//     setCurrentImageIndex(index);
//   };

//   const navigateImage = (direction) => {
//     if (!shop?.shopImageUrls) return;
//     if (direction === 'prev') {
//       setCurrentImageIndex(prev => prev === 0 ? shop.shopImageUrls.length - 1 : prev - 1);
//     } else {
//       setCurrentImageIndex(prev => prev === shop.shopImageUrls.length - 1 ? 0 : prev + 1);
//     }
//   };

//   const openWhatsApp = (phone, shopName) => {
//     if (!phone) {
//       alert("Phone number is missing");
//       return;
//     }

//     const rawPhone = phone.replace(/\D/g, '');
//     const phoneNumber = rawPhone.startsWith('91') ? rawPhone : '91' + rawPhone;
//     const message = encodeURIComponent(
//       `Hi, I found your business "${shopName}" on JioYatri.`
//     );

//     const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

//     const url = isMobile
//       ? `https://wa.me/${phoneNumber}?text=${message}`
//       : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;

//     window.open(url, '_blank');
//   };

//   const handleOrder = (shop, e) => {
//     e.stopPropagation();
//     navigate(`/shop-order/${shop._id}`, {
//       state: { shop }
//     });
//   };

//   const filteredItems = () => {
//     if (!shop?.itemsWithUrls?.length && !shop?.items?.length) return [];

//     const items = shop.itemsWithUrls || shop.items;

//     return items.filter(item => {
//       // Apply category filter
//       const categoryMatch = filter === 'all' ||
//         (item.category && item.category.toLowerCase() === filter);

//       // Apply veg filter
//       const vegMatch = vegFilter === 'all' ||
//         (vegFilter === 'veg' && item.veg) ||
//         (vegFilter === 'nonveg' && !item.veg);

//       return categoryMatch && vegMatch;
//     });
//   };

//   if (loading) {
//     return (
//       <div className="sd-loading-screen">
//         <div className="sd-spinner"></div>
//         <p>Loading shop details...</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="sd-error-screen">
//         <p>{error}</p>
//         <button className="sd-back-btn" onClick={() => navigate(-1)}>Go Back</button>
//       </div>
//     );
//   }

//   if (!shop) {
//     return (
//       <div className="sd-error-screen">
//         <p>Shop details not found</p>
//         <button className="sd-back-btn" onClick={() => navigate(-1)}>Go Back</button>
//       </div>
//     );
//   }

//   return (
//     <>
//       <Header />
//       <div className="sd-details-container">
//         <button className="sd-back-btn" onClick={() => navigate('/business-dashboard')}>
//           <FaChevronLeft /> Back to List
//         </button>


//         <div className="sd-category-badge">
//           {categoryIcons[shop.category] || <FaStore />}
//           <span>{shop.category || 'Shop'}</span>
//         </div>

//         {/* Image Gallery */}
//         <div className="sd-gallery-container">
//           {shop.shopImageUrls?.length > 0 && (
//             <>
//               <div className="sd-main-image">
//                 <img
//                   src={shop.shopImageUrls[currentImageIndex]}
//                   alt={`${shop.shopName} ${currentImageIndex + 1}`}
//                   className="sd-current-image"
//                 />
//                 <button className="sd-nav-btn sd-prev-btn" onClick={() => navigateImage('prev')}>
//                   <FaChevronLeft />
//                 </button>
//                 <button className="sd-nav-btn sd-next-btn" onClick={() => navigateImage('next')}>
//                   <FaChevronRight />
//                 </button>
//                 <div className="sd-image-counter">
//                   {currentImageIndex + 1} / {shop.shopImageUrls.length}
//                 </div>
//               </div>
//               <div className="sd-thumbnail-container">
//                 {shop.shopImageUrls.map((img, index) => (
//                   <div
//                     className={`sd-thumbnail ${index === currentImageIndex ? 'sd-active' : ''}`}
//                     key={index}
//                     onClick={() => handleThumbnailClick(index)}
//                   >
//                     <img src={img} alt={`Thumbnail ${index + 1}`} />
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}
//         </div>

//         {/* Shop Info */}
//         <div className="sd-content-container">
//           <div className="sd-header">
//             <div className="sd-header-info">
//               <h1 className="sd-title">{shop.shopName}</h1>
//               <div className="sd-meta-container">
//                 <div className="sd-meta-item">
//                   <FaMapMarkerAlt className="sd-meta-icon" />
//                   <span>{shop.address?.address || "Address not available"}</span>
//                 </div>
//                 <div className="sd-meta-item">
//                   <FaClock className="sd-meta-icon" />
//                   <span>{shop.openingTime ? `Opens at ${formatTime(shop.openingTime)}` : 'Opening time not available'}</span>
//                   <span>{shop.closingTime && ` | Closes at ${formatTime(shop.closingTime)}`}</span>
//                 </div>
//               </div>
//             </div>
//             <div className="sd-action-container">
//               <div className="sd-rating">
//                 <FaStar className="sd-star-icon" />
//                 <span>{shop.averageRating?.toFixed(1) || '4.5'}</span>
//                 <span className="sd-rating-count">({shop.ratingCount || '0'} ratings)</span>
//               </div>
//               <div className="sd-contact-actions">
//                 {showPhone ? (
//                   <a href={`tel:${shop.phone}`} className="sd-call-btn">
//                     <FaPhone /> {shop.phone}
//                   </a>
//                 ) : (
//                   <button className="sd-call-btn" onClick={() => setShowPhone(true)}>
//                     <FaPhone /> Show Number
//                   </button>
//                 )}
//                 <button className="sd-whatsapp-btn" onClick={() => openWhatsApp(shop.phone, shop.shopName)}>
//                   <FaWhatsapp /> WhatsApp
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* Products Section */}
//           <div className="sd-products-section">
//             <h2 className="sd-section-title">
//               {shop.category === 'hotel' ? 'Menu Items' : 'Products'}
//             </h2>

//             {/* Filters for Hotel/Food Items */}
//             {shop.category === 'hotel' && (
//               <div className="sd-filters-container">
//                 <div className="sd-filter-group">
//                   <h4>Category:</h4>
//                   <div className="sd-filter-buttons">
//                     <button
//                       className={filter === 'all' ? 'active' : ''}
//                       onClick={() => setFilter('all')}
//                     >
//                       All
//                     </button>
//                     <button
//                       className={filter === 'breakfast' ? 'active' : ''}
//                       onClick={() => setFilter('breakfast')}
//                     >
//                       Breakfast
//                     </button>
//                     <button
//                       className={filter === 'lunch' ? 'active' : ''}
//                       onClick={() => setFilter('lunch')}
//                     >
//                       Lunch
//                     </button>
//                     <button
//                       className={filter === 'dinner' ? 'active' : ''}
//                       onClick={() => setFilter('dinner')}
//                     >
//                       Dinner
//                     </button>
//                     <button
//                       className={filter === 'snacks' ? 'active' : ''}
//                       onClick={() => setFilter('snacks')}
//                     >
//                       Snacks
//                     </button>
//                   </div>
//                 </div>

//                 <div className="sd-filter-group">
//                   <h4>Type:</h4>
//                   <div className="sd-filter-buttons">
//                     <button
//                       className={vegFilter === 'all' ? 'active' : ''}
//                       onClick={() => setVegFilter('all')}
//                     >
//                       All
//                     </button>
//                     <button
//                       className={vegFilter === 'veg' ? 'active' : ''}
//                       onClick={() => setVegFilter('veg')}
//                     >
//                       Vegetarian
//                     </button>
//                     <button
//                       className={vegFilter === 'nonveg' ? 'active' : ''}
//                       onClick={() => setVegFilter('nonveg')}
//                     >
//                       Non-Vegetarian
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {filteredItems().length > 0 ? (
//               <div className="sd-products-grid">
//                 {filteredItems().map((item) => (
//                   <div className="sd-product-card" key={item._id || item.name}>
//                     <div className="sd-product-image-container">
//                       {item.imageUrl ? (
//                         <img
//                           src={item.imageUrl}
//                           alt={item.name}
//                           className="sd-product-image"
//                           onError={(e) => {
//                             e.target.onerror = null;
//                             e.target.src = '/placeholder-food.jpg';
//                           }}
//                         />
//                       ) : (
//                         <div className="sd-product-image-placeholder">
//                           {shop.category === 'hotel' ? (
//                             <FaUtensils className="sd-placeholder-icon" />
//                           ) : (
//                             <FaBoxes className="sd-placeholder-icon" />
//                           )}
//                         </div>
//                       )}

//                       {/* Veg/Non-Veg Badge */}
//                       {shop.category === 'hotel' && (
//                         <div className={`sd-veg-badge ${item.veg ? 'veg' : 'nonveg'}`}>
//                           {item.veg ? 'Veg' : 'Non-Veg'}
//                         </div>
//                       )}
//                     </div>

//                     <div className="sd-product-info">
//                       <div className="sd-product-name-price">
//                         <h3 className="sd-product-name">{item.name}</h3>
//                         <p className="sd-product-price">₹{item.price}</p>
//                       </div>

//                       {/* Food Category */}
//                       {shop.category === 'hotel' && item.category && (
//                         <p className="sd-food-category">
//                           {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
//                         </p>
//                       )}

//                       {item.description && (
//                         <p className="sd-product-desc">{item.description}</p>
//                       )}

//                       {/* Tags Section */}
//                       <div className="sd-product-tags">
//                         {item.organic && (
//                           <span className="sd-product-tag organic">
//                             <FaLeaf /> Organic
//                           </span>
//                         )}
//                         {item.prescriptionRequired && (
//                           <span className="sd-product-tag prescription">
//                             Prescription Required
//                           </span>
//                         )}
//                         {/* {shop.category === 'hotel' && item.spiceLevel && (
//                           <span className={`sd-product-tag spice-${item.spiceLevel}`}>
//                             <FaFire /> {item.spiceLevel}
//                           </span>
//                         )} */}
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <p className="sd-no-products">
//                 {shop.category === 'hotel' ? 'No menu items match your filters' : 'No products available'}
//               </p>
//             )}
//           </div>

//           {/* <button className="sd-action-btn sd-order" onClick={(e) => handleOrder(shop, e)}>
//             <FaShoppingBag className="sd-icon" /> Order Now
//           </button> */}
//         </div>
//       </div>
//       <Footer />
//     </>
//   );
// };

// export default ShopDetails;

// src/components/ShopDetails.jsx
// src/pages/ShopDetails.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaStar, FaClock, FaMapMarkerAlt, FaChevronLeft,
  FaChevronRight, FaPhone, FaWhatsapp, FaUtensils,
  FaStore, FaCarrot, FaBoxes, FaMedkit, FaFire,
  FaBreadSlice, FaCoffee
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/ShopDetails.css";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const categoryIcons = {
  hotel: <FaUtensils />,
  grocery: <FaStore />,
  vegetable: <FaCarrot />,
  provision: <FaBoxes />,
  medical: <FaMedkit />,
  bakery: <FaBreadSlice />,
  cafe: <FaCoffee />
};

const ShopDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [vegFilter, setVegFilter] = useState("all");

  // auth (to show owner actions)
  const { user } = useAuth();

  // Cart (kept as in your codebase)
  const { addItem, cart } = useCart();
  const shopCartItems = shop ? (cart?.[shop._id]?.items || []) : [];
  const cartCount = shopCartItems.reduce((s, it) => s + (it.quantity || 0), 0);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shops/${id}`
        );
        setShop(res.data.data);
      } catch (err) {
        setError(
          err.response?.data?.error || err.message || "Failed to fetch shop details"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [id]);

  const handleThumbnailClick = (index) => setCurrentImageIndex(index);

  const navigateImage = (direction) => {
    if (!shop?.shopImageUrls) return;
    if (direction === "prev") {
      setCurrentImageIndex((prev) =>
        prev === 0 ? shop.shopImageUrls.length - 1 : prev - 1
      );
    } else {
      setCurrentImageIndex((prev) =>
        prev === shop.shopImageUrls.length - 1 ? 0 : prev + 1
      );
    }
  };

  const openWhatsApp = (phone, shopName) => {
    if (!phone) {
      alert("Phone number is missing");
      return;
    }
    const rawPhone = phone.replace(/\D/g, "");
    const phoneNumber = rawPhone.startsWith("91") ? rawPhone : "91" + rawPhone;
    const message = encodeURIComponent(
      `Hi, I found your business "${shopName}" on JioYatri.`
    );
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );
    const url = isMobile
      ? `https://wa.me/${phoneNumber}?text=${message}`
      : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;
    window.open(url, "_blank");
  };

  // Apply filters intelligently:
  // - Category filter applies only for hotel (because only hotel items have category like breakfast/lunch…)
  // - Veg/Non-veg applies for hotel & bakery (cafe doesn't have veg flag)
  const filteredItems = () => {
    if (!shop?.itemsWithUrls?.length && !shop?.items?.length) return [];
    const items = shop.itemsWithUrls || shop.items;

    const supportsVeg = ["hotel", "bakery"].includes(shop.category);
    const isHotel = shop.category === "hotel";

    return items.filter((item) => {
      const categoryMatch =
        !isHotel || // non-hotel: ignore category filter
        filter === "all" ||
        (item.category && item.category.toLowerCase() === filter);

      let vegMatch = true;
      if (vegFilter !== "all" && supportsVeg) {
        if (vegFilter === "veg") vegMatch = item.veg === true;
        if (vegFilter === "nonveg") vegMatch = item.veg === false;
      }
      return categoryMatch && vegMatch;
    });
  };

  if (loading) {
    return (
      <div className="sd-loading-screen">
        <div className="sd-spinner"></div>
        <p>Loading shop details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-error-screen">
        <p>{error}</p>
        <button className="sd-back-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="sd-error-screen">
        <p>Shop details not found</p>
        <button className="sd-back-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const isOwner = user && String(user.uid) === String(shop.userId);

  return (
    <>
      <Header />
      <div className="sd-details-container">
        <button
          className="sd-back-btn"
          onClick={() => navigate("/business-dashboard")}
        >
          <FaChevronLeft /> Back to List
        </button>

        <div className="sd-category-badge">
          {categoryIcons[shop.category] || <FaStore />}
          <span>{shop.category || "Shop"}</span>
        </div>

        {/* Image Gallery */}
        <div className="sd-gallery-container">
          {shop.shopImageUrls?.length > 0 && (
            <>
              <div className="sd-main-image">
                <img
                  src={shop.shopImageUrls[currentImageIndex]}
                  alt={`${shop.shopName} ${currentImageIndex + 1}`}
                  className="sd-current-image"
                />
                <button
                  className="sd-nav-btn sd-prev-btn"
                  onClick={() => navigateImage("prev")}
                >
                  <FaChevronLeft />
                </button>
                <button
                  className="sd-nav-btn sd-next-btn"
                  onClick={() => navigateImage("next")}
                >
                  <FaChevronRight />
                </button>
                <div className="sd-image-counter">
                  {currentImageIndex + 1} / {shop.shopImageUrls.length}
                </div>
              </div>
              <div className="sd-thumbnail-container">
                {shop.shopImageUrls.map((img, index) => (
                  <div
                    className={`sd-thumbnail ${index === currentImageIndex ? "sd-active" : ""}`}
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                  >
                    <img src={img} alt={`Thumbnail ${index + 1}`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Shop Info */}
        <div className="sd-content-container">
          <div className="sd-header">
            <div className="sd-header-info">
              <h1 className="sd-title">{shop.shopName}</h1>
              <div className="sd-meta-container">
                <div className="sd-meta-item">
                  <FaMapMarkerAlt className="sd-meta-icon" />
                  <span>{shop.address?.address || "Address not available"}</span>
                </div>
                <div className="sd-meta-item">
                  <FaClock className="sd-meta-icon" />
                  <span>
                    {shop.openingTime
                      ? `Opens at ${formatTime(shop.openingTime)}`
                      : "Opening time not available"}
                  </span>
                  <span>
                    {shop.closingTime && ` | Closes at ${formatTime(shop.closingTime)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="sd-action-container">
              {/* Owner-only Add/Edit button */}
              {isOwner && (
                <button
                  className="sd-manage-menu-btn"
                  onClick={() => navigate(`/shop/${shop._id}/menu`)}
                  title="Add or edit items"
                >
                  + Add / Edit Items
                </button>
              )}

              <div className="sd-contact-actions">
                {showPhone ? (
                  <a href={`tel:${shop.phone}`} className="sd-call-btn">
                    <FaPhone /> {shop.phone}
                  </a>
                ) : (
                  <button className="sd-call-btn" onClick={() => setShowPhone(true)}>
                    <FaPhone /> Show Number
                  </button>
                )}
                <button
                  className="sd-whatsapp-btn"
                  onClick={() => openWhatsApp(shop.phone, shop.shopName)}
                >
                  <FaWhatsapp /> WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="sd-products-section">
            <h2 className="sd-section-title">
              {["hotel", "bakery", "cafe"].includes(shop.category) ? "Menu Items" : "Products"}
            </h2>

            {/* Filters: full (category + veg) for hotel; veg-only for bakery */}
            {["hotel", "bakery"].includes(shop.category) && (
              <div className="sd-filters-container">
                {shop.category === "hotel" && (
                  <div className="sd-filter-group">
                    <h4>Category:</h4>
                    <div className="sd-filter-buttons">
                      {["all", "breakfast", "lunch", "dinner", "snacks"].map((c) => (
                        <button
                          key={c}
                          className={filter === c ? "active" : ""}
                          onClick={() => setFilter(c)}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sd-filter-group">
                  <h4>Type:</h4>
                  <div className="sd-filter-buttons">
                    {[
                      ["all", "All"],
                      ["veg", "Vegetarian"],
                      ["nonveg", "Non-Vegetarian"],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        className={vegFilter === val ? "active" : ""}
                        onClick={() => setVegFilter(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {filteredItems().length > 0 ? (
              <div className="sd-products-grid">
                {filteredItems().map((item) => (
                  <div className="sd-product-card" key={item._id || item.name}>
                    <div className="sd-product-image-container">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="sd-product-image"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholder-food.jpg";
                          }}
                        />
                      ) : (
                        <div className="sd-product-image-placeholder">
                          {shop.category === "hotel" && <FaUtensils className="sd-placeholder-icon" />}
                          {shop.category === "bakery" && <FaBreadSlice className="sd-placeholder-icon" />}
                          {shop.category === "cafe" && <FaCoffee className="sd-placeholder-icon" />}
                          {["grocery", "vegetable", "provision", "medical"].includes(shop.category) && (
                            <FaBoxes className="sd-placeholder-icon" />
                          )}
                        </div>
                      )}

                      {/* Veg/Non-Veg badge for hotel & bakery only */}
                      {["hotel", "bakery"].includes(shop.category) && typeof item.veg === "boolean" && (
                        <div className={`sd-veg-badge ${item.veg ? "veg" : "nonveg"}`}>
                          {item.veg ? "Veg" : "Non-Veg"}
                        </div>
                      )}
                    </div>

                    <div className="sd-product-info">
                      <div className="sd-product-name-price">
                        <h3 className="sd-product-name">{item.name}</h3>
                        <p className="sd-product-price">₹{item.price}</p>
                      </div>

                      {/* Category label only for hotel menu items */}
                      {shop.category === "hotel" && item.category && (
                        <p className="sd-food-category">
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                        </p>
                      )}

                      {/* Provision meta */}
                      {["provision", "grocery"].includes(shop.category) && (item.brand || item.weight) && (
                        <div className="sd-provision-meta">
                          {item.brand && (
                            <span className="sd-provision-chip sd-provision-brand">
                              {item.brand}
                            </span>
                          )}
                          {item.weight && (
                            <span className="sd-provision-chip sd-provision-weight">
                              {item.weight}
                            </span>
                          )}
                        </div>
                      )}


                      {item.description && (
                        <p className="sd-product-desc">{item.description}</p>
                      )}

                      {/* Tags */}
                      <div className="sd-product-tags">
                        {item.organic && (
                          <span className="sd-product-tag organic">Organic</span>
                        )}
                        {item.prescriptionRequired && (
                          <span className="sd-product-tag prescription">
                            Prescription Required
                          </span>
                        )}
                        {shop.category === "hotel" && item.spiceLevel && (
                          <span className={`sd-product-tag spice-${item.spiceLevel}`}>
                            <FaFire /> {item.spiceLevel.charAt(0).toUpperCase() + item.spiceLevel.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sd-no-products">
                {["hotel", "bakery"].includes(shop.category)
                  ? "No menu items match your filters"
                  : "No products available"}
              </p>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ShopDetails;
