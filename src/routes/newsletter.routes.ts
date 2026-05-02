import { Router } from 'express';
import { body } from 'express-validator';
import { subscribe, unsubscribe } from '../controllers/newsletter.controller';
import { validate } from '../middleware/validate.middleware';

/** Gmail +tags stay distinct — same rule as auth. */
const normalizeEmailOpts = { gmail_remove_subaddress: false };

const router = Router();

router.post(
  '/subscribe',
  [
    body('email').isEmail().normalizeEmail(normalizeEmailOpts).withMessage('Valid email is required.'),
    body('source').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  ],
  validate,
  subscribe
);

router.get('/unsubscribe', unsubscribe);

export default router;
