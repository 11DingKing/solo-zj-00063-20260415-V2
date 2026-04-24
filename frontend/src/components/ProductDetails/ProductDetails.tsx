import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import numeral from "numeral";
import RaisedButton from "material-ui/RaisedButton";
import FlatButton from "material-ui/FlatButton";
import Snackbar from "material-ui/Snackbar";
import TextField from "material-ui/TextField";
import SelectField from "material-ui/SelectField";
import MenuItem from "material-ui/MenuItem";
import Dialog from "material-ui/Dialog";
import AddShoppingCart from "material-ui/svg-icons/action/add-shopping-cart";
import KeyboardArrowLeft from "material-ui/svg-icons/hardware/keyboard-arrow-left";
import Delete from "material-ui/svg-icons/action/delete";
import ThumbUp from "material-ui/svg-icons/action/thumb-up";
import {
  IUser,
  ICatalogProduct,
  IReview,
  IRatingStats,
  IGetReviewsResponse,
} from "@typings/state/index";
import { createCart } from "@api/cart";
import {
  getProductReviews,
  submitReview,
  checkUserReview,
  deleteReview,
  markReviewUseful,
  getProductDetail,
} from "@api/review";
import "@styles/ProductDetails.css";

export interface Props {
  loggedUser: IUser;
  product: ICatalogProduct;
}

