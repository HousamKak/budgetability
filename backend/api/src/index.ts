import { createApp } from "./app";
import { assertConfig, config } from "./config";
import { getDb } from "./db";

assertConfig();
getDb(); // open + migrate on boot so schema errors fail fast

const app = createApp();
app.listen(config.port, () => {
  console.log(`Budgetability API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
});
