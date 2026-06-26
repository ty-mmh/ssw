// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/infra/cdk/cdk.out/'],
  modulePathIgnorePatterns: ['<rootDir>/infra/cdk/cdk.out/'],
}
