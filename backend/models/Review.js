const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "approved",
    },
    usefulCount: {
      type: Number,
      default: 0,
    },
    merchantReply: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    merchantReplyAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

reviewSchema.index({ productId: 1, status: 1, isDeleted: 1 });
reviewSchema.index({ userId: 1, productId: 1, isDeleted: 1 }, { unique: true });

reviewSchema.options.toJSON = {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

module.exports = mongoose.model("Review", reviewSchema);
