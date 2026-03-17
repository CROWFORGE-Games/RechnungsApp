import { connectLambda } from "@netlify/blobs";
import serverless from "serverless-http";

import { app, ensureDataFiles } from "../../server.js";

const expressHandler = serverless(app, {
  basePath: "/.netlify/functions/api"
});

export const handler = async (event, context) => {
  connectLambda(event);
  await ensureDataFiles();
  return expressHandler(event, context);
};
