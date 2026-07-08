process.env.NODE_ENV ??= "test";
process.env.PORT ??= "5000";
process.env.CLIENT_URL ??= "http://localhost:5173";
process.env.MONGO_URI ??= "mongodb://localhost:27017/alpine-chat";
process.env.JWT_SECRET ??= "1234567890abcdef";

await import("../backend/utils/config.js");
await import("../backend/middleWare/errorHandler.js");
await import("../backend/middleWare/validateRequest.js");
await import("../backend/validation/requestValidators.js");
await import("../backend/controllers/auth.controller.js");
await import("../backend/controllers/message.controller.js");
await import("../backend/controllers/user.controller.js");
await import("../backend/routes/auth.routes.js");
await import("../backend/routes/message.routes.js");
await import("../backend/routes/user.routes.js");

console.log("Backend module imports passed.");

