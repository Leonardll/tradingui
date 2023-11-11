module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: [
      "**/*.{js,jsx,tsx}", // Adjust the file extensions according to your project
      "!**/node_modules/**",
      "!**/vendor/**"
    ],
    coverageReporters: ["text", "lcov", "cobertura"],
  
}
