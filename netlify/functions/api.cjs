let cachedHandler;

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const [serverlessModule, serverModule] = await Promise.all([
    import("serverless-http"),
    import("../../server.js")
  ]);

  const serverless = serverlessModule.default || serverlessModule;
  const { app, ensureDataFiles } = serverModule;
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
