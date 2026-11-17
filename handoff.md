# Handoff: Ngā Manu

Written 17 Nov 2026 to continue this work on another machine.
This repo is **public**, so this file has technical notes only.

## What the project is

A bilingual (te reo Māori / English) explorer of New Zealand birds, built with Astro from Te Papa's Collections API at build time.

- **Live:** https://d1i8sobfjs2rkj.cloudfront.net
- **GitHub:** github.com/marta-machura/nga-manu
- **API client:** `src/lib/tepapa.ts`. Responses are validated with Zod, so a change in the API shape fails the build loudly.
- **Te reo:** Māori names are marked with `lang="mi"`. The site is not fully localised.

### API gotchas
- Filters only work on `POST /collection/search`.
- `size=1000` returns a 500.
- Bird records have the type `"Specimen"`.

## Infrastructure: `infra/site.yml` (CloudFormation)

The stack is called `nga-manu` and lives in ap-southeast-2.

| Part | Job |
|---|---|
| S3 bucket (private) | Holds the built site files |
| CloudFront + OAC | Serves the site; OAC is the only key to the bucket |
| CloudFront Function | Rewrites folder URLs (`/manu/123/`) to `index.html`. It's needed because S3's REST API only returns exact keys, and `DefaultRootObject` only covers `/` |
| GitHub OIDC provider + DeployRole | Lets CI deploy with no stored AWS keys. The trust policy only allows `ref:refs/heads/main`; permissions are least privilege |

- **CloudFormation builds the infrastructure.** CI does *not* update the stack; it only uploads files and clears the cache.
- **Teardown:** empty the bucket, then run `aws cloudformation delete-stack --stack-name nga-manu`.

## CI: `.github/workflows/ci.yml`

**Triggers:** push to main, PRs, nightly at 14:00 UTC (3am NZDT), and manual dispatch.

**Jobs:**
- `build`: type-check and build.
- `lint-infra`: cfn-lint.
- `lint-workflows`: actionlint.
- `deploy`: main only, via OIDC.

**Caching:** `_astro/*` is immutable for a year; pages get `max-age=0`.

## Work done 13–16 Nov 2026

1. **PR #1, deploy-order fix (race condition).** The old deploy deleted old hashed assets before the new pages were live, so visitors could get pages pointing at missing files. The new order:
   1. Sync new `_astro` assets, without `--delete`.
   2. Sync pages.
   3. Invalidate CloudFront.
   4. Remove old assets, with `--delete`.
2. **PR #2, missing `fi`.** The cleanup step's `if` block wasn't closed. Bash exited with code 2, but only after the merge, because deploy only runs on main.
3. **PR #3, `lint-workflows` job.** It adds actionlint so shell errors in workflow steps are caught on the PR.

All three are merged, and CI and deploy are green.

## Next steps / ideas

- [ ] **Pin actionlint.** The job currently downloads via the main-branch download script; pin it to a release version.
- [ ] **Clean up local branches.** Run `git checkout main && git pull`, then delete the merged `fix/*` and `ci/*` branches.
- [ ] **Add a React search island.**
- [ ] **Possibly add a backend later.** Sketched but not built:
  - CloudFront `/api/*` behaviour, routing to API Gateway + Lambda;
  - PostgreSQL on RDS in a private subnet;
  - Secrets Manager for credentials;
  - code in `api/`, migrations in `db/migrations/`, a monorepo with CI path filters;
  - example feature: logging bird sightings.
- [ ] **Stop using root in the AWS CLI.** It's logged in as root; switch to an IAM Identity Center admin user.
