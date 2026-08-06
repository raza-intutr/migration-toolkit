import { AppError } from '../utils/AppError.js';

// Generic zod-schema validator.
// Usage: router.post('/', validate(createUserSchema), controller.create)
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // zod v4 exposes errors under `.issues` (zod v3 used `.errors`).
    const message = (result.error.issues ?? []).map((e) => e.message).join(', ');
    return next(new AppError(message, 400));
  }

  req.body = result.data; // parsed/typed data
  next();
};
