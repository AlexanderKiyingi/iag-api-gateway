# Publish `iag-api-gateway` to GitHub

**Live repo:** https://github.com/AlexanderKiyingi/iag-api-gateway

## First-time publish (new machine)

```powershell
gh auth login
cd path/to/iag-api-gateway
.\scripts\publish.ps1
```

Or manually:

```bash
gh repo create AlexanderKiyingi/iag-api-gateway --public --source . --remote origin --push
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
