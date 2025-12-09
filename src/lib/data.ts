export type Product = {
  id: string;
  name: string;
  description: string;
  imageId: string;
  price: number;
};

export type Feedback = {
  id: string;
  productId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  timestamp: string;
  analysis: {
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    authenticityScore: number;
    isPotentiallyFake: boolean;
    reason: string;
  };
};

export type SocialPost = {
  id: string;
  productId: string;
  platform:
    | 'twitter'
    | 'instagram'
    | 'tiktok'
    | 'meta'
    | 'google'
    | 'amazon'
    | 'flipkart'
    | 'reddit';
  userName: string;
  userHandle: string;
  userAvatar: string;
  text: string;
  mediaUrl?: string;
  likes: number;
  shares: number;
  comments: number;
  timestamp: string;
  analysis: {
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number;
    influenceScore: number;
    isKeyOpinionLeader: boolean;
    category: 'Product Feedback' | 'Brand Mention' | 'Customer Support' | 'Other';
  };
};

export type LeaderboardUser = {
  id: string;
  name: string;
  avatar: string;
  points: number;
};

export type Challenge = {
    id: string;
    title: string;
    description: string;
    points: number;
    progress: number;
}

export type Reward = {
    id: string;
    name: string;
    pointsCost: number;
    stock: number | 'unlimited';
}

export type PayoutRequest = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  amount: number; // in USD
  points: number;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  processedAt?: string;
}

export const mockProducts: Product[] = [
  {
    id: 'prod_001',
    name: 'Aura Smartwatch',
    description:
      'The Aura Smartwatch combines cutting-edge technology with elegant design. Track your fitness, stay connected with notifications, and enjoy a vibrant AMOLED display. With a battery that lasts for days, it is the perfect companion for your active lifestyle.',
    imageId: 'product-smartwatch',
    price: 299.99,
  },
  {
    id: 'prod_002',
    name: 'SonicWave Headphones',
    description:
      'Immerse yourself in pure sound with SonicWave Headphones. Featuring active noise cancellation, high-fidelity audio, and a comfortable over-ear design, they are perfect for music lovers and frequent travelers. Enjoy up to 30 hours of playtime on a single charge.',
    imageId: 'product-headphones',
    price: 199.99,
  },
  {
    id: 'prod_003',
    name: 'ProCapture Camera',
    description:
      'Capture life’s moments in stunning detail with the ProCapture Camera. This DSLR offers a 24MP sensor, 4K video recording, and a fast autofocus system. Its ergonomic design and intuitive controls make it suitable for both beginners and professionals.',
    imageId: 'product-camera',
    price: 899.0,
  },
  {
    id: 'prod_004',
    name: 'Velocity Runners',
    description:
      'Experience unmatched comfort and performance with the Velocity Runners. These athletic shoes feature responsive cushioning, a breathable mesh upper, and a durable outsole for excellent traction. Ideal for running, training, or everyday wear.',
    imageId: 'product-shoes',
    price: 129.5,
  },
  {
    id: 'prod_005',
    name: 'AeroGlide Drone',
    description:
      'Explore the world from a new perspective with the AeroGlide Drone. Equipped with a 4K camera, 3-axis gimbal, and intelligent flight modes, it makes capturing breathtaking aerial shots effortless. Compact, foldable, and easy to fly.',
    imageId: 'product-drone',
    price: 499.0,
  },
  {
    id: 'prod_006',
    name: 'Glow Skincare Set',
    description:
      'Revitalize your skin with the Glow Skincare Set. This curated collection includes a gentle cleanser, a hydrating serum, and a nourishing moisturizer. Made with natural ingredients to give your skin a healthy, radiant glow.',
    imageId: 'product-skincare',
    price: 75.0,
  },
    {
    id: 'sp_amazon_001',
    productId: 'prod_001',
    platform: 'amazon',
    userName: 'Amazon Customer',
    userHandle: 'Verified Buyer',
    userAvatar: 'https://i.pravatar.cc/150?u=amazon1',
    text: 'Great quality, delivered on time. Exactly as described in the listing.',
    likes: 12,
    shares: 0,
    comments: 3,
    timestamp: '2024-05-22T12:00:00Z',
    analysis: {
      sentiment: 'positive',
      sentimentScore: 0.9,
      influenceScore: 0.4,
      isKeyOpinionLeader: false,
      category: 'Product Feedback',
    },
  },
  {
    id: 'sp_flipkart_001',
    productId: 'prod_002',
    platform: 'flipkart',
    userName: 'Flipkart User',
    userHandle: 'Certified Buyer',
    userAvatar: 'https://i.pravatar.cc/150?u=flipkart1',
    text: 'Packaging was good, but the sound leakage is a bit high at full volume.',
    likes: 5,
    shares: 0,
    comments: 1,
    timestamp: '2024-05-23T09:30:00Z',
    analysis: {
      sentiment: 'neutral',
      sentimentScore: 0.1,
      influenceScore: 0.3,
      isKeyOpinionLeader: false,
      category: 'Product Feedback',
    },
  },
  {
    id: 'sp_reddit_001',
    productId: 'prod_003',
    platform: 'reddit',
    userName: 'r/PhotographyUser',
    userHandle: 'u/photo-geek',
    userAvatar: 'https://i.pravatar.cc/150?u=reddit1',
    text: 'For the price, this camera is actually insane. Low-light performance surprised me.',
    likes: 48,
    shares: 6,
    comments: 12,
    timestamp: '2024-05-24T18:15:00Z',
    analysis: {
      sentiment: 'positive',
      sentimentScore: 0.85,
      influenceScore: 0.8,
      isKeyOpinionLeader: true,
      category: 'Brand Mention',
    },
  },

];

