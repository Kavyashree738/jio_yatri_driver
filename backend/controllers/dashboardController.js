const Order = require("../models/Order");
const Shop = require("../models/CategoryModel");
const User = require("../models/UserRole");

exports.getOwnerDashboard = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const baseUrl = 'https://jio-yatri-driver.onrender.com';

    console.log(`[getOwnerDashboard] 🟢 Fetching dashboard for owner: ${ownerId}`);

    // 🔹 Fetch all shops for this owner
    const shops = await Shop.find({ userId: ownerId }).lean();
    if (!shops.length) {
      return res.json({ success: true, data: [], message: "No shops found for this owner" });
    }

    console.log(`[getOwnerDashboard] Found ${shops.length} shops`);

    const dashboardData = [];

    for (const shop of shops) {
      const shopId = shop._id.toString();
      console.log(`\n[getOwnerDashboard] Processing shop: ${shop.shopName} (${shopId})`);

      // 🔸 Create image URLs
      const shopImageUrls =
        shop.shopImages?.map((id) => `${baseUrl}/api/shops/images/${id}`) || [];

      // 🔸 Fetch all orders belonging to this shop
      const orders = await Order.find({ "shop._id": shopId })
        .lean()
        .sort({ createdAt: -1 })
        .limit(20);

      const totalOrders = orders.length;
      const completedOrders = orders.filter((o) => o.status === "completed").length;
      const totalEarnings = orders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + (o.pricing?.subtotal || 0), 0);

      console.log(
        `[getOwnerDashboard] 📦 Orders=${totalOrders}, Completed=${completedOrders}, Earnings=₹${totalEarnings}`
      );

      // 🔹 Enrich orders with customer info
      const enrichedOrders = await Promise.all(
        orders.map(async (o) => {
          let customerInfo = {};

          // ✅ Handle both userId and uid, fallback to inline info
          if (o.customer?.userId || o.customer?.uid) {
            const lookupId = o.customer.userId || o.customer.uid;

            const u = await User.findOne({ userId: lookupId }).select(
              "name phone email"
            );

            if (u) {
              customerInfo = {
                name: u.name,
                phone: u.phone,
                email: u.email,
                address: o.customer?.address?.line || "",
              };
            } else {
              // fallback directly from order
              customerInfo = {
                name: o.customer?.name || "Unknown",
                phone: o.customer?.phone || "",
                email: o.customer?.email || "",
                address: o.customer?.address?.line || "",
              };
            }
          } else {
            // fallback when no userId at all
            customerInfo = {
              name: o.customer?.name || "Unknown",
              phone: o.customer?.phone || "",
              email: o.customer?.email || "",
              address: o.customer?.address?.line || "",
            };
          }

          return {
            orderCode: o.orderCode,
            status: o.status,
            total: o.pricing?.total || 0,
            vehicleType: o.vehicleType,
            createdAt: o.createdAt,
            items:
              o.items?.map((i) => ({
                name: i.name,
                price: i.price,
                quantity: i.quantity || 1,
              })) || [],
            customer: customerInfo,
          };
        })
      );

      // 🏪 Push final shop data
      dashboardData.push({
        shopId,
        shopName: shop.shopName,
        category: shop.category,
        address: shop.address?.address || "",
        shopImageUrls,
        totalOrders,
        completedOrders,
        totalEarnings,
        recentOrders: enrichedOrders,
      });
    }

    console.log(`[getOwnerDashboard] ✅ Dashboard ready for ${dashboardData.length} shops`);
    res.json({ success: true, data: dashboardData });
  } catch (err) {
    console.error("[getOwnerDashboard] ❌ Error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch owner dashboard",
    });
  }
};
