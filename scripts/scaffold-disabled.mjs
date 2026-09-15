console.error(
  `LINA Check scaffold: ${process.argv[2] ?? "operation"} is disabled. See README.md before configuring or enabling automation.`,
);
process.exitCode = 1;