export const mockFeedback: Feedback[] = [
  {
    id: 'fb_001',
    productId: 'prod_001',
    userName: 'Alice Johnson',
    userAvatar: 'https://i.pravatar.cc/150?u=alice',
    rating: 5,
    text: "I absolutely love the Aura Smartwatch! The battery life is incredible, and the screen is so bright and clear. It tracks my workouts perfectly. Highly recommend!",
    timestamp: '2024-05-20T10:30:00Z',
    analysis: {
      sentiment: 'positive',
      sentimentScore: 0.95,
      authenticityScore: 0.98,
      isPotentiallyFake: false,
      reason: 'Review is detailed and references specific product features. User has a verified purchase history.',
    },
  },
  {
    id: 'fb_002',
    productId: 'prod_002',
    userName: 'Bob Williams',
    userAvatar: 'https://i.pravatar.cc/150?u=bob',
    rating: 2,
    text: "The noise cancellation on the SonicWave headphones is not as good as advertised. I can still hear a lot of background noise on my commute. The sound quality is okay, but I expected more for the price.",
    timestamp: '2024-05-19T14:00:00Z',
    analysis: {
      sentiment: 'negative',
      sentimentScore: -0.6,
      authenticityScore: 0.95,
      isPotentiallyFake: false,
      reason: 'Specific, constructive criticism related to product features. No signs of malicious intent.',
    },
  },
  {
    id: 'fb_003',
    productId: 'prod_001',
    userName: 'Charlie Brown',
    userAvatar: 'https://i.pravatar.cc/150?u=charlie',
    rating: 3,
    text: "It's a decent watch. It does what it says it will do, but I find the user interface a bit confusing to navigate. Took me a while to find all the settings. It's fine, but not amazing.",
    timestamp: '2024-05-18T09:00:00Z',
    analysis: {
      sentiment: 'neutral',
      sentimentScore: 0.2,
      authenticityScore: 0.99,
      isPotentiallyFake: false,
      reason: 'Balanced feedback with both positive and negative points. Language is natural.',
    },
  },
  {
    id: 'fb_004',
    productId: 'prod_004',
    userName: 'Diana Prince',
    userAvatar: 'https://i.pravatar.cc/150?u=diana',
    rating: 5,
    text: "Best running shoes I've ever owned. The Velocity Runners are so light and comfortable. I feel like I'm running on clouds!",
    timestamp: '2024-05-21T11:00:00Z',
    analysis: {
      sentiment: 'positive',
      sentimentScore: 0.98,
      authenticityScore: 0.92,
      isPotentiallyFake: false,
      reason: 'Enthusiastic and positive review. Matches general consensus.',
    },
  },
  {
    id: 'fb_005',
    productId: 'prod_002',
    userName: 'Eva Green',
    userAvatar: 'https://i.pravatar.cc/150?u=eva',
    rating: 5,
    text: 'This product is the best! Truly amazing and a great value. I will buy it again and recommend to all my friends. Fantastic!',
    timestamp: '2024-05-15T18:45:00Z',
    analysis: {
      sentiment: 'positive',
      sentimentScore: 0.9,
      authenticityScore: 0.3,
      isPotentiallyFake: true,
      reason:
        'Review uses overly generic, superlative language ("best", "amazing", "fantastic") without mentioning any specific features. This pattern is common in fake reviews.',
    },
  },
];


