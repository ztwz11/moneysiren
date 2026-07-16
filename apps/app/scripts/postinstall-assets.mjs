export function createAssetInstallPlan({ allowUnsignedHud = false } = {}) {
  return {
    primary: [
      "install",
      "--all",
      ...(allowUnsignedHud ? ["--allow-unsigned-hud"] : []),
    ],
    fallback: [
      ["install", "--web"],
      ["install", "--all", "--profile-only"],
    ],
  };
}

export function executeAssetInstallPlan(plan, runInstall) {
  const attempts = [];
  const run = (args) => {
    attempts.push([...args]);
    return runInstall(args);
  };

  if (run(plan.primary)) {
    return {
      attempts,
      complete: true,
      fallbackComplete: false,
    };
  }

  const fallbackComplete = plan.fallback.every((args) => run(args));

  return {
    attempts,
    complete: false,
    fallbackComplete,
  };
}
