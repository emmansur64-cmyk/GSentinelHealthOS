import { z } from "zod";

import { HttpError } from "../lib/http-error.js";

export function validate(schema) {
  return (req, _, next) => {
    const payload = {
      body: req.body,
      params: req.params,
      query: req.query,
    };

    const result = schema.safeParse(payload);
    if (!result.success) {
      const details = result.error.errors.map((item) => ({
        path: item.path.join("."),
        message: item.message,
      }));
      next(new HttpError(400, "Validation error", details));
      return;
    }

    req.validated = result.data;
    next();
  };
}

export const zod = z;
