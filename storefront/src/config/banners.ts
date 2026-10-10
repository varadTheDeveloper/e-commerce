/**
 * Home page banner photos. Demo pictures from Unsplash (free licence), shown
 * with credits on the /credits page. Replace with the brand's own campaign photos.
 */
export type Banner = {
  url: string
  alt: string | null
  credit: { name: string; profile: string; photo: string }
}

export const BANNERS: Record<"women" | "men" | "festive", Banner> = {
  "women": {
    "url": "https://images.unsplash.com/photo-1612595391900-29390866733a?ixid=M3wxMDk4MzYwfDB8MXxzZWFyY2h8N3x8aW5kaWFuJTIwZmFzaGlvbiUyMG1vZGVsfGVufDF8MXx8fDE3OTE2NTA2OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&crop=faces,entropy&w=1600&h=2000&q=80",
    "alt": "woman in red and white dress holding wheat",
    "credit": {
      "name": "Kuppism",
      "profile": "https://unsplash.com/@kuppism?utm_source=clothing_store_demo&utm_medium=referral",
      "photo": "https://unsplash.com/photos/woman-in-red-and-white-dress-holding-wheat-B8IidBHe2M0?utm_source=clothing_store_demo&utm_medium=referral"
    }
  },
  "men": {
    "url": "https://images.unsplash.com/photo-1727835523545-70ee992b5763?ixid=M3wxMDk4MzYwfDB8MXxzZWFyY2h8MXx8bWFuJTIwZmVzdGl2ZSUyMGt1cnRhfGVufDF8MXx8fDE3OTE2NTA2ODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&crop=faces,entropy&w=1600&h=2000&q=80",
    "alt": "A man standing next to a tree wearing a green shirt",
    "credit": {
      "name": "Firangi Yarn Menswear Brand",
      "profile": "https://unsplash.com/@firangiyarn?utm_source=clothing_store_demo&utm_medium=referral",
      "photo": "https://unsplash.com/photos/a-man-standing-next-to-a-tree-wearing-a-green-shirt-hEuVOYuq1l4?utm_source=clothing_store_demo&utm_medium=referral"
    }
  },
  "festive": {
    "url": "https://images.unsplash.com/photo-1735052712489-f45220126a0c?ixid=M3wxMDk4MzYwfDB8MXxzZWFyY2h8NXx8aW5kaWFuJTIwd2VkZGluZyUyMG91dGZpdHxlbnwxfDF8fHwxNzkxNjUwNjk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&crop=faces,entropy&w=1600&h=2000&q=80",
    "alt": "A bride and groom walking down a path",
    "credit": {
      "name": "iKshana Productions",
      "profile": "https://unsplash.com/@ikshanaproductions?utm_source=clothing_store_demo&utm_medium=referral",
      "photo": "https://unsplash.com/photos/a-bride-and-groom-walking-down-a-path-2oQy4GAGxbk?utm_source=clothing_store_demo&utm_medium=referral"
    }
  }
}
