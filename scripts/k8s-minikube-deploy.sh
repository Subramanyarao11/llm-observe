#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="llm-observe"
HOST="llm-observe.local"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

echo "==> Checking prerequisites"
require_command minikube
require_command kubectl
require_command docker

if ! minikube status >/dev/null 2>&1; then
  echo "==> Starting minikube"
  minikube start --cpus=4 --memory=6144 --driver=docker
fi

echo "==> Enabling ingress and metrics-server addons"
minikube addons enable ingress
minikube addons enable metrics-server

echo "==> Building images inside minikube Docker daemon"
eval "$(minikube docker-env)"
cd "$ROOT_DIR"

docker build --target api -t llm-observe-api:latest .
docker build --target worker -t llm-observe-worker:latest .
docker build --target migrate -t llm-observe-migrate:latest .
docker build -f apps/web/Dockerfile -t llm-observe-web:latest .

echo "==> Applying Kubernetes manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/statefulsets/

echo "==> Waiting for Postgres and Redis"
kubectl wait --for=condition=ready pod \
  -l app=postgres \
  -n "$NAMESPACE" \
  --timeout=180s
kubectl wait --for=condition=ready pod \
  -l app=redis \
  -n "$NAMESPACE" \
  --timeout=180s

echo "==> Running database migration job"
kubectl delete job db-migrate -n "$NAMESPACE" --ignore-not-found
kubectl apply -f k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/db-migrate \
  -n "$NAMESPACE" \
  --timeout=180s

echo "==> Deploying application"
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa/

echo "==> Waiting for app pods"
kubectl wait --for=condition=ready pod \
  -l app=api \
  -n "$NAMESPACE" \
  --timeout=180s
kubectl wait --for=condition=ready pod \
  -l app=web \
  -n "$NAMESPACE" \
  --timeout=180s
kubectl wait --for=condition=ready pod \
  -l app=worker \
  -n "$NAMESPACE" \
  --timeout=180s

MINIKUBE_IP="$(minikube ip)"

cat <<EOF

Deployment complete.

1. Start the ingress tunnel in a separate terminal (required on Docker driver):
   minikube tunnel

2. Add this line to /etc/hosts if it is not there already:
   127.0.0.1 ${HOST}

3. Edit k8s/secret.yaml with your LLM API keys, then re-apply:
   kubectl apply -f k8s/secret.yaml
   kubectl rollout restart deployment/api -n ${NAMESPACE}

4. Open the app:
   http://${HOST}/

5. Useful checks:
   kubectl get pods -n ${NAMESPACE}
   curl -s http://${HOST}/api/health | jq
   open http://${HOST}/

EOF
