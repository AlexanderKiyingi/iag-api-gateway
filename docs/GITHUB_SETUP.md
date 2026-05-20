# Publish `iag-api-gateway` to GitHub

The repository is initialized locally at `../iag-api-gateway` with commit history. Create the remote and push:

## 1. Create an empty repository on GitHub

- Name: `iag-api-gateway`
- Do **not** add a README, `.gitignore`, or license (already present locally)

Use your org (e.g. `AlexanderKiyingi` or `alvor-technologies`), consistent with other `iag-*` repos.

## 2. Add remote and push

```bash
cd ../iag-api-gateway
git remote add origin https://github.com/<org>/iag-api-gateway.git
git push -u origin main
```

## 3. Meta-repo submodule (optional)

After the remote exists:

```bash
cd IAG_multi_backend
git submodule add https://github.com/<org>/iag-api-gateway.git shared/services/api-gateway
```

Update `subrepos.json` `remote` if the org differs from `AlexanderKiyingi`.

## 4. CI

GitHub Actions workflow is in `.github/workflows/ci.yml` (build, typecheck, test, Docker build on push/PR).
