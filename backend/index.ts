import "dotenv/config";
import { createServer } from "./server";

const PORT = process.env.PORT || 5505;

const app = createServer();

app.listen(PORT, () => {
  console.log(`Nexus CRM backend running on port ${PORT}`);
});
