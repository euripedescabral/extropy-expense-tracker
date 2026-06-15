# AWS Operations

Use this runbook for AWS account access and CLI usage. Do not commit AWS credentials, account IDs, MFA recovery codes, billing details, or `.env` files.

## Account Login

1. Open the AWS console:

   ```text
   https://console.aws.amazon.com/
   ```

2. Sign in with the account email used during AWS Free Tier signup.
3. Complete MFA or email/phone verification when prompted.
4. Prefer creating an IAM Identity Center or IAM admin user after the root account is active. Use the root user only for account-level billing/security actions.
5. Confirm the active region before deploying. Default target for this project is `us-east-2`.

## CLI Setup

Install and verify the AWS CLI:

```bash
aws --version
aws sts get-caller-identity
```

If `aws sts get-caller-identity` fails because credentials are missing or expired, configure a named profile:

```bash
aws configure --profile extropy-expense-tracker
```

Use these values when prompted:

```text
AWS Access Key ID: <from IAM user/access portal>
AWS Secret Access Key: <from IAM user/access portal>
Default region name: us-east-2
Default output format: json
```

Then export the profile for this shell:

```bash
export AWS_PROFILE=extropy-expense-tracker
export AWS_REGION=us-east-2
aws sts get-caller-identity
```

If the local machine has an old default AWS profile and `aws sts get-caller-identity` returns `ExpiredToken`, do not run CDK locally until credentials are refreshed. Either run `aws configure --profile extropy-expense-tracker` with valid IAM credentials, or use AWS CloudShell from the signed-in console as described below.

## CDK Bootstrap And Deploy

Bootstrap once per account/region:

```bash
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
export JWT_SECRET="<long-random-secret>"

pnpm --filter @expense-tracker/infra exec cdk bootstrap \
  --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
```

Synthesize before deploy:

```bash
pnpm --filter @expense-tracker/infra exec cdk synth \
  --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
```

Deploy:

```bash
export JWT_SECRET="<same-long-random-secret>"
pnpm --filter @expense-tracker/infra exec cdk deploy \
  ExpenseTrackerStack \
  --require-approval never \
  --outputs-file cdk-outputs.json \
  --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
```

After deploy, record the emitted outputs locally:

- `ApiUrl`
- `WebBucketName`
- `DistributionId`
- `WebUrl`

Do not commit account-specific output values unless they are intended for the public submission README.

## CloudShell CDK Deploy Fallback

Use this when the AWS console is logged in but local AWS CLI credentials are expired or unavailable.

Why this approach:

- The deployment still uses the project CDK app and `cdk bootstrap` / `cdk deploy`; CloudShell only supplies valid AWS credentials from the signed-in account.
- It avoids committing or copying AWS access keys into the repo or local shell.
- It bypasses unrelated local profile issues such as `ExpiredToken` from an old default AWS profile.
- It keeps the deploy reproducible because the same pnpm gates, CDK commands, frontend build, S3 sync, CloudFront invalidation, and smoke test are documented below.

Create an archive from the repository root:

```bash
rm -f /tmp/extropy-expense-tracker.zip
zip -qr /tmp/extropy-expense-tracker.zip . \
  -x 'node_modules/*' '*/node_modules/*' '.git/*' \
  'apps/web/dist/*' 'apps/web/test-results/*' \
  'apps/web/playwright-report/*' 'infra/cdk.out/*'
```

Upload the archive in AWS Console:

1. Open the AWS Console in `us-east-2`.
2. Open CloudShell.
3. Select `Actions` -> `Upload file`.
4. Upload the archive. If CloudShell refuses to overwrite an existing file, use a unique filename such as `extropy-expense-tracker-deploy.zip`.

Run the reusable repo deploy script in CloudShell. This is the preferred path for every uploaded zip:

```bash
set -euo pipefail
rm -rf extropy-expense-tracker-deploy
unzip -qo extropy-expense-tracker-deploy.zip -d extropy-expense-tracker-deploy
cd extropy-expense-tracker-deploy

export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

bash scripts/deploy-cloudshell.sh
```

If you need a faster repeat deploy after gates already passed locally, run:

```bash
RUN_GATES=0 bash scripts/deploy-cloudshell.sh
```

The script installs with the repo-pinned pnpm version, optionally runs gates, deploys CDK, builds the frontend with the emitted API URL, syncs S3, creates a CloudFront invalidation, and prints the live URLs.

Manual equivalent, kept for debugging:

```bash
set -euo pipefail
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2

rm -rf extropy-expense-tracker-deploy
unzip -qo extropy-expense-tracker-deploy.zip -d extropy-expense-tracker-deploy
cd extropy-expense-tracker-deploy

aws sts get-caller-identity
PNPM="npx --yes pnpm@10.12.1"
$PNPM --version

$PNPM install --frozen-lockfile

$PNPM test
$PNPM run typecheck
$PNPM run lint
$PNPM run build

export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
APP_CMD='pnpm --filter @expense-tracker/infra exec tsx src/index.ts'
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

$PNPM --filter @expense-tracker/infra exec cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION" --app "$APP_CMD"
$PNPM --filter @expense-tracker/infra exec cdk deploy ExpenseTrackerStack \
  --require-approval never \
  --app "$APP_CMD" \
  --outputs-file cdk-outputs.json

API_URL=$(node -pe "require('./cdk-outputs.json').ExpenseTrackerStack.ApiUrl")
WEB_BUCKET=$(node -pe "require('./cdk-outputs.json').ExpenseTrackerStack.WebBucketName")
DIST_ID=$(node -pe "require('./cdk-outputs.json').ExpenseTrackerStack.DistributionId")
WEB_URL=$(node -pe "require('./cdk-outputs.json').ExpenseTrackerStack.WebUrl")

VITE_API_BASE_URL="$API_URL" $PNPM --filter @expense-tracker/web build
aws s3 sync apps/web/dist "s3://$WEB_BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "API URL: $API_URL"
echo "Web URL: $WEB_URL"
```

Smoke-test signup after deploy:

```bash
SMOKE_EMAIL="smoke+$(date +%s)@example.com"
curl -sS -X POST "$API_URL/auth/signup" \
  -H "content-type: application/json" \
  --data "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"CorrectHorse123!\"}"
```

## Reusable Smoke Login

The deployed DynamoDB table contains this reusable UI smoke-test account:

```text
Email: ui-smoke+1781469775216@example.com
Password: CorrectHorse123!
```

Use it only for validating the live take-home app. Do not reuse this password for real accounts.

## Frontend Deploy

Build the web app with the deployed API URL:

```bash
VITE_API_BASE_URL="<ApiUrl>" pnpm --filter @expense-tracker/web build
```

Upload the built frontend to the emitted S3 bucket:

```bash
aws s3 sync apps/web/dist "s3://<WebBucketName>" --delete
```

If CloudFront caches stale assets, create an invalidation:

```bash
aws cloudfront create-invalidation \
  --distribution-id "<DistributionId>" \
  --paths "/*"
```

## Safety Checklist

- Root account has MFA enabled.
- No AWS keys are committed.
- `.env`, `.env.local`, and AWS credential files remain ignored.
- `aws sts get-caller-identity` returns the expected account before `cdk deploy`.
- Billing alerts or AWS Budgets are configured after account setup.
