import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL ??= "postgresql://carecadence:carecadence@127.0.0.1:5432/carecadence_test";
process.env.AUTH_SECRET ??= "test-only-secret-that-is-at-least-thirty-two-characters";
