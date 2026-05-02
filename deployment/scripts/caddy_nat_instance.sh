#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# Wait for internet connectivity (like frontend script)
echo "Waiting for internet connectivity..."
for i in {1..30}; do
    if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
        echo "Internet is reachable!"
        break
    fi
    echo "Attempt $${i}: Internet not reachable yet. Waiting 10s..."
    sleep 10
done

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

# Install AWS CLI for dynamic discovery (using same method as frontend script)
apt-get install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf awscliv2.zip aws/  # Clean up

# Create a script to update Caddy configuration dynamically
cat > /usr/local/bin/update-caddy.sh << 'UPDATE_SCRIPT'
#!/bin/bash

AWS_REGION="${aws_region}"

# Get monitoring instance IP
MONITORING_IP=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=App-Monitoring" "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].PrivateIpAddress" \
    --output text --region $AWS_REGION 2>/dev/null)

# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names "app-internal-alb" \
    --query "LoadBalancers[0].DNSName" \
    --output text --region $AWS_REGION 2>/dev/null)

# Use defaults if not found
if [ -z "$MONITORING_IP" ] || [ "$MONITORING_IP" = "None" ]; then
    MONITORING_IP="127.0.0.1"
fi

if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
    ALB_DNS="127.0.0.1"
fi

# Generate new Caddyfile
NEW_CADDYFILE="neighbourhelp.me {
    handle_path /api/proxy/* {
        rewrite * /api{path}
        reverse_proxy $ALB_DNS:5073
    }
    handle /grafana/* {
        reverse_proxy $MONITORING_IP:3000
    }
    handle /prometheus/* {
        reverse_proxy $MONITORING_IP:9090
    }
    handle {
        reverse_proxy $ALB_DNS:3000
    }
}"

# Check if Caddyfile needs updating
if ! cmp -s <(echo "$NEW_CADDYFILE") /etc/caddy/Caddyfile; then
    echo "Updating Caddyfile..."
    echo "$NEW_CADDYFILE" > /etc/caddy/Caddyfile
    systemctl reload caddy
    echo "Caddy updated with ALB: $ALB_DNS, Monitoring: $MONITORING_IP"
fi
UPDATE_SCRIPT

chmod +x /usr/local/bin/update-caddy.sh

# Run once at startup to create initial Caddyfile
/usr/local/bin/update-caddy.sh

# Set up cron job to check every minute
echo "* * * * * /usr/local/bin/update-caddy.sh >> /var/log/caddy-update.log 2>&1" | crontab -

# Start Caddy (it will use the initial config, then cron will update it)
systemctl enable --now caddy

cat > /opt/docker-compose.yml << 'COMPOSE'
${docker_compose_content}
COMPOSE

docker compose -f /opt/docker-compose.yml up -d
