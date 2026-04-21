# UTH Chatbot Deployment Guide on Google Cloud (Cloud Run)

This guide deploys 3 services:
- uth-python-service (FastAPI)
- uth-api-service (Node.js)
- uth-frontend-service (React + Nginx)

## 1. Prerequisites

- Install Google Cloud CLI and Docker.
- You have a Google Cloud project with billing enabled (trial credit is fine).
- Choose a region close to users, for example: us-central1 or asia-southeast1.

## 2. Set variables in PowerShell

```powershell
$PROJECT_ID="YOUR_PROJECT_ID"
$REGION="asia-southeast1"
$REPO="uth-chatbot"

$SQL_INSTANCE="uth-chatbot-mysql"
$SQL_DB="uth_chatbot"
$SQL_USER="uth_app"
$SQL_PASSWORD="CHANGEME_DB_PASSWORD"

$JWT_SECRET="CHANGEME_JWT_SECRET"
$GEMINI_API_KEY="CHANGEME_GEMINI_KEY"
$PORTAL_ENCRYPTION_KEY="CHANGEME_32_CHAR_KEY"
```

## 3. Authenticate and enable APIs

```powershell
gcloud auth login
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
```

## 4. Create Artifact Registry repository

```powershell
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="UTH chatbot images"
```

If the repository already exists, continue.

## 5. Create Cloud SQL (MySQL)

Pick smallest instance class available in your region for cost control.

```powershell
gcloud sql instances create $SQL_INSTANCE --database-version=MYSQL_8_0 --tier=db-custom-1-3840 --region=$REGION --storage-size=10 --storage-auto-increase

gcloud sql databases create $SQL_DB --instance=$SQL_INSTANCE
gcloud sql users create $SQL_USER --instance=$SQL_INSTANCE --password=$SQL_PASSWORD
```

Get connection name:

```powershell
$INSTANCE_CONNECTION_NAME=(gcloud sql instances describe $SQL_INSTANCE --format="value(connectionName)")
$INSTANCE_CONNECTION_NAME
```

## 6. Create secrets

```powershell
$SQL_PASSWORD | gcloud secrets create DB_PASSWORD --data-file=-
$JWT_SECRET | gcloud secrets create JWT_SECRET --data-file=-
$GEMINI_API_KEY | gcloud secrets create GEMINI_API_KEY --data-file=-
$PORTAL_ENCRYPTION_KEY | gcloud secrets create PORTAL_ENCRYPTION_KEY --data-file=-
```

If secret already exists, add new version instead:

```powershell
$SQL_PASSWORD | gcloud secrets versions add DB_PASSWORD --data-file=-
$JWT_SECRET | gcloud secrets versions add JWT_SECRET --data-file=-
$GEMINI_API_KEY | gcloud secrets versions add GEMINI_API_KEY --data-file=-
$PORTAL_ENCRYPTION_KEY | gcloud secrets versions add PORTAL_ENCRYPTION_KEY --data-file=-
```

Grant Cloud Run runtime service account access (replace PROJECT_NUMBER if needed):

```powershell
$PROJECT_NUMBER=(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
$RUN_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding DB_PASSWORD --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding JWT_SECRET --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding PORTAL_ENCRYPTION_KEY --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
```

## 7. Deploy Python service first

Build image:

```powershell
gcloud builds submit Python_UTH --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/uth-python-service:latest"
```

Deploy:

```powershell
gcloud run deploy uth-python-service `
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/uth-python-service:latest" `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --timeout 120 `
  --concurrency 20 `
  --min-instances 0 `
  --max-instances 5 `
  --set-env-vars "PROXY_FILE_PATH=/app/proxies.txt,PROXY_MUTATION_ENABLED=false"
```

Get URL:

```powershell
$PYTHON_URL=(gcloud run services describe uth-python-service --region $REGION --format="value(status.url)")
$PYTHON_URL
```

