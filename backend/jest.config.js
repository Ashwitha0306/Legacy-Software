module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/uploads/'],
  modulePathIgnorePatterns: ['<rootDir>/uploads/'],
  watchPathIgnorePatterns: ['<rootDir>/uploads/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/uploads/'],
  passWithNoTests: true,
};