export const mockSocialPosts: SocialPost[] = [
    {
      id: 'soc_001',
      productId: 'prod_001',
      platform: 'twitter',
      userName: 'TechieTom',
      userHandle: '@techietom',
      userAvatar: 'https://i.pravatar.cc/150?u=techietom',
      text: "Just got the Aura Smartwatch and I'm blown away by the display quality. The always-on feature is a game-changer! #AuraSmartwatch #Tech",
      likes: 152,
      shares: 34,
      comments: 12,
      timestamp: '2024-05-22T12:00:00Z',
      analysis: {
        sentiment: 'positive',
        sentimentScore: 0.9,
        influenceScore: 0.75,
        isKeyOpinionLeader: false,
        category: 'Product Feedback',
      },
    },
    {
      id: 'soc_002',
      productId: 'prod_004',
      platform: 'instagram',
      userName: 'FitLifeJen',
      userHandle: '@fitlifejen',
      userAvatar: 'https://i.pravatar.cc/150?u=fitlifejen',
      text: "Morning run with my new Velocity Runners. They're so light and supportive! Best running shoes I've had in a while. 🏃‍♀️",
      mediaUrl: 'https://picsum.photos/seed/shoes/1080/1080',
      likes: 1200,
      shares: 0,
      comments: 88,
      timestamp: '2024-05-21T08:00:00Z',
      analysis: {
        sentiment: 'positive',
        sentimentScore: 0.98,
        influenceScore: 0.9,
        isKeyOpinionLeader: true,
        category: 'Product Feedback',
      },
    },
    {
      id: 'soc_003',
      productId: 'prod_002',
      platform: 'tiktok',
      userName: 'MusicManMike',
      userHandle: '@musicmanmike',
      userAvatar: 'https://i.pravatar.cc/150?u=musicman',
      text: 'Unboxing the SonicWave Headphones! The bass is insane. 🤯 #unboxing #headphones',
      mediaUrl: 'https://picsum.photos/seed/headphones/1080/1920',
      likes: 25000,
      shares: 1200,
      comments: 450,
      timestamp: '2024-05-20T18:00:00Z',
      analysis: {
        sentiment: 'positive',
        sentimentScore: 0.85,
        influenceScore: 0.88,
        isKeyOpinionLeader: true,
        category: 'Brand Mention',
      },
    },
     {
      id: 'soc_004',
      productId: 'prod_002',
      platform: 'twitter',
      userName: 'ConcernedConsoomer',
      userHandle: '@consoomer',
      userAvatar: 'https://i.pravatar.cc/150?u=consoomer',
      text: "My SonicWave headphones stopped working after just a month. @BrandPulseSupport what's the deal?",
      likes: 5,
      shares: 2,
      comments: 10,
      timestamp: '2024-05-22T15:00:00Z',
      analysis: {
        sentiment: 'negative',
        sentimentScore: -0.8,
        influenceScore: 0.2,
        isKeyOpinionLeader: false,
        category: 'Customer Support',
      },
    },
    {
      id: 'soc_005',
      productId: 'prod_006',
      platform: 'meta',
      userName: 'BeautyByZoe',
      userHandle: 'ZoeBeauty',
      userAvatar: 'https://i.pravatar.cc/150?u=zoe',
      text: "Loving the new Glow Skincare Set! My skin has never felt so hydrated. Check out my latest reel for the full routine!",
      likes: 5400,
      shares: 230,
      comments: 150,
      timestamp: '2024-05-23T19:00:00Z',
      analysis: {
        sentiment: 'positive',
        sentimentScore: 0.99,
        influenceScore: 0.92,
        isKeyOpinionLeader: true,
        category: 'Brand Mention',
      },
    },
    {
      id: 'soc_006',
      productId: 'prod_005',
      platform: 'google',
      userName: 'David L.',
      userHandle: 'David L.',
      userAvatar: 'https://i.pravatar.cc/150?u=davidl',
      text: 'Great drone for beginners. The AeroGlide is super easy to fly and the camera quality is fantastic for the price. Had a small issue with the initial setup but support was quick to help.',
      likes: 15,
      shares: 0,
      comments: 2,
      timestamp: '2024-05-24T11:00:00Z',
      analysis: {
        sentiment: 'positive',
        sentimentScore: 0.8,
        influenceScore: 0.3,
        isKeyOpinionLeader: false,
        category: 'Product Feedback',
      },
    },
  ];

