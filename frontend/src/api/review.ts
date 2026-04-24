import http from "./index";
import {
  ISubmitReviewParams,
  ISubmitReviewResponse,
  IGetReviewsResponse,
  ICheckReviewResponse,
} from "@typings/state/review";

const PREFIX = "/reviews";

export const submitReview = (
  params: ISubmitReviewParams,
): Promise<{ data: ISubmitReviewResponse }> => {
  return http.post(PREFIX, params);
};

export const getProductReviews = (
  productId: string,
  options?: {
    ratingFilter?: number;
    sortBy?: "newest" | "oldest" | "highest" | "lowest" | "useful";
    page?: number;
    limit?: number;
  },
): Promise<{ data: IGetReviewsResponse }> => {
  const params: Record<string, any> = {};

  if (options) {
    if (options.ratingFilter) params.ratingFilter = options.ratingFilter;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
  }

  return http.get(`${PREFIX}/product/${productId}`, { params });
};

export const checkUserReview = (
  productId: string,
): Promise<{ data: ICheckReviewResponse }> => {
  return http.get(`${PREFIX}/check/${productId}`);
};

export const deleteReview = (reviewId: string) => {
  return http.delete(`${PREFIX}/${reviewId}`);
};

export const markReviewUseful = (
  reviewId: string,
): Promise<{ data: { usefulCount: number } }> => {
  return http.put(`${PREFIX}/${reviewId}/useful`);
};

export const getProductDetail = (productId: string) => {
  return http.get(`/catalog/${productId}`);
};
