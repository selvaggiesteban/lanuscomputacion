import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.string().optional(),
    heroImage: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { blog };