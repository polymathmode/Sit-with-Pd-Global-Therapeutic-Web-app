import { Router } from 'express';
import { getPublishedBlogPosts, getBlogPostBySlug } from '../controllers/blog.controller';

const router = Router();

router.get('/', getPublishedBlogPosts);
router.get('/:slug', getBlogPostBySlug);

export default router;
