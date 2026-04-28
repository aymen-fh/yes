import { ValidationError } from "../utils/errors.js";

const getMessageFromIssues = (issues = []) => {
  if (!issues.length) return "Invalid request payload";

  return issues
    .map((issue) => {
      const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join(", ");
};

const setValidatedData = (req, key, value) => {
  if (!req.validated) {
    req.validated = {};
  }

  req.validated[key] = value;
};

const replaceObjectValues = (target, source) => {
  if (!target || typeof target !== "object") {
    return false;
  }

  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, source);
  return true;
};

export const validateRequest = ({ body, params, query } = {}) => (req, _res, next) => {
  if (body) {
    const result = body.safeParse(req.body);
    if (!result.success) return next(new ValidationError(getMessageFromIssues(result.error?.issues)));
    setValidatedData(req, "body", result.data);
    req.body = result.data;
  }

  if (params) {
    const result = params.safeParse(req.params);
    if (!result.success) return next(new ValidationError(getMessageFromIssues(result.error?.issues)));
    setValidatedData(req, "params", result.data);
    req.params = result.data;
  }

  if (query) {
    const result = query.safeParse(req.query);
    if (!result.success) return next(new ValidationError(getMessageFromIssues(result.error?.issues)));
    setValidatedData(req, "query", result.data);

    // Express 5 exposes req.query through a getter, so mutate the object instead
    // of assigning a new reference.
    if (!replaceObjectValues(req.query, result.data)) {
      req.validatedQuery = result.data;
    }
  }

  return next();
};
