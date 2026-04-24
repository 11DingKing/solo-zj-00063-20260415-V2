const Review = require("../models/Review");

const calculateWeightedRating = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return {
      weightedRating: 0,
      reviewCount: 0,
    };
  }

  const now = new Date();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

  let totalWeight = 0;
  let weightedSum = 0;

  reviews.forEach((review) => {
    const reviewDate = new Date(review.createdAt);
    const daysDiff = (now - reviewDate) / (24 * 60 * 60 * 1000);

    let weight = 1;

    if (daysDiff <= 30) {
      weight = 2 - daysDiff / 30;
    } else {
      const extraDays = daysDiff - 30;
      weight = Math.max(0.1, 1 - extraDays / 180);
    }

    totalWeight += weight;
    weightedSum += review.rating * weight;
  });

  const weightedRating = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const roundedRating = Math.round(weightedRating * 10) / 10;

  return {
    weightedRating: roundedRating,
    reviewCount: reviews.length,
  };
};

const getProductRatingStats = async (productId) => {
  const reviews = await Review.find({
    productId,
    status: "approved",
    isDeleted: false,
  }).sort({ createdAt: -1 });

  return calculateWeightedRating(reviews);
};

module.exports = {
  calculateWeightedRating,
  getProductRatingStats,
};
