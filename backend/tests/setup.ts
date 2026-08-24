import "dotenv/config";

beforeAll(async () => {
  // Setup test environment variables
  process.env.DB_DIALECT = "sqlite";
  process.env.DB_STORAGE = "./test.sqlite";
});

afterAll(async () => {
  // Teardown
});
