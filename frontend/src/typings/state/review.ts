export interface IReviewUser {
  username: string;
  email: string;
  id: string;
}

export interface IReview {
  id: string;
  userId: IReviewUser | string;
  productId: string;
  rating: number;
  content: string;
  status: "pending" | "approved";
  usefulCount: number;
  merchantReply: string | null;
  merchantReplyAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface IRatingStats {
  weightedRating: number;
  reviewCount: number;
  distribution: IRatingDistribution;
}

export interface IReviewPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface IGetReviewsResponse {
  reviews: IReview[];
  pagination: IReviewPagination;
  ratingStats: IRatingStats;
}

export interface ICheckReviewResponse {
  hasReviewed: boolean;
  review: IReview | null;
}

export interface ISubmitReviewParams {
  productId: string;
  rating: number;
  content: string;
}

export interface ISubmitReviewResponse {
  review: IReview;
  pending: boolean;
  message: string;
}

export interface IReplyToReviewParams {
  reviewId: string;
  reply: string;
}

export interface IReplyToReviewResponse {
  message: string;
  review: IReview;
}
