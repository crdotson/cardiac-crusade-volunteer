# Cardiac Crusade Volunteer App - Deployment Summary

## Application Overview
- **Type**: Full-stack application.
- **Frontend**: Vite/React (supports path-agnostic builds via `VITE_BASE_PATH`).
- **Backend**: Node.js/Express.
- **Database**: PostgreSQL (requires `PGDATA` to be a subdirectory of the mount point, e.g., `/var/lib/postgresql/data/pgdata`).

## Infrastructure & Deployment
The application is deployed on a k3s cluster (`stormbringer`) using a GitOps workflow.

### CI/CD Workflow
1. **Trigger**: Pushing changes to the source repository (GitHub) triggers a Tekton pipeline.
2. **Tekton Pipeline (`build-pipeline`)**:
   - **`fetch-repository`**: Clones the source code.
   - **`build-image`**: Uses Kaniko to build the container image. It passes `VITE_BASE_PATH` as a build argument to ensure the frontend is correctly configured.
   - **`update-manifest`**: A Python-based Task that:
     - Clones the `stormbringer-k3s-config` repository.
     - Generates/Updates the `deployment.yaml` with the new image tag (from the local registry at `192.168.205.12:30501`).
     - Includes all necessary resources: `PersistentVolumeClaim` (Longhorn), PostgreSQL `Deployment` & `Service`, and the application `Deployment`, `Service`, and Traefik `IngressRoute`.
     - Pushes the updated manifests back to the config repo.
3. **Argo CD**:
   - Watches the `stormbringer-k3s-config` repository (`apps/cardiac-crusade-volunteer` path).
   - Automatically syncs changes to the cluster.

### Key Deployment Details
- **Test URL**: [https://test-cardiaccrusade.dotson97.org](https://test-cardiaccrusade.dotson97.org)
- **Deployment Time**: Changes typically take about **3 minutes** to reflect on the test site after a push.
- **Registry**: Uses a local insecure registry at `192.168.205.12:30501`. All cluster nodes must have this configured in `/etc/rancher/k3s/registries.yaml`.
- **TLS**: Uses the `dotson97-wildcard-tls` secret for HTTPS.

## Operational Notes
- The application is now **path-agnostic**, but for the test deployment, it is mounted at the root of the `test-cardiaccrusade.dotson97.org` subdomain.
- Future changes to the deployment structure (e.g., adding environment variables) should be made in the `git-update-manifest` Tekton Task script.