export const mockLeaderboard: LeaderboardUser[] = [
    { id: 'user_001', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?u=alice', points: 1250 },
    { id: 'user_004', name: 'Diana Prince', avatar: 'https://i.pravatar.cc/150?u=diana', points: 1100 },
    { id: 'user_002', name: 'Bob Williams', avatar: 'https://i.pravatar.cc/150?u=bob', points: 950 },
    { id: 'user_007', name: 'Frank Castle', avatar: 'https://i.pravatar.cc/150?u=frank', points: 800 },
    { id: 'user_003', name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?u=charlie', points: 700 },
    { id: 'user_008', name: 'Grace Hopper', avatar: 'https://i.pravatar.cc/150?u=grace', points: 650 },
    { id: 'user_009', name: 'Heidi Klum', avatar: 'https://i.pravatar.cc/150?u=heidi', points: 500 },
    { id: 'user_010', name: 'Ivan Drago', avatar: 'https://i.pravatar.cc/150?u=ivan', points: 450 },
    { id: 'user_005', name: 'Eva Green', avatar: 'https://i.pravatar.cc/150?u=eva', points: 300 },
    { id: 'user_006', name: 'ConcernedConsoomer', avatar: 'https://i.pravatar.cc/150?u=consoomer', points: 150 },
]

export const mockChallenges: Challenge[] = [
    { id: 'chal_001', title: 'Photo Feedback', description: 'Submit a feedback with a photo for the Aura Smartwatch.', points: 150, progress: 60 },
    { id: 'chal_002', title: 'First Feedback', description: 'Leave your first piece of feedback on any product.', points: 50, progress: 90 },
    { id: 'chal_003', title: 'Video Review', description: 'Submit a video review for the ProCapture Camera.', points: 500, progress: 25 },
]

export const mockRewards: Reward[] = [
    { id: 'rew_001', name: '10% Off Coupon', pointsCost: 1000, stock: 'unlimited' },
    { id: 'rew_002', name: '$25 Gift Card', pointsCost: 2500, stock: 100 },
    { id: 'rew_003', name: 'Free T-Shirt', pointsCost: 3000, stock: 50 },
]

export const mockPayoutRequests: PayoutRequest[] = [
  {
    id: 'pay_001',
    userId: 'user_001',
    userName: 'Alice Johnson',
    userAvatar: 'https://i.pravatar.cc/150?u=alice',
    amount: 10,
    points: 1000,
    status: 'pending',
    requestedAt: '2024-05-23T10:00:00Z',
  },
  {
    id: 'pay_002',
    userId: 'user_004',
    userName: 'Diana Prince',
    userAvatar: 'https://i.pravatar.cc/150?u=diana',
    amount: 10,
    points: 1000,
    status: 'approved',
    requestedAt: '2024-05-22T14:00:00Z',
    processedAt: '2024-05-22T18:00:00Z',
  },
  {
    id: 'pay_003',
    userId: 'user_002',
    userName: 'Bob Williams',
    userAvatar: 'https://i.pravatar.cc/150?u=bob',
    amount: 5,
    points: 500,
    status: 'denied',
    requestedAt: '2024-05-21T11:00:00Z',
    processedAt: '2024-05-21T12:00:00Z',
  },
]
