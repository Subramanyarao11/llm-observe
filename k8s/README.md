# Kubernetes Deployment (Self-Hosted)

Deploy LLM Observe on a local self-hosted cluster using **minikube**. The manifests also work on kind, k3s, or any standard Kubernetes cluster with minor adjustments (image registry, storage class, ingress).

## What Gets Deployed

| Resource | Purpose |
| -------- | ------- |
| `StatefulSet/postgres` | PostgreSQL with 10Gi PVC |
| `StatefulSet/redis` | Redis for BullMQ |
| `Job/db-migrate` | Prisma schema push (one-shot) |
| `Deployment/api` | NestJS API (2 replicas + HPA) |
| `Deployment/worker` | BullMQ log processor (+ HPA) |
| `Deployment/web` | React UI via nginx (2 replicas) |
| `Ingress` | Routes `/api` → API, `/` → web |

## Prerequisites

- [minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- Docker
- LLM API key(s) for chat

## One-Command Deploy (minikube)

```bash
# 1. Add your API keys
vim k8s/secret.yaml

# 2. Run the deploy script
chmod +x scripts/k8s-minikube-deploy.sh
./scripts/k8s-minikube-deploy.sh
```

The script will:

1. Start minikube (4 CPU / 8GB) if needed
2. Enable **ingress** and **metrics-server** addons
3. Build `llm-observe-api`, `llm-observe-worker`, `llm-observe-migrate`, and `llm-observe-web` images inside minikube's Docker
4. Apply manifests in the correct order
5. Wait for Postgres/Redis, run the migration job, then start app pods

## Manual Deploy

```bash
minikube start --cpus=4 --memory=8192
minikube addons enable ingress
minikube addons enable metrics-server

eval $(minikube docker-env)
docker build --target api -t llm-observe-api:latest .
docker build --target worker -t llm-observe-worker:latest .
docker build --target migrate -t llm-observe-migrate:latest .
docker build -f apps/web/Dockerfile -t llm-observe-web:latest .

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/statefulsets/

kubectl wait --for=condition=ready pod -l app=postgres -n llm-observe --timeout=180s
kubectl wait --for=condition=ready pod -l app=redis -n llm-observe --timeout=180s

kubectl apply -f k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/db-migrate -n llm-observe --timeout=180s

kubectl apply -f k8s/deployments/
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa/
```

## Access the App

On the Docker driver, start the ingress tunnel in a **separate terminal** and leave it running:

```bash
minikube tunnel
```

Add localhost to `/etc/hosts`:

```bash
echo "127.0.0.1 llm-observe.local" | sudo tee -a /etc/hosts
```

Open:

- **Web UI:** http://llm-observe.local/
- **Health:** http://llm-observe.local/api/health
- **Bull Board:** http://llm-observe.local/api/admin/queues

## Verify Deployment

```bash
kubectl get pods -n llm-observe
kubectl get ingress -n llm-observe
curl -s http://llm-observe.local/api/health | jq
```

Expected health response:

```json
{
  "status": "ok",
  "postgres": { "status": "up", "latencyMs": 1 },
  "redis": { "status": "up", "latencyMs": 0 }
}
```

Quick sanity checks:

1. All pods `Running`
2. Health check JSON with postgres/redis up
3. Chat message streaming in the UI
4. Dashboard metrics updating after a few LLM calls

## Secrets

Edit `k8s/secret.yaml` before deploy:

```yaml
stringData:
  OPENAI_API_KEY: "sk-..."
  ANTHROPIC_API_KEY: ""
  GEMINI_API_KEY: ""
```

After updating secrets:

```bash
kubectl apply -f k8s/secret.yaml
kubectl rollout restart deployment/api -n llm-observe
```

For production, prefer Sealed Secrets, External Secrets Operator, or Vault — not committed plain-text secrets.

## Architecture Notes

### In-cluster DNS

Services use names that match Docker Compose for consistency:

- `postgres:5432` — database
- `redis:6379` — queue
- `api:3001` — API (SDK ingest + web nginx proxy)

### Ingress + SSE

The ingress includes annotations for **SSE streaming** (chat):

- `proxy-buffering: off`
- Extended read/send timeouts (3600s)

### Migration Job

`k8s/jobs/migrate.yaml` runs once before app pods rely on the schema. Re-run after schema changes:

```bash
kubectl delete job db-migrate -n llm-observe
kubectl apply -f k8s/jobs/migrate.yaml
```

### Scaling

- **API HPA:** 2–10 replicas on CPU (requires metrics-server)
- **Worker HPA:** 1–20 replicas on CPU
- For queue-depth scaling, add KEDA in production

### Failure Handling

- API/worker depend on migration completing first (enforced by deploy script order)
- Ingest uses BullMQ retries; worker upserts logs by `logId` (idempotent)
- Postgres/Redis use PVCs — data survives pod restarts

## Non-minikube Clusters

For kind/k3s/bare metal:

1. Push images to a registry and update `image:` fields in deployments/job
2. Ensure a default `StorageClass` exists for PVCs
3. Install an ingress controller (nginx recommended)
4. Update `WEB_URL` in `k8s/configmap.yaml` to your real hostname
5. Update `k8s/ingress.yaml` `host:` rule

## Teardown

```bash
kubectl delete namespace llm-observe
minikube stop   # optional
```
