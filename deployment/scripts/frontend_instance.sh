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

# --- 6. Pull and run Frontend application ---
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

if [[ "$GH_PAT" == *"error"* ]] || [[ "$GH_USER" == *"error"* ]]; then
    echo "ERROR: Failed to get GitHub credentials from SSM"
    exit 1
fi

echo "Logging into GHCR..."
echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Docker login failed"
    exit 1
fi

# Convert username to lowercase (Docker requires lowercase image names)
GH_USER_LOWER=$(echo "$GH_USER" | tr '[:upper:]' '[:lower:]')
echo "Using lowercase username: $GH_USER_LOWER"

FRONTEND_IMAGE="ghcr.io/$GH_USER_LOWER/project-frontend:latest"
echo "Frontend image: $FRONTEND_IMAGE"

echo "Pulling frontend image..."
docker pull $FRONTEND_IMAGE 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to pull frontend image"
    exit 1
fi

echo "Starting Frontend..."
API_URL=$(get_ssm_param "/app/backend/api_url")
echo "API_URL: $API_URL"

cat > /opt/docker-frontend.yml << EOF
services:
  frontend:
    image: $FRONTEND_IMAGE
    container_name: frontend
    restart: always
    ports:
      - "3000:3000"
    environment:
      - API_URL=$API_URL
      - NODE_ENV=production
      - PORT=3000
EOF

docker compose -f /opt/docker-frontend.yml up -d 2>&1
sleep 10

echo "Checking if frontend is running..."
docker ps
docker logs frontend 2>&1 || echo "No frontend container logs yet"

# Simple health check endpoint test
curl -f http://localhost:3000/ || echo "WARNING: Frontend health check failed"
