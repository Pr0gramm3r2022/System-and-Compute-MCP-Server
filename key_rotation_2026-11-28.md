# API Key Rotation: Remote HTTP MCP Server

**Date:** 2026-11-28
**Service:** `mcp-server` (Cloud Run, `us-central1`)
**URL:** `https://mcp-server-996049909214.us-central1.run.app`

## Why rotate

- The repo has no `.dockerignore`, and the Dockerfile runs `COPY . .`, so `apikeys.env` and `.env` were probably baked into the deployed container image.
- The contents of `apikeys.env` were printed into a Claude Code session on 2026-11-28.

## Overview

Rotate with **zero downtime**: allow the old and new keys at the same time, move every client to the new key, then remove the old keys.

```
generate new -> allow old+new -> redeploy -> update clients -> verify -> remove old -> redeploy -> disable old versions
```

> **Keep keys out of chat and logs.** Run the commands below in your own terminal, or in Claude Code with the `! ` prefix. The commands read keys from files and shell variables so the values aren't echoed.

---

## Step 0: Check the current setup

See how the live service gets `MCP_API_KEYS` (a Secret Manager binding or a plain env var):

```bash
gcloud run services describe mcp-server --region us-central1 \
  --format='yaml(spec.template.spec.containers[0].env)'
```

- If it shows `secretKeyRef: name: mcp-keys`, continue as written.
- If it shows a plain `value:`, the key is stored in plain text in the service config. The steps below switch it to Secret Manager.

Check that the secret exists, and record the current version number for Step 6:

```bash
gcloud secrets versions list mcp-keys
```

Old version(s) to disable later: `__________`

---

## Step 1: Generate new keys

Generate one key per client or team you want to keep separate. `.gitignore` only covers `.env` and `apikeys.env`, so the temporary files below are added to `.gitignore` first:

```bash
printf '\napikeys.old.env\napikeys.new.tmp\n' >> .gitignore
cp apikeys.env apikeys.old.env              # keep the old keys temporarily
openssl rand -hex 32 >  apikeys.new.tmp
openssl rand -hex 32 >> apikeys.new.tmp      # repeat for more keys
```

Confirm that git ignores both files (this should print both file names):

```bash
git check-ignore apikeys.old.env apikeys.new.tmp
```

---

## Step 2: Allow old and new keys at the same time

`MCP_API_KEYS` is a comma-separated list (`middleware/auth.js`). Add a Secret Manager version containing **both** sets:

```bash
cat apikeys.new.tmp apikeys.old.env | grep -v '^$' | paste -sd, - | tr -d '\n' | \
  gcloud secrets versions add mcp-keys --data-file=-
```

> `tr -d '\n'` strips the trailing newline. Without it, the newline would become part of the last key.

Confirm that the service account can read the secret:

```bash
SA=$(gcloud run services describe mcp-server --region us-central1 \
  --format='value(spec.template.spec.serviceAccountName)')
gcloud secrets add-iam-policy-binding mcp-keys \
  --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor
```

(If `SA` is empty, the service uses the default compute service account: `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`.)

---

## Step 3: Redeploy so Cloud Run reads the new secret

Cloud Run reads secret env vars when an instance starts, so you need a new revision.

**Option A: you're also deploying the `/mcp` code now** (see `deployment_todo_2026-11-28.txt`). That deploy already includes:

```bash
--set-secrets ANTHROPIC_API_KEY=anthropic-key:latest,MCP_API_KEYS=mcp-keys:latest
```

**Option B: just refresh the current code:**

```bash
gcloud run services update mcp-server --region us-central1 \
  --update-secrets MCP_API_KEYS=mcp-keys:latest
```

If Step 0 showed a plain-text `MCP_API_KEYS` value, remove it in the same command:

```bash
gcloud run services update mcp-server --region us-central1 \
  --remove-env-vars MCP_API_KEYS \
  --update-secrets MCP_API_KEYS=mcp-keys:latest
```

---

## Step 4: Move every client to a new key

| Client | Where | Action |
|---|---|---|
| Local key file | `apikeys.env` | Replace contents with the new keys: `cp apikeys.new.tmp apikeys.env` |
| Claude Code (remote) | `compute-server` in `~/.claude.json` | Remove and re-add (below) |
| Claude Code (local) | `mcp-lab-local` in `~/.claude.json` | Remove and re-add (below) |
| Local server | `MCP_API_KEYS` when running `http_server.js` | Use a new key |
| Agents / scripts | `lab/agents/*`, other machines | Update headers to `Authorization: Bearer <new key>` |
| GitHub Actions | CI uses `test-key-123` | No change needed (dummy key) |

