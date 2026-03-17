import { connectLambda } from "@netlify/blobs";
import serverless from "serverless-http";

import { app, ensureDataFiles } from "../../server.js";

const expressHandler = serverless(app, {
  basePath: "/.netlify/functions"
});

export const handler = async (event, context) => {
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
