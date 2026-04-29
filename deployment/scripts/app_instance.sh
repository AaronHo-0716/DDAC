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
GH_PAT=$(aws ssm get-parameter --name /app/github_pat --with-decryption --query Parameter.Value --output text --region ap-southeast-5)
GH_USER=$(aws ssm get-parameter --name /app/github_username --query Parameter.Value --output text --region ap-southeast-5)
DB_HOST=$(aws ssm get-parameter --name /app/db/host --query Parameter.Value --output text --region ap-southeast-5)
DB_USER=$(aws ssm get-parameter --name /app/db/username --query Parameter.Value --output text --region ap-southeast-5)
DB_PASS=$(aws ssm get-parameter --name /app/db_password --with-decryption --query Parameter.Value --output text --region ap-southeast-5)
DB_CONNECTION_STRING=$(aws ssm get-parameter --name /app/ConnectionStrings/DefaultConnection --with-decryption --query Parameter.Value --output text --region ap-southeast-5)
REDIS_HOST=$(aws ssm get-parameter --name /app/redis_host --query Parameter.Value --output text --region ap-southeast-5)
S3_BUCKET=$(aws ssm get-parameter --name /app/backend/s3_uploads_bucket --query Parameter.Value --output text --region ap-southeast-5)

echo "Logging into GHCR..."
echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin

BACKEND_IMAGE="ghcr.io/$GH_USER/project-backend:latest"
MIGRATION_IMAGE="ghcr.io/$GH_USER/project-migration:latest"

echo "Pulling images..."
docker pull $BACKEND_IMAGE
docker pull $MIGRATION_IMAGE

echo "Running migrations..."
docker run --rm --name migration -e PGHOST=$DB_HOST -e PGUSER=$DB_USER -e PGPASSWORD=$DB_PASS -e PGDATABASE=neighbourhelp_postgres $MIGRATION_IMAGE
if [ $? -ne 0 ]; then echo "Migration failed!"; fi

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
      - AllowedOrigins=https://neighbourhelp.me,http://neighbourhelp.me
      - Jwt__Key=Your_Super_Secret_Fallback_Key_32_Chars_Long!
      - Jwt__Issuer=NeighborHelpApi
      - Jwt__Audience=NeighborHelpFrontend
      - Storage__Provider=S3
      - Storage__S3__BucketName=$S3_BUCKET
      - Storage__S3__Region=ap-southeast-5
      - Storage__S3__AutoCreateBucket=true
      - Storage__S3__MaxFileSizeMb=10
EOF

docker compose -f /opt/docker-backend.yml up -d
