let cachedHandler;

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const [{ connectLambda }, serverlessModule, serverModule] = await Promise.all([
    import("@netlify/blobs"),
    import("serverless-http"),
    import("../../server.js")
  ]);

  const serverless = serverlessModule.default || serverlessModule;
  const { app, ensureDataFiles } = serverModule;
  const expressHandler = serverless(app, {
    basePath: "/.netlify/functions"
  });

  cachedHandler = async (event, context) => {
    if (event?.blobs) {
      try {
        connectLambda(event);
      } catch (error) {
        console.error("Netlify Blobs Lambda-Kontext konnte nicht verbunden werden.", error);
      }
    }

    await ensureDataFiles();
    return expressHandler(event, context);
  };

  return cachedHandler;
}

exports.handler = async (event, context) => {
  const handler = await getHandler();
  return handler(event, context);
};
