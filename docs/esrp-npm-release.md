# Releasing `azure-pipelines-task-lib` to npm via ESRP

This package is published to [npmjs.org](https://www.npmjs.com/package/azure-pipelines-task-lib)
by the **ESRP Release** (`EsrpRelease`) task, **not** by `npm publish`.

- **CI / PR builds** (`azure-pipelines.yml`) only build and test the package.
  They no longer publish anything.
- **Releases** run the dedicated pipeline **`azure-pipelines-release.yml`**, which
  builds, tests, packs a `.tgz`, and hands it to ESRP for publication.

## How it works

```
Build stage        Package stage             PublishToNpmViaESRP stage
-----------        -------------             -------------------------
npm ci             download build-output     download npm-packages
npm run build  ->  npm pack (.tgz)       ->  verify >= 1 .tgz
npm test           publish 'npm-packages'    EsrpRelease@12  ->  npmjs.org
publish _build     artifact
```

Key facts about ESRP:

- **ESRP only publishes pre-built `.tgz` files.** It does **not** run `npm pack`.
  This pipeline runs `npm pack` in the Package stage and gives ESRP a folder of
  `.tgz` files (`contentsource: Folder` + `folderlocation`).
- **npm publication is performed by the ESRP Release task**, which adds signing,
  provenance, and an approval/notification workflow on top of the npm publish.
- **The npm dist-tag is inferred from `publishConfig.tag`** in `package.json`.
  When it is not set (as today), ESRP publishes under `latest`. `EsrpRelease@12`
  can also pin the tag explicitly via the `productstate` input.

## Network constraints (no public registry access)

The build agents **cannot reach the public npm registry** (`registry.npmjs.org`).
The pipeline is designed around this:

- `npm ci`, `npm pack`, and the idempotency lookup all go through the **internal
  ADO feed** configured in the repo `.npmrc`
  (`pkgs.dev.azure.com/mseng/PipelineTools/.../PipelineTools_PublicPackages`),
  authenticated with `NpmAuthenticate@0`. Nothing on the agent calls npmjs.
- The **actual publish to npmjs.org is performed by ESRP**, out-of-band through
  the ESRP service — not by the agent. That is why the agent never needs public
  registry access.

## Running a release

1. Go to Pipelines → run **`azure-pipelines-release.yml`** manually.
2. Optionally tick **Dry run** to build + pack only and skip the ESRP publish
   (useful to validate a release candidate).
3. Approve the ESRP notification/approval request when prompted (owners/approvers
   below receive it).

## Required variables

Create a variable group named **`esrp-npm-release`** (Pipelines → Library) with the
following. None of these are secrets — they are resource identifiers — but keeping
them in a group lets you rotate/override without editing the pipeline.

| Variable | Description | Example |
| --- | --- | --- |
| `EsrpServiceConnection` | Name of the Azure Resource Manager service connection (Workload Identity Federation / OIDC) used to authenticate to Azure/Key Vault. | `TaskLib_ESRP_Release` |
| `EsrpKeyVault` | Key Vault that holds the ESRP signing (TSS) certificate. | `tasklib-release-akv` |
| `EsrpSignCert` | Name of the signing certificate in that Key Vault. | `TaskLib-ESRP-CERT` |
| `EsrpClientId` | Client (app) id of the identity **registered and approved** with ESRP as the publisher. Must be the same identity the service connection federates to, and it must have `Key Vault Certificate User` on `EsrpKeyVault`. | `00000000-0000-0000-0000-000000000000` |
| `EsrpOwners` | **Comma-separated** notification owner emails. Prefer a team DL/security group. | `my-team@microsoft.com` |
| `EsrpApprovers` | **Comma-separated** notification approver emails. | `my-team@microsoft.com` |

> ⚠️ **Owners/Approvers are split on `,` (comma), not `;`.** A semicolon is treated
> as part of a single address and rejected as an invalid email.

The following non-secret constants are set inline in `azure-pipelines-release.yml`
with defaults for public-npm (OSS) publishing. Override them in the variable group
only if your ESRP onboarding differs:

| Variable | Default | Meaning |
| --- | --- | --- |
| `EsrpMainPublisher` | `ESRPRELPACMAN` | ESRP OSS publisher used for public npm. |
| `EsrpServiceEndpointUrl` | `https://api.esrp.microsoft.com` | ESRP API endpoint. |
| `EsrpDomainTenantId` | `975f013f-7f24-47e8-a7d3-abc4752bf346` | Tenant of the `ESRPRELPACMAN` OSS publisher. |

## Service connection prerequisites

1. An **Azure Resource Manager service connection** configured with **Workload
   Identity Federation (OIDC)** — no secrets stored in ADO.
2. The managed identity / app backing that connection must:
   - be **registered and approved** as your ESRP **publisher** identity, and
   - have **`Key Vault Certificate User`** on the Key Vault (`EsrpKeyVault`) that
     holds the ESRP signing certificate.

**Why a signing cert + Key Vault are still required even with WIF:** the service
connection (WIF) handles *authentication* to Azure/Key Vault. ESRP *additionally*
requires the release request payload itself to be cryptographically signed by a
registered publisher certificate (the TSS cert). That is a non-negotiable ESRP
requirement, independent of how the pipeline authenticates. The cert lives in Key
Vault so it can be rotated without touching the service connection.

## ESRP onboarding checklist

- [ ] Install the **"ESRP Release"** Azure DevOps extension in the project
      (request via `esrprelpm@microsoft.com` if it is not already installed).
- [ ] Onboard/register an ESRP **publisher** identity and get it **Approved**
      (ESRP Portal → Onboarding → Release = Approved).
- [ ] Create the Key Vault and import the ESRP **signing certificate**; grant the
      publisher identity **`Key Vault Certificate User`**.
- [ ] Create the **WIF Azure RM service connection** federated to that identity.
- [ ] Confirm `azure-pipelines-task-lib` is on ESRP's npm **publisher allow-list**
      (the identity must have publish rights for the package/scope on npmjs).
- [ ] Create the **`esrp-npm-release`** variable group with the values above.
- [ ] Do a **Dry run** first, then a real release.

> **Publisher allow-list:** ESRP only has publish rights for a fixed set of npm
> packages/scopes tied to the publisher. If `azure-pipelines-task-lib` is not yet
> covered, publishing fails until ESRP is configured for it (contact
> `esrprelpm@microsoft.com`).

## Troubleshooting

**403 Forbidden from npm during ESRP publish**
- The version already exists — npm rejects republishing an existing version.
  The pipeline guards against this: an "idempotent" step checks the **internal
  ADO feed** first (the agent cannot reach public npmjs) and **skips ESRP when
  `name@version` is already available**, so a re-run is a no-op. To publish new
  content, bump `version` in `node/package.json`.
- The ESRP publisher is not a **collaborator/owner** of `azure-pipelines-task-lib`
  on npmjs, or the package/scope is not on ESRP's publisher allow-list. Ask the
  ESRP team to add the publisher as an npm owner/collaborator for the package.

**2FA / OTP required**
- With ESRP you must **not** use a personal npm token or 2FA. Publishing is done
  by ESRP's automation identity. If you see a 2FA/OTP prompt, the release is
  (incorrectly) going through an interactive `npm publish` path instead of ESRP —
  make sure you are running `azure-pipelines-release.yml`, not the old CI publish.

**Missing collaborator / "you do not have permission to publish"**
- The ESRP publisher identity lacks publish rights for this package. This is an
  ESRP-side npm permission; open a request with `esrprelpm@microsoft.com` to grant
  the ESRP OSS publisher access to `azure-pipelines-task-lib`.

**No `.tgz` files found / release fails before ESRP**
- The Package stage did not produce a tarball. Check the `npm pack` step logs.
  The pipeline intentionally **fails fast** (see the "Verify at least one .tgz
  exists" and "Verify packages exist before ESRP" steps) rather than submit an
  empty ESRP request.
- `package.json` is marked **`"private": true`** — the "Validate package.json is
  publishable" step blocks this. Remove `private` to publish.

**Auth / cert / Key Vault errors from the ESRP task**
- Verify `EsrpClientId` is the **approved publisher** app (not just the app backing
  the service connection), that it has `Key Vault Certificate User` on
  `EsrpKeyVault`, and that `EsrpSignCert` / `EsrpDomainTenantId` are correct.
- A known ESRP smoke-test is to submit with `contenttype: 'Maven'` instead of
  `'npm'`: ESRP authenticates and accepts the request, then fails at content
  validation — proving the auth/cert/KV wiring works without publishing anything.

**Wrong npm dist-tag**
- Set `publishConfig.tag` in `node/package.json` (ESRP infers the tag from it), or
  pin it explicitly with the `productstate` input on the `EsrpRelease@12` task.
