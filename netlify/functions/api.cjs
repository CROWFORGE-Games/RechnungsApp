let cachedHandler;
const serverless = require("serverless-http");

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const { app, ensureDataFiles } = await import("../../server.js");
  const expressHandler = serverless(app, {
    basePath: "/.netlify/functions"
  });

  cachedHandler = async (event, context) => {
    await ensureDataFiles();
    return expressHandler(event, context);
  };

  return cachedHandler;
}

exports.handler = async (event, context) => {
  const handler = await getHandler();
  return handler(event, context);
};
