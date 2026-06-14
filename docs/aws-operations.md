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
5. Confirm the active region before deploying. Default target for this project is `us-east-1` unless deployment notes say otherwise.

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
Default region name: us-east-1
Default output format: json
```

Then export the profile for this shell:

```bash
export AWS_PROFILE=extropy-expense-tracker
export AWS_REGION=us-east-1
aws sts get-caller-identity
```

## CDK Bootstrap And Deploy

Bootstrap once per account/region:

```bash
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
pnpm --filter @expense-tracker/infra exec cdk deploy \
  --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
```

After deploy, record the emitted outputs locally:

- `ApiUrl`
- `WebBucketName`
- `WebUrl`

Do not commit account-specific output values unless they are intended for the public submission README.

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
