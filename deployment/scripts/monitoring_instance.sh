#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "Waiting for internet connectivity..."
for i in {1..30}; do
    if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
        break
    fi
    sleep 10
done

apt-get update -o Acquire::ForceIPv4=true
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

useradd -m -s /bin/bash user
echo "user:${var_instance_password}" | chpasswd
usermod -aG sudo user

if [ -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf ]; then
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
fi

sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

systemctl restart ssh


mkdir -p /opt/monitoring
cd /opt/monitoring

cat << 'PROMETHEUS' > prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node_exporter'
    ec2_sd_configs:
      - region: ${var_aws_region}
        port: 9100
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Name]
        action: keep
        regex: (App-Backend-Tier|App-Frontend-Tier|App-Caddy-NAT|App-Monitoring)
      - source_labels: [__meta_ec2_private_ip]
        target_label: instance
PROMETHEUS

cat > docker-compose.yml << 'COMPOSE'
${docker_compose_content}
COMPOSE

docker compose up -d