Health check:

```powershell
curl "$PYTHON_URL/api/health"
```

## 8. Deploy Node API service

Build image:

```powershell
gcloud builds submit server --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/uth-api-service:latest"
```

First deploy with DB bootstrap enabled (one time):

```powershell
gcloud run deploy uth-api-service `
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/uth-api-service:latest" `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --add-cloudsql-instances $INSTANCE_CONNECTION_NAME `
  --memory 1Gi `
  --cpu 1 `
  --timeout 120 `
  --concurrency 40 `
  --min-instances 0 `
  --max-instances 10 `
  --set-env-vars "NODE_ENV=production,DB_USER=$SQL_USER,DB_NAME=$SQL_DB,INSTANCE_CONNECTION_NAME=$INSTANCE_CONNECTION_NAME,PYTHON_SERVICE_URL=$PYTHON_URL,CORS_ORIGINS=http://localhost:5173,DB_BOOTSTRAP=true" `
  --set-secrets "DB_PASSWORD=DB_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,PORTAL_ENCRYPTION_KEY=PORTAL_ENCRYPTION_KEY:latest"
```

After first successful run, redeploy/update with bootstrap disabled:

```powershell
gcloud run services update uth-api-service --region $REGION --update-env-vars "DB_BOOTSTRAP=false"
```

Get URL:

```powershell
$API_URL=(gcloud run services describe uth-api-service --region $REGION --format="value(status.url)")
$API_URL
```

Health check:

```powershell
curl "$API_URL/api/health"
```

## 9. Deploy Frontend service

Build with API URL injected:

```powershell
$FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/uth-frontend-service:latest"
gcloud builds submit . --config deploy/cloudbuild.frontend.yaml --substitutions "_IMAGE=$FRONTEND_IMAGE,_VITE_API_BASE_URL=$API_URL/api"
```

Deploy:

```powershell
gcloud run deploy uth-frontend-service `
  --image $FRONTEND_IMAGE `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --timeout 60 `
  --concurrency 80 `
  --min-instances 0 `
  --max-instances 5
```

Get URL:

```powershell
$FRONTEND_URL=(gcloud run services describe uth-frontend-service --region $REGION --format="value(status.url)")
$FRONTEND_URL
```

Update API CORS to frontend URL:

```powershell
gcloud run services update uth-api-service --region $REGION --update-env-vars "CORS_ORIGINS=$FRONTEND_URL"
```

## 10. End-to-end verification

- Open frontend URL and perform login/chat flow.
- Test portal verification flow.
- Verify schedule requests are returned.
- Confirm Cloud Run logs are clean.

Useful log commands:

```powershell
gcloud run services logs read uth-api-service --region $REGION --limit=200
gcloud run services logs read uth-python-service --region $REGION --limit=200
gcloud run services logs read uth-frontend-service --region $REGION --limit=200
```

## 11. Stability and cost controls

- Keep min-instances at 0 for all services while developing.
- Increase only API or Python min-instances if cold starts impact user experience.
- Keep Cloud SQL smallest practical tier during trial.
- Configure budget alerts at 25%, 50%, 75%, 90% of target spend.

## 12. Security hardening after first successful deployment

- Rotate JWT_SECRET, GEMINI_API_KEY, PORTAL_ENCRYPTION_KEY after deployment.
- Restrict uth-python-service to authenticated invocations and call it from uth-api-service using service identity.
- Add HTTPS-only origin policy in CORS_ORIGINS.

## 13. Common rollback commands

List revisions:

```powershell
gcloud run revisions list --service uth-api-service --region $REGION
gcloud run revisions list --service uth-python-service --region $REGION
```

Send traffic back to previous revision:

```powershell
gcloud run services update-traffic uth-api-service --region $REGION --to-revisions REVISION_NAME=100
gcloud run services update-traffic uth-python-service --region $REGION --to-revisions REVISION_NAME=100
```
