# AWS Cost Guard

This project must not be deployed to AWS until the user explicitly approves it.

## Budget Notification

The CDK stack can create a monthly AWS Budget when an email address is supplied
as context:

```sh
npm --prefix infra/cdk run synth -- -c budgetNotificationEmail=you@example.com
```

The default budget amount is USD 5 per month. Override it with:

```sh
npm --prefix infra/cdk run synth -- -c budgetNotificationEmail=you@example.com -c budgetAmountUsd=10
```

If no email is supplied, the template still synthesizes and emits a reminder
output instead of storing a personal email address in source control.

## Manual Checks Before Deployment

- Confirm the AWS account, region, and stage name.
- Confirm the Budget email subscription after AWS sends the confirmation email.
- Confirm Cloudflare DNS remains the default DNS plan unless the user explicitly
  approves a DNS change.
- Confirm S3 Lifecycle and DynamoDB TTL exist in the synthesized template.
- Do not run `cdk deploy`, change DNS, or stop the Raspberry Pi service without
  explicit user approval.
