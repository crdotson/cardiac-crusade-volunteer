# New Site Deployment Playbook

This playbook documents the exact steps required to spin up a new instance of the Cardiac Crusade Volunteer application on the k3s cluster (`stormbringer`). 

Follow these steps strictly when the user requests a new site (e.g., for a new state or region).

## 1. Update Tekton Manifest Generation
The `git-update-manifest` Task in the `tekton-pipelines` namespace contains an embedded Python script that generates the Kubernetes manifests.
- **Action**: Extract the existing task (`kubectl get task git-update-manifest -n tekton-pipelines -o yaml`), modify the embedded Python script to iterate and emit manifests for the new site in addition to existing sites.
- **Details**: Ensure the new site is provisioned with a distinct name (e.g., `newsite-prod`), a distinct database (`newsite-prod-db`), and correct Traefik IngressRoute match rules (`Host(\`newsite.org\`)`).
- **Apply**: Apply the modified Task to the cluster.

## 2. Trigger Manifest Generation
- **Action**: Either commit to the `cardiac-crusade-volunteer` repository to trigger the full `build-pipeline`, or manually create a `TaskRun` using the `github-repo-ssh-key` secret to explicitly run the patched `git-update-manifest` task.
- **Verification**: Ensure the updated manifests are pushed to the `stormbringer-k3s-config` repository.

## 3. Create ArgoCD Application
- **Action**: Create and apply a new `Application` manifest in the `argocd` namespace pointing to the newly generated folder in the `stormbringer-k3s-config` repository.
- **Verification**: Run `kubectl get application <new-site> -n argocd` to ensure it syncs, and verify that the application and database pods are running in the `default` namespace.

## 4. Provision TLS Certificate
- **Action**: Use the server's `acme.sh` installation to request a Let's Encrypt certificate via Cloudflare DNS challenge aliases. 
- **Command Example**: 
  ```bash
  /ssd/crdotson/.acme.sh/acme.sh --server https://acme-v02.api.letsencrypt.org/directory --issue -d "newsite.org" -d "www.newsite.org" --challenge-alias dotson97.win --dns dns_cf
  ```
- **Secret Generation**: Once `acme.sh` successfully provisions the certificate, create the TLS secret in the `default` namespace (this secret name must match what you configured in the Traefik IngressRoute):
  ```bash
  kubectl create secret tls newsite-tls --cert=/ssd/crdotson/.acme.sh/newsite.org_ecc/fullchain.cer --key=/ssd/crdotson/.acme.sh/newsite.org_ecc/newsite.org.key -n default
  ```

## 5. Seed the Database
Wait for the application pod to start so the `initDB` routine creates the database schema. Then, execute the following actions using `kubectl exec` into the new PostgreSQL pod:

### A. Secure the Admin Account
The initialization script creates the `chris@dotson97.org` account with the password `changeme`.
1. Generate a strong, secure random password.
2. Hash it using bcrypt (e.g., via a Node.js one-liner).
3. Use `psql` to update the password hash in the `users` table:
   ```sql
   UPDATE users SET password_hash = '<bcrypt-hash>' WHERE email = 'chris@dotson97.org';
   ```
4. **Communicate**: Present the generated plaintext password to the user.

### B. Copy Google API Key
1. Extract the `google_api_key` from the original production database (`cardiac-crusade-prod-db`).
2. Insert/Update it into the new database's `settings` table:
   ```sql
   UPDATE settings SET value = '<copied-key>' WHERE key = 'google_api_key';
   ```

### C. Set Map Center Coordinates
1. Ask the user what city the map should be centered on.
2. Look up the precise latitude and longitude coordinates for that city.
3. Inject the coordinates into the new database to prevent the map from defaulting to Lexington, KY:
   ```sql
   INSERT INTO settings (key, value) VALUES ('default_map_center', '<lat>, <lng>') ON CONFLICT (key) DO UPDATE SET value = '<lat>, <lng>';
   ```
