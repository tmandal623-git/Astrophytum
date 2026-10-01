# legacy-api (not deployed)

Older per-route serverless handlers that duplicated a subset of `api/server.js`.
They had **no authentication or admin checks**, and any file inside `api/` becomes a
public endpoint on Vercel — so they were moved here to keep them off the live site.

`api/server.js` serves every route the app uses. Nothing imports these files;
delete this folder once you no longer need it for reference.
