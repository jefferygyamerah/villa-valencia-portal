module.exports = {
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/frontend/**/*.test.js'],
    },
    {
      displayName: 'apps-script',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/apps-script/**/*.test.js'],
    },
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    'apps-script/**/*.gs',
  ],
};
