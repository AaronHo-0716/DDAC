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