export const SCHEMA_VERSION = 1;
export const PRODUCTION_BRANCH = "main";
export const RELEASE_PROFILE = "mengkai";
export const BUILD_WORKFLOW_NAME = "Release artifact";
export const BUILD_WORKFLOW_FILE = ".github/workflows/release-build.yml";
export const VERSION_FILE = "package.json";
export const RELEASE_MODE = process.env.RELEASE_MODE || "shadow";

export const ALLOWED_ROOTS = ["public", "src", "package.json", "package-lock.json"];

export const STATES = {
  received: "received",
  waiting_ci: "waiting_ci",
  artifact_ready: "artifact_ready",
  pending_approval: "pending_approval",
  approved: "approved",
  deploy_queued: "deploy_queued",
  deploying: "deploying",
  verifying: "verifying",
  succeeded: "succeeded",
  failed: "failed",
  rolled_back: "rolled_back",
  recovery_required: "recovery_required",
  superseded: "superseded",
  dismissed: "dismissed"
};

export const TRANSITIONS = {
  received: ["waiting_ci", "failed"],
  waiting_ci: ["artifact_ready", "failed"],
  artifact_ready: ["pending_approval", "failed"],
  pending_approval: ["approved", "dismissed", "superseded"],
  approved: ["deploy_queued", "pending_approval"],
  deploy_queued: ["deploying", "failed"],
  deploying: ["verifying", "failed", "recovery_required"],
  verifying: ["succeeded", "failed", "rolled_back", "recovery_required"],
  succeeded: [],
  failed: [],
  rolled_back: [],
  recovery_required: [],
  superseded: [],
  dismissed: []
};