Claude Code (this reads the key from the file, so it isn't typed or echoed):

```bash
NEW_KEY=$(sed -n 1p apikeys.new.tmp)

claude mcp remove compute-server
claude mcp add --transport http compute-server \
  https://mcp-server-996049909214.us-central1.run.app/mcp \
  --header "Authorization: Bearer ${NEW_KEY}"

claude mcp remove mcp-lab-local
claude mcp add --transport http mcp-lab-local \
  http://localhost:3000/mcp \
  --header "Authorization: Bearer ${NEW_KEY}"

unset NEW_KEY
```

Restart Claude Code (or run `/mcp`) and confirm both servers connect.

---

## Step 5: Verify

> The `/mcp` endpoint only exists after the new code is deployed. Before that, use `/sse` (legacy) or skip to verifying after the deploy.

```bash
U=https://mcp-server-996049909214.us-central1.run.app/mcp
B='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
NEW=$(sed -n 1p apikeys.new.tmp); OLD=$(sed -n 1p apikeys.old.env)

curl -s -o /dev/null -w 'new key: %{http_code}\n' -X POST "$U" "${H[@]}" -H "Authorization: Bearer $NEW" -d "$B"   # expect 200
curl -s -o /dev/null -w 'old key: %{http_code}\n' -X POST "$U" "${H[@]}" -H "Authorization: Bearer $OLD" -d "$B"   # expect 200 (still allowed)

unset NEW OLD
```

---

## Step 6: Remove the old keys

Once **every** client works with the new key:

```bash
grep -v '^$' apikeys.new.tmp | paste -sd, - | tr -d '\n' | \
  gcloud secrets versions add mcp-keys --data-file=-

gcloud run services update mcp-server --region us-central1 \
  --update-secrets MCP_API_KEYS=mcp-keys:latest
```

Re-run Step 5. The old key should now return **403** and the new key **200**.

Disable (don't delete yet) the old secret versions: the one from Step 0 and the transitional old+new version from Step 2:

```bash
gcloud secrets versions list mcp-keys
gcloud secrets versions disable <OLD_VERSION> --secret=mcp-keys
gcloud secrets versions disable <TRANSITION_VERSION> --secret=mcp-keys
```

After a week or so with no problems, destroy them permanently:

```bash
gcloud secrets versions destroy <VERSION> --secret=mcp-keys
```

---

## Step 7: Clean up local files

```bash
shred -u apikeys.old.env apikeys.new.tmp 2>/dev/null || rm -f apikeys.old.env apikeys.new.tmp
```

Remove the two lines added to `.gitignore` in Step 1 if you don't want them kept.

---

## Step 8: Rotate the Anthropic API key (if `.env` held one)

If `.env` contains `ANTHROPIC_API_KEY`, it was probably baked into the image too.

1. Anthropic Console -> **Settings -> API Keys** -> create a new key.
2. Add it to Secret Manager (paste when prompted, then press `Ctrl-D`; nothing is echoed):
   ```bash
   read -rs K && printf '%s' "$K" | gcloud secrets versions add anthropic-key --data-file=- ; unset K
   ```
3. Redeploy: `gcloud run services update mcp-server --region us-central1 --update-secrets ANTHROPIC_API_KEY=anthropic-key:latest`
4. Update the local `.env` and the GitHub repo secret `ANTHROPIC_API_KEY` (**Settings -> Secrets and variables -> Actions**).
5. Delete the old key in the Anthropic Console.

---

## Step 9: Prevent this from happening again

- [ ] Rename `potentialdockerignore.txt` to `.dockerignore` (fix the `.gitignorewhy` typo) **before the next build**.
- [ ] After building, confirm no secrets are in the image:
  ```bash
  docker build -t mcp-test . && docker run --rm mcp-test sh -c 'ls -la /app | grep -i env || echo "clean"'
  ```
- [ ] Keep production keys only in Secret Manager. Never put them in the image or in plain env vars.
- [ ] Repeat this rotation on a schedule (for example, every 90 days) or whenever a key may have been exposed.

---

## Rollback notes

- Every Cloud Run revision binds `mcp-keys:latest`, so rolling back to an older revision reads the **current** keys when it starts. Rolling back doesn't bring old keys back.
- If you break auth during rotation, add a secret version with the previous working key list and run `gcloud run services update ... --update-secrets MCP_API_KEYS=mcp-keys:latest` again. You can also re-enable a disabled version with `gcloud secrets versions enable`.