const StarRating = ({
  rating,
  size = 20,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const renderStar = (index: number) => {
    const filled = hoverRating ? index <= hoverRating : index <= rating;
    const style: React.CSSProperties = {
      display: "inline-block",
      fontSize: size,
      color: filled ? "#FFD700" : "#ddd",
      cursor: interactive ? "pointer" : "default",
    };

    const starProps = interactive
      ? {
          onMouseEnter: () => setHoverRating(index),
          onMouseLeave: () => setHoverRating(0),
          onClick: () => onChange && onChange(index),
        }
      : {};

    return (
      <span key={index} style={style} {...starProps}>
        ★
      </span>
    );
  };

  return <span>{[1, 2, 3, 4, 5].map(renderStar)}</span>;
};

const ProductDetails = ({ loggedUser, product }: Props) => {
  const [quantity, setQuantity] = useState(1);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarType, setSnackbarType] = useState<"success" | "error">(
    "success",
  );

  const [reviews, setReviews] = useState<IReview[]>([]);
  const [ratingStats, setRatingStats] = useState<IRatingStats | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [hasReviewed, setHasReviewed] = useState(false);
  const [userReview, setUserReview] = useState<IReview | null>(null);

  const [newRating, setNewRating] = useState(5);
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "highest" | "lowest" | "useful"
  >("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  const { info } = product;

  const showSnackbar = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarOpen(true);
  };

  const loadReviews = useCallback(async () => {
    if (!product._id) return;

    setLoadingReviews(true);
    try {
      const options: any = {
        sortBy,
        page: currentPage,
        limit: 10,
      };

      if (ratingFilter) {
        options.ratingFilter = ratingFilter;
      }

      const response = await getProductReviews(product._id, options);
      const data: IGetReviewsResponse = response.data;

      setReviews(data.reviews);
      setRatingStats(data.ratingStats);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error("Failed to load reviews:", error);
      showSnackbar("Failed to load reviews", "error");
    } finally {
      setLoadingReviews(false);
    }
  }, [product._id, ratingFilter, sortBy, currentPage]);

  const checkUserReviewStatus = useCallback(async () => {
    if (!loggedUser || !product._id) return;

    try {
      const response = await checkUserReview(product._id);
      setHasReviewed(response.data.hasReviewed);
      setUserReview(response.data.review);
    } catch (error) {
      console.error("Failed to check review status:", error);
    }
  }, [loggedUser, product._id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (loggedUser) {
      checkUserReviewStatus();
    }
  }, [checkUserReviewStatus, loggedUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [ratingFilter, sortBy]);

  const onQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    setQuantity(parseInt(value));
  };

  const addToCart = async () => {
    loggedUser &&
      (await createCart({
        user: loggedUser.id,
        product: product._id,
        quantity,
      }));

    showSnackbar(
      loggedUser ? "Item added to your cart." : "You must be logged in!",
    );
  };

  const handleSubmitReview = async () => {
    if (!newContent.trim()) {
      showSnackbar("Please enter review content", "error");
      return;
    }

    if (newContent.length > 1000) {
      showSnackbar("Review content too long (max 1000 characters)", "error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitReview({
        productId: product._id,
        rating: newRating,
        content: newContent.trim(),
      });

      if (response.data.pending) {
        showSnackbar(
          "Your review contains sensitive content and is pending moderation",
          "success",
        );
      } else {
        showSnackbar("Review submitted successfully!", "success");
      }

      setNewRating(5);
      setNewContent("");
      setHasReviewed(true);
      setUserReview(response.data.review);
      loadReviews();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to submit review";
      showSnackbar(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      await deleteReview(reviewToDelete);
      showSnackbar("Review deleted successfully", "success");
      setHasReviewed(false);
      setUserReview(null);
      loadReviews();
    } catch (error) {
      showSnackbar("Failed to delete review", "error");
    } finally {
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
    }
  };

  const handleMarkUseful = async (reviewId: string) => {
    if (!loggedUser) {
      showSnackbar("Please login to mark review as useful", "error");
      return;
    }

    try {
      const response = await markReviewUseful(reviewId);
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, usefulCount: response.data.usefulCount }
            : review,
        ),
      );
    } catch (error) {
      console.error("Failed to mark useful:", error);
    }
  };

  const confirmDeleteReview = (reviewId: string) => {
    setReviewToDelete(reviewId);
    setDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getPercentage = (count: number) => {
    if (!ratingStats || ratingStats.reviewCount === 0) return 0;
    return Math.round((count / ratingStats.reviewCount) * 100);
  };

  return (
    <div className="product-details-container">
      <h1>{info.name}</h1>
      <div className="product-details">
        <div className="product-image">
          <img src={info.photo} alt={info.name} />
        </div>
        <div className="product-info">
          <table>
            <tr>
              <th>Model</th>
              <td>{info.name}</td>
            </tr>
            <tr>
              <th>Dimensions</th>
              <td>{info.dimensions}</td>
            </tr>
            <tr>
              <th>Weight</th>
              <td>{info.weight}</td>
            </tr>
            <tr>
              <th>Display Type</th>
              <td>{info.displayType}</td>
            </tr>
            <tr>
              <th>Display Size</th>
              <td>{info.displaySize}</td>
            </tr>
            <tr>
              <th>Display Resolution</th>
              <td>{info.displayResolution}</td>
            </tr>
            <tr>
              <th>OS</th>
              <td>{info.os}</td>
            </tr>
            <tr>
              <th>CPU</th>
              <td>{info.cpu}</td>
            </tr>
            <tr>
              <th>Internal Memory</th>
              <td>{info.internalMemory}</td>
            </tr>
            <tr>
              <th>RAM</th>
              <td>{info.ram}</td>
            </tr>
            <tr>
              <th>Camera</th>
              <td>{info.camera}</td>
            </tr>
            <tr>
              <th>Batery</th>
              <td>{info.batery}</td>
            </tr>
            <tr>
              <th>Color</th>
              <td>{info.color}</td>
            </tr>
          </table>
        </div>
      </div>
      <div className="product-handle">
        <div className="left">
          <RaisedButton
            containerElement={<Link to="/" />}
            className="btn"
            label="Back to catalog"
            labelPosition="after"
            secondary={true}
            icon={<KeyboardArrowLeft />}
          />
        </div>
        <div className="right">
          <div className="price">
            <span className="price-text">Price: </span>
            <span className="price-num">
              {numeral(info.price).format("$0,0.00")}
            </span>
          </div>
          <div className="quantity">
            <span className="price-text">Quantity: </span>
            <span>
              <input
                type="number"
                value={quantity}
                min="1"
                max="5"
                onChange={onQuantityChange}
              />
            </span>
          </div>
          <div className="btn">
            <RaisedButton
              onClick={addToCart}
              label="Add to cart"
              labelPosition="before"
              primary={true}
              icon={<AddShoppingCart />}
            />
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <div className="reviews-header">
          <h2>Reviews</h2>

          {ratingStats && (
            <div className="rating-summary">
              <div className="average-rating">
                <div className="rating-value">
                  {ratingStats.weightedRating.toFixed(1)}
                </div>
                <StarRating
                  rating={Math.round(ratingStats.weightedRating)}
                  size={24}
                />
                <div className="review-count">
                  ({ratingStats.reviewCount} reviews)
                </div>
              </div>

              <div className="rating-distribution">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="rating-bar-row">
                    <span className="star-label">{star} star</span>
                    <div className="rating-bar-container">
                      <div
                        className="rating-bar"
                        style={{
                          width: `${getPercentage(ratingStats.distribution[star as keyof typeof ratingStats.distribution])}%`,
                        }}
                      />
                    </div>
                    <span className="star-count">
                      {
                        ratingStats.distribution[
                          star as keyof typeof ratingStats.distribution
                        ]
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {loggedUser && !hasReviewed && (
          <div className="write-review-section">
            <h3>Write a Review</h3>
            <div className="review-form">
              <div className="rating-input">
                <span className="label">Your Rating:</span>
                <StarRating
                  rating={newRating}
                  size={28}
                  interactive={true}
                  onChange={setNewRating}
                />
                <span className="rating-text">({newRating} stars)</span>
              </div>
              <TextField
                hintText="Share your experience with this product..."
                floatingLabelText="Review Content"
                multiLine
                rows={4}
                fullWidth
                value={newContent}
                onChange={({ target }: any) => setNewContent(target.value)}
                disabled={submitting}
              />
              <div className="form-actions">
                <RaisedButton
                  label="Submit Review"
                  primary={true}
                  onClick={handleSubmitReview}
                  disabled={submitting || !newContent.trim()}
                />
              </div>
            </div>
          </div>
        )}

        {loggedUser && hasReviewed && (
          <div className="reviewed-notice">
            <span className="reviewed-badge">
              ✓ You have already reviewed this product
            </span>
          </div>
        )}

        <div className="reviews-controls">
          <SelectField
            floatingLabelText="Filter by Rating"
            value={ratingFilter || 0}
            onChange={(_, __, value) =>
              setRatingFilter(value === 0 ? null : value)
            }
          >
            <MenuItem value={0} primaryText="All Ratings" />
            <MenuItem value={5} primaryText="5 Stars" />
            <MenuItem value={4} primaryText="4 Stars" />
            <MenuItem value={3} primaryText="3 Stars" />
            <MenuItem value={2} primaryText="2 Stars" />
            <MenuItem value={1} primaryText="1 Star" />
          </SelectField>

          <SelectField
            floatingLabelText="Sort By"
            value={sortBy}
            onChange={(_, __, value) => setSortBy(value)}
          >
            <MenuItem value="newest" primaryText="Newest First" />
            <MenuItem value="oldest" primaryText="Oldest First" />
            <MenuItem value="highest" primaryText="Highest Rated" />
            <MenuItem value="lowest" primaryText="Lowest Rated" />
            <MenuItem value="useful" primaryText="Most Useful" />
          </SelectField>
        </div>

        <div className="reviews-list">
          {loadingReviews ? (
            <div className="loading">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="no-reviews">
              <p>
                {ratingFilter
                  ? `No ${ratingFilter}-star reviews yet.`
                  : "No reviews yet. Be the first to review this product!"}
              </p>
            </div>
          ) : (
            reviews.map((review) => {
              const reviewUser = review.userId as any;
              const username = reviewUser?.username || "Anonymous";
              const isOwnReview =
                loggedUser && userReview && userReview.id === review.id;

              return (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <span className="reviewer-name">{username}</span>
                      <StarRating rating={review.rating} size={16} />
                    </div>
                    <div className="review-meta">
                      <span className="review-date">
                        {formatDate(review.createdAt)}
                      </span>
                      {isOwnReview && (
                        <FlatButton
                          className="delete-btn"
                          icon={<Delete />}
                          onClick={() => confirmDeleteReview(review.id)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="review-content">{review.content}</div>
                  <div className="review-actions">
                    <FlatButton
                      label={`Useful (${review.usefulCount})`}
                      icon={<ThumbUp />}
                      onClick={() => handleMarkUseful(review.id)}
                    />
                  </div>

                  {review.merchantReply && (
                    <div className="merchant-reply">
                      <div className="reply-header">
                        <span className="reply-label">Seller Reply</span>
                        {review.merchantReplyAt && (
                          <span className="reply-date">
                            {formatDate(review.merchantReplyAt)}
                          </span>
                        )}
                      </div>
                      <div className="reply-content">
                        {review.merchantReply}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <FlatButton
              label="Previous"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            />
            <span className="page-info">
              Page {currentPage} of {totalPages} ({totalCount} total)
            </span>
            <FlatButton
              label="Next"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        )}
      </div>

      <Dialog
        title="Delete Review"
        actions={[
          <FlatButton
            label="Cancel"
            primary={true}
            onClick={() => setDeleteDialogOpen(false)}
          />,
          <FlatButton
            label="Delete"
            secondary={true}
            onClick={handleDeleteReview}
          />,
        ]}
        modal={true}
        open={deleteDialogOpen}
      >
        Are you sure you want to delete this review? This action cannot be
        undone.
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        message={snackbarMessage}
        autoHideDuration={4000}
        bodyStyle={
          snackbarType === "success"
            ? { background: "#64DD17" }
            : { background: "#F44336" }
        }
        onRequestClose={() => setSnackbarOpen(false)}
      />
    </div>
  );
};

export default ProductDetails;
