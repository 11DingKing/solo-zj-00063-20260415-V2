const express = require("express");
const Product = require("../models/Product");
const { getProductRatingStats } = require("../utils/ratingCalculator");

const router = express.Router();

router.get("/", (req, res) => {
  Product.find({}).then((foundProduct) => {
    res.send(foundProduct);
  });
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ratingStats = await getProductRatingStats(id);

    res.json({
      ...product.toJSON(),
      ratingStats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
