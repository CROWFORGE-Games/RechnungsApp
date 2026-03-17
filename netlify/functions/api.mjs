import { connectLambda } from "@netlify/blobs";
import serverless from "serverless-http";

import { app, ensureDataFiles } from "../../server.js";

const expressHandler = serverless(app);

export const handler = async (event, context) => {
  connectLambda(event);
  await ensureDataFiles();
  return expressHandler(event, context);
};
