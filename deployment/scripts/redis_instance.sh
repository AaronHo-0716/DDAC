#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "Waiting for internet connectivity..."
for i in {1..30}; do
    if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
        break
    fi
    sleep 10
done

# Redirect output to log file
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Update and install Docker
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

mkdir -p /opt/redis
cd /opt/redis

cat << 'COMPOSE' > docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:alpine
    container_name: redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    restart: always
COMPOSE

docker compose up -d

# Configure memory overcommit
echo "vm.overcommit_memory=1" >> /etc/sysctl.conf
sysctl -p