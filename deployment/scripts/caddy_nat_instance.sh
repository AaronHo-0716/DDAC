#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y iptables iptables-persistent
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -o Acquire::ForceIPv4=true
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/99-ip-forwarding.conf
PRIMARY_IF=$(ip route show default | awk '/default/ {print $5}')
iptables -t nat -A POSTROUTING -o $${PRIMARY_IF} -s ${aws_vpc_app_vpc_cidr_block} -j MASQUERADE
iptables-save > /etc/iptables/rules.v4
systemctl enable --now docker
usermod -aG docker ubuntu

# Install Caddy
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

# Configure Caddy reverse proxy to frontend and backend
cat > /etc/caddy/Caddyfile << 'CADDYFILE'
neighbourhelp.me {
    handle_path /api/proxy/* {
        rewrite * /api{path}
        reverse_proxy ${aws_instance_app_instance_private_ip}:5073
    }
    handle /grafana/* {
        reverse_proxy ${aws_instance_monitoring_instance_private_ip}:3000
    }
    handle /prometheus/* {
        reverse_proxy ${aws_instance_monitoring_instance_private_ip}:9090
    }
    handle {
        reverse_proxy ${aws_instance_frontend_instance_private_ip}:3000
    }
}
CADDYFILE

systemctl enable --now caddy
systemctl restart caddy

cat > /opt/docker-compose.yml << 'COMPOSE'
${docker_compose_content}
COMPOSE

docker compose -f /opt/docker-compose.yml up -d