const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/owner/:ownerId", dashboardController.getOwnerDashboard);

module.exports = router;
