const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const { checkToken } = require("../middleware/checkToken");
const { containsSensitiveWords } = require("../utils/sensitiveWordFilter");
const {
  getProductRatingStats,
  calculateWeightedRating,
} = require("../utils/ratingCalculator");

const router = express.Router();
const jsonParser = bodyParser.json();

router.post("/", checkToken, jsonParser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, rating, content } = req.body;

    if (!productId || rating === undefined || !content) {
      return res
        .status(400)
        .json({ error: "Product ID, rating and content are required" });
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existingReview = await Review.findOne({
      userId,
      productId,
      isDeleted: false,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ error: "You have already reviewed this product" });
    }

    const hasSensitiveWords = containsSensitiveWords(content);

    const review = await Review.create({
      userId,
      productId,
      rating: ratingNum,
      content,
      status: hasSensitiveWords ? "pending" : "approved",
    });

    const populatedReview = await Review.findById(review.id).populate(
      "userId",
      "username email",
    );

    res.status(201).json({
      review: populatedReview,
      pending: hasSensitiveWords,
      message: hasSensitiveWords
        ? "Your review is pending moderation"
        : "Review submitted successfully",
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "You have already reviewed this product" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { ratingFilter, sortBy = "newest", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const query = {
      productId,
      status: "approved",
      isDeleted: false,
    };

    if (ratingFilter) {
      const ratingNum = parseInt(ratingFilter);
      if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
        query.rating = ratingNum;
      }
    }

    let sortOption = { createdAt: -1 };
    if (sortBy === "useful") {
      sortOption = { usefulCount: -1, createdAt: -1 };
    } else if (sortBy === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sortBy === "highest") {
      sortOption = { rating: -1, createdAt: -1 };
    } else if (sortBy === "lowest") {
      sortOption = { rating: 1, createdAt: -1 };
    }

    const totalCount = await Review.countDocuments(query);

    const reviews = await Review.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "username email");

    const ratingStats = await getProductRatingStats(productId);

    const ratingDistribution = await Review.aggregate([
      {
        $match: {
          productId: mongoose.Types.ObjectId(productId),
          status: "approved",
          isDeleted: false,
        },
      },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const distribution = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = 0;
    }
    ratingDistribution.forEach((item) => {
      distribution[item._id] = item.count;
    });

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      ratingStats: {
        ...ratingStats,
        distribution,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/check/:productId", checkToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const existingReview = await Review.findOne({
      userId,
      productId,
      isDeleted: false,
    });

    res.json({
      hasReviewed: !!existingReview,
      review: existingReview || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:reviewId", checkToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reviewId } = req.params;

    const review = await Review.findOne({
      _id: reviewId,
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own reviews" });
    }

    review.isDeleted = true;
    await review.save();

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:reviewId/useful", checkToken, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOne({
      _id: reviewId,
      status: "approved",
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    review.usefulCount = (review.usefulCount || 0) + 1;
    await review.save();

    res.json({ usefulCount: review.usefulCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:reviewId/reply", checkToken, jsonParser, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;
    const user = req.user;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ error: "Reply content is required" });
    }

    if (reply.length > 500) {
      return res
        .status(400)
        .json({ error: "Reply content too long (max 500 characters)" });
    }

    if (user.role !== "merchant" && user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only merchants or admins can reply to reviews" });
    }

    const review = await Review.findOne({
      _id: reviewId,
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.merchantReply) {
      return res
        .status(400)
        .json({ error: "This review has already been replied to" });
    }

    if (containsSensitiveWords(reply)) {
      return res
        .status(400)
        .json({ error: "Reply contains inappropriate content" });
    }

    review.merchantReply = reply.trim();
    review.merchantReplyAt = new Date();
    await review.save();

    const populatedReview = await Review.findById(review.id).populate(
      "userId",
      "username email",
    );

    res.json({
      message: "Reply submitted successfully",
      review: populatedReview,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
