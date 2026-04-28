interface Review {
  id: string;
  rating: number;
  comment: string;
  title?: string | null;
  date: string;
  customer: {
    name: string;
    imgUrl?: string | null;
  };
  published?: boolean;
  verifiedPurchase?: boolean;
}

export default Review;
