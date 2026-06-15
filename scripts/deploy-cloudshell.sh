#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export AWS_REGION="${AWS_REGION:-us-east-2}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

PNPM_VERSION="${PNPM_VERSION:-10.12.1}"
PNPM="npx --yes pnpm@${PNPM_VERSION}"
STACK_NAME="${STACK_NAME:-ExpenseTrackerStack}"
RUN_GATES="${RUN_GATES:-1}"
APP_CMD="$PNPM --filter @expense-tracker/infra exec tsx src/index.ts"
OUTPUTS_FILE="${OUTPUTS_FILE:-cdk-outputs.json}"
DEPLOY_LOG="${DEPLOY_LOG:-cdk-deploy.log}"

if ! aws sts get-caller-identity >/dev/null; then
  echo "AWS credentials are not available in this shell. Open AWS CloudShell or configure AWS CLI first." >&2
  exit 1
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  export JWT_SECRET="$(openssl rand -hex 32)"
  echo "JWT_SECRET was not set; generated an ephemeral deploy secret for this CloudShell session."
fi

corepack enable >/dev/null 2>&1 || true
$PNPM --version
$PNPM install --frozen-lockfile

if [[ "$RUN_GATES" == "1" ]]; then
  $PNPM test
  $PNPM run typecheck
  $PNPM run lint
  $PNPM run build
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
$PNPM --filter @expense-tracker/infra exec cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}" --app "$APP_CMD"

$PNPM --filter @expense-tracker/infra exec cdk deploy "$STACK_NAME" \
  --require-approval never \
  --app "$APP_CMD" \
  --outputs-file "$OUTPUTS_FILE" | tee "$DEPLOY_LOG"

read_output() {
  local key="$1"
  node -e '
const fs = require("node:fs");
const key = process.argv[1];
const file = process.argv[2];
const stackName = process.argv[3];
if (fs.existsSync(file)) {
  const outputs = JSON.parse(fs.readFileSync(file, 'utf8'))[stackName];
  if (outputs && outputs[key]) {
    console.log(outputs[key]);
    process.exit(0);
  }
}
process.exit(1);
' "$key" "$OUTPUTS_FILE" "$STACK_NAME" 2>/dev/null || awk -v key="${STACK_NAME}.${key}" '$1 == key && $2 == "=" { print $3 }' "$DEPLOY_LOG" | tail -1
}

read_stack_output() {
  local key="$1"
  local value

  value="$(read_output "$key")"
  if [[ -n "$value" ]]; then
    echo "$value"
    return
  fi

  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}

API_URL="$(read_stack_output ApiUrl)"
WEB_BUCKET="$(read_stack_output WebBucketName)"
DIST_ID="$(read_stack_output DistributionId)"
WEB_URL="$(read_stack_output WebUrl)"

if [[ -z "$API_URL" || -z "$WEB_BUCKET" || -z "$DIST_ID" || -z "$WEB_URL" ]]; then
  echo "Unable to resolve CDK outputs. Check $OUTPUTS_FILE or $DEPLOY_LOG." >&2
  exit 1
fi

VITE_API_BASE_URL="$API_URL" $PNPM --filter @expense-tracker/web build
aws s3 sync apps/web/dist "s3://${WEB_BUCKET}" --delete
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)"

echo "DEPLOY_DONE"
echo "API_URL=$API_URL"
echo "WEB_URL=$WEB_URL"
echo "INVALIDATION_ID=$INVALIDATION_ID"
