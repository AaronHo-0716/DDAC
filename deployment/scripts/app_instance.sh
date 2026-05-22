#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# 1. Wait for internet connectivity (NAT Gateway takes time to provision)
echo "Waiting for internet connectivity..."
for i in {1..30}; do
    if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
        echo "Internet is reachable!"
        break
    fi
    echo "Attempt $${i}: Internet not reachable yet. Waiting 10s..."
    sleep 10
done

# 2. Update packages (Force IPv4)
apt-get update -o Acquire::ForceIPv4=true

# 3. Install Unzip, Docker & SSH
apt-get install -y openssh-server unzip
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -o Acquire::ForceIPv4=true
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu

# 3.1 Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# 4. Create 'user' account
useradd -m -s /bin/bash user
echo "user:${var_instance_password}" | chpasswd
usermod -aG sudo user

# 5. Fix SSH Config for Ubuntu 24.04
if [ -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf ]; then
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
fi

sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

systemctl restart ssh

cat > /opt/docker-compose.yml << 'COMPOSE'
${docker_compose_content}
COMPOSE

docker compose -f /opt/docker-compose.yml up -d

# --- 6. Pull and run Backend application ---
echo "Fetching credentials from SSM..."

# Function to get SSM parameter with retry
get_ssm_param() {
    local param_name=$1
    local max_retries=10
    local retry=0
    local result=""

    while [ $retry -lt $max_retries ]; do
        result=$(aws ssm get-parameter --name "$param_name" --with-decryption --query Parameter.Value --output text --region ap-southeast-5 2>&1)
        if [[ ! "$result" == *"error"* ]] && [[ ! "$result" == *"ParameterNotFound"* ]]; then
            echo "$result"
            return 0
        fi
        echo "Attempt $retry: Waiting for parameter $param_name..."
        retry=$((retry + 1))
        sleep 10
    done
    echo "ERROR: Failed to get parameter $param_name after $max_retries attempts"
    return 1
}

GH_PAT=$(get_ssm_param "/app/github_pat")
echo "GH_PAT result: $GH_PAT"

GH_USER=$(get_ssm_param "/app/github_username")
echo "GH_USER result: $GH_USER"

if [[ "$GH_PAT" == *"ERROR"* ]] || [[ "$GH_USER" == *"ERROR"* ]]; then
    echo "ERROR: Failed to get GitHub credentials from SSM"
    exit 1
fi

DB_HOST=$(get_ssm_param "/app/db/host")
echo "DB_HOST: $DB_HOST"

DB_USER=$(get_ssm_param "/app/db/username")
DB_PASS=$(get_ssm_param "/app/db_password")
DB_CONNECTION_STRING=$(get_ssm_param "/app/ConnectionStrings/DefaultConnection")
echo "DB_CONNECTION_STRING: $DB_CONNECTION_STRING"

REDIS_HOST=$(get_ssm_param "/app/redis_host")
S3_BUCKET=$(get_ssm_param "/app/backend/s3_uploads_bucket")
MAILPIT_HOST=$(get_ssm_param "/app/mailpit_host")
STRIPE_SECRET_KEY=$(get_ssm_param "/app/stripe/secret_key")
STRIPE_WEBHOOK_SECRET=$(get_ssm_param "/app/stripe/webhook_secret")
STRIPE_CURRENCY=$(get_ssm_param "/app/stripe/currency")
STRIPE_SUCCESS_URL_BASE=$(get_ssm_param "/app/stripe/success_url_base")
STRIPE_CANCEL_URL_BASE=$(get_ssm_param "/app/stripe/cancel_url_base")

echo "Logging into GHCR..."
echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Docker login failed"
    exit 1
fi

# Convert username to lowercase (Docker requires lowercase image names)
GH_USER_LOWER=$(echo "$GH_USER" | tr '[:upper:]' '[:lower:]')
echo "Using lowercase username: $GH_USER_LOWER"

BACKEND_IMAGE="ghcr.io/$GH_USER_LOWER/project-backend:latest"
MIGRATION_IMAGE="ghcr.io/$GH_USER_LOWER/project-migration:latest"

echo "Pulling images..."
docker pull $BACKEND_IMAGE 2>&1
docker pull $MIGRATION_IMAGE 2>&1

echo "Running migrations..."
docker run --rm --name migration -e PGHOST=$DB_HOST -e PGUSER=$DB_USER -e PGPASSWORD=$DB_PASS -e PGDATABASE=neighbourhelp_postgres $MIGRATION_IMAGE 2>&1
if [ $? -ne 0 ]; then echo "WARNING: Migration failed!"; fi

echo "Starting Backend..."
cat > /opt/docker-backend.yml << EOF
services:
  backend:
    image: $BACKEND_IMAGE
    container_name: backend
    restart: always
    ports:
      - "5073:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=$DB_CONNECTION_STRING
      - Redis__ConnectionString=$REDIS_HOST:6379
      - AllowedOrigins=https://neighbourhelp.me,http://neighbourhelp.me,https://www.neighbourhelp.me,http://www.neighbourhelp.me
      - Jwt__Key=Your_Super_Secret_Fallback_Key_32_Chars_Long!
      - Jwt__Issuer=NeighborHelpApi
      - Jwt__Audience=NeighborHelpFrontend
      - Storage__Provider=S3
      - Storage__S3__BucketName=$S3_BUCKET
      - Storage__S3__Region=ap-southeast-5
      - Storage__S3__AutoCreateBucket=true
      - Storage__S3__MaxFileSizeMb=10
      - Email__Host=$MAILPIT_HOST
      - Email__Port=1025
      - Email__From=noreply@neighbourhelp.me
      - SiteSettings__FrontendUrl=https://neighbourhelp.me
      - Stripe__SecretKey=$STRIPE_SECRET_KEY
      - Stripe__WebhookSecret=$STRIPE_WEBHOOK_SECRET
      - Stripe__Currency=$STRIPE_CURRENCY
      - Stripe__SuccessUrlBase=$STRIPE_SUCCESS_URL_BASE
      - Stripe__CancelUrlBase=$STRIPE_CANCEL_URL_BASE
EOF

docker compose -f /opt/docker-backend.yml up -d 2>&1
sleep 10

echo "Checking if backend is running..."
docker ps
docker logs backend 2>&1 || echo "No backend container logs yet"

# Simple health check test
curl -f http://localhost:5073/health/live || echo "WARNING: Backend health check failed"
