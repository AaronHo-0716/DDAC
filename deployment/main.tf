terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# --- Variables & Validation ---
variable "aws_region" {
  description = "We deploy to Malaysia region (ap-southeast-5)"
  type        = string
  default     = "ap-southeast-5"

  validation {
    condition     = contains(["ap-southeast-5", "ap-southeast-1"], var.aws_region)
    error_message = "Deployment errored."
  }
}

variable "db_username" {
  description = "The database admin username"
  type        = string
  default     = "dbadmin"
}

variable "db_password" {
  description = "The database admin password"
  type        = string
  sensitive   = true
}

variable "key_name" {
  description = "The name of the EC2 Key Pair to use for SSH access"
  type        = string
}

variable "instance_password" {
  description = "Password for the 'user' account on frontend and backend EC2 instances"
  type        = string
  sensitive   = true
}



provider "aws" {
  region = var.aws_region
}

# --- Dynamic Data Sources ---
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu_2404" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# --- Network Topology ---
resource "aws_vpc" "app_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "App-VPC" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.app_vpc.id
  tags   = { Name = "App-IGW" }
}

resource "aws_subnet" "public_dmz" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags                    = { Name = "App-Public-DMZ" }
}

resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.app_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "App-Private-Tier" }
}

resource "aws_subnet" "private_data" {
  vpc_id            = aws_vpc.app_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[1] # Spans to second AZ for RDS
  tags              = { Name = "App-Data-Tier" }
}

# --- Routing ---
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.app_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public_assoc" {
  subnet_id      = aws_subnet.public_dmz.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.app_vpc.id
}

resource "aws_eip" "nat_eip" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat_gw" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_dmz.id
  depends_on    = [aws_internet_gateway.igw]

  tags = { Name = "Temp-NAT-Gateway" }
}

# Replace your existing aws_route.private_nat_route with this:
resource "aws_route" "private_nat_route" {
  route_table_id         = aws_route_table.private_rt.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat_gw.id
}

resource "aws_route_table_association" "private_app_assoc" {
  subnet_id      = aws_subnet.private_app.id
  route_table_id = aws_route_table.private_rt.id
}

resource "aws_route_table_association" "private_data_assoc" {
  subnet_id      = aws_subnet.private_data.id
  route_table_id = aws_route_table.private_rt.id
}

# --- Security Groups ---
resource "aws_security_group" "public_sg" {
  name        = "public-caddy-nat-sg"
  description = "Allow HTTP for Caddy and route traffic for NAT"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    description = "SSH from Internet"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow Prometheus to scrape metrics from Node Exporter"
    from_port   = 9100
    to_port     = 9100
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.app_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app_sg" {
  name        = "private-app-sg"
  description = "Allow traffic from Caddy proxy and SSH from Caddy"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    description     = "Allow all TCP from Public SG (Caddy)"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.public_sg.id]
  }

  ingress {
    description     = "SSH from Caddy instance"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.public_sg.id]
  }

  ingress {
    description = "Allow all traffic from instances in the same SG"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db_sg" {
  name        = "private-db-sg"
  description = "Allow Postgres traffic from App Tier"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    description     = "PostgreSQL from App Tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }
}

# Provision IAM Infrastructure
# Create the IAM Role for the EC2 instances
resource "aws_iam_role" "ec2_ssm_role" {
  name = "ec2-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "ssm_parameter_read_and_write" {
  name = "ssm-parameter-read-and-write"
  role = aws_iam_role.ec2_ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "ssm:PutParameter"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/app/*"
      }
    ]
  })
}

# Add S3 Permissions to existing EC2 Role
resource "aws_iam_role_policy" "s3_upload_policy" {
  name = "s3-upload-policy"
  role = aws_iam_role.ec2_ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.user_uploads.arn}/*"
      }
    ]
  })
}

# Add EC2 DescribeInstances for Prometheus Service Discovery
# Auto detect any EC2 instances for monitoring, no need fix IP
resource "aws_iam_role_policy" "ec2_describe_instances_policy" {
  name = "ec2-describe-instances-policy"
  role = aws_iam_role.ec2_ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach the AWS managed policy for SSM Core functionality
resource "aws_iam_role_policy_attachment" "ssm_core_attachment" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Create the Instance Profile wrapper
resource "aws_iam_instance_profile" "ec2_ssm_profile" {
  name = "ec2-ssm-profile"
  role = aws_iam_role.ec2_ssm_role.name
}

# --- Compute: Combined Proxy + NAT Instance (Public DMZ) ---
resource "aws_instance" "caddy_nat_instance" {
  ami                  = data.aws_ami.ubuntu_2404.id
  instance_type        = "t3.micro"
  subnet_id            = aws_subnet.public_dmz.id
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.id
  key_name             = var.key_name

  vpc_security_group_ids = [aws_security_group.public_sg.id]
  source_dest_check      = false

  user_data = <<-EOF
              #!/bin/bash
              export DEBIAN_FRONTEND=noninteractive
              apt-get update
              apt-get install -y iptables iptables-persistent docker.io
              sysctl -w net.ipv4.ip_forward=1
              echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/99-ip-forwarding.conf
              PRIMARY_IF=$(ip route show default | awk '/default/ {print $5}')
              iptables -t nat -A POSTROUTING -o $PRIMARY_IF -s ${aws_vpc.app_vpc.cidr_block} -j MASQUERADE
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
                      reverse_proxy ${aws_instance.app_instance.private_ip}:5073
                  }
                  handle {
                      reverse_proxy ${aws_instance.frontend_instance.private_ip}:3000
                  }
              }
              CADDYFILE

              systemctl enable --now caddy
              systemctl restart caddy

              docker run -d --restart always \
                --name node-exporter \
                --net="host" \
                --pid="host" \
                -v "/:/host:ro,rslave" \
                quay.io/prometheus/node-exporter:latest \
                --path.rootfs=/host
              EOF

  tags = { Name = "App-Caddy-NAT" }
}

# --- Compute: App Tier (Private Subnet) ---
resource "aws_instance" "app_instance" {
  ami                  = data.aws_ami.ubuntu_2404.id
  instance_type        = "t3.large"
  subnet_id            = aws_subnet.private_app.id
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.id
  key_name             = var.key_name

  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  user_data_replace_on_change = true

  user_data = <<-EOF
              #!/bin/bash
              export DEBIAN_FRONTEND=noninteractive

              # 1. Wait for internet connectivity (NAT Gateway takes time to provision)
              echo "Waiting for internet connectivity..."
              for i in {1..30}; do
                  if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
                      echo "Internet is reachable!"
                      break
                  fi
                  echo "Attempt $i: Internet not reachable yet. Waiting 10s..."
                  sleep 10
              done

              # 2. Update packages (Force IPv4)
              apt-get update -o Acquire::ForceIPv4=true

              # 3. Install Unzip, Docker & SSH
              apt-get install -y docker.io openssh-server unzip
              systemctl enable --now docker
              usermod -aG docker ubuntu

              # 3.1 Install AWS CLI
              curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
              unzip awscliv2.zip
              ./aws/install

              # 4. Create 'user' account
              useradd -m -s /bin/bash user
              echo "user:${var.instance_password}" | chpasswd
              usermod -aG sudo user

              # 5. Fix SSH Config for Ubuntu 24.04
              if [ -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf ]; then
                  sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
              fi

              sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
              sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

              systemctl restart ssh

              docker run -d --restart always \
                --name node-exporter \
                --net="host" \
                --pid="host" \
                -v "/:/host:ro,rslave" \
                quay.io/prometheus/node-exporter:latest \
                --path.rootfs=/host
              EOF


  tags = { Name = "App-Backend-Tier" }
}

# --- Compute: Frontend Tier (Private Subnet) ---
resource "aws_instance" "frontend_instance" {
  ami                  = data.aws_ami.ubuntu_2404.id
  instance_type        = "t3.micro"
  subnet_id            = aws_subnet.private_app.id
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.id
  key_name             = var.key_name

  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  user_data_replace_on_change = true

  user_data = <<-EOF
              #!/bin/bash
              export DEBIAN_FRONTEND=noninteractive

              # 1. Wait for internet connectivity (NAT Gateway takes time to provision)
              echo "Waiting for internet connectivity..."
              for i in {1..30}; do
                  if curl -s --max-time 5 http://archive.ubuntu.com &>/dev/null; then
                      echo "Internet is reachable!"
                      break
                  fi
                  echo "Attempt $i: Internet not reachable yet. Waiting 10s..."
                  sleep 10
              done

              # 2. Update packages (Force IPv4)
              apt-get update -o Acquire::ForceIPv4=true

              # 3. Install Unzip, Docker & SSH
              apt-get install -y docker.io openssh-server unzip
              systemctl enable --now docker
              usermod -aG docker ubuntu

              # 3.1 Install AWS CLI
              curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
              unzip awscliv2.zip
              ./aws/install

              # 4. Create 'user' account
              useradd -m -s /bin/bash user
              echo "user:${var.instance_password}" | chpasswd
              usermod -aG sudo user

              # 5. Fix SSH Config for Ubuntu 24.04
              if [ -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf ]; then
                  sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
              fi

              sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
              sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

              systemctl restart ssh

              docker run -d --restart always \
                --name node-exporter \
                --net="host" \
                --pid="host" \
                -v "/:/host:ro,rslave" \
                quay.io/prometheus/node-exporter:latest \
                --path.rootfs=/host
              EOF


  tags = { Name = "App-Frontend-Tier" }
}

# --- Compute: Monitoring Tier (Private Subnet) ---
resource "aws_instance" "monitoring_instance" {
  ami                  = data.aws_ami.ubuntu_2404.id
  instance_type        = "t3.medium"
  subnet_id            = aws_subnet.private_app.id
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.id
  key_name             = var.key_name

  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  user_data_replace_on_change = true

  user_data = <<-EOF
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
              apt-get install -y docker.io docker-compose openssh-server unzip
              systemctl enable --now docker
              usermod -aG docker ubuntu

              mkdir -p /opt/monitoring
              cd /opt/monitoring

              cat << 'PROMETHEUS' > prometheus.yml
              global:
                scrape_interval: 15s

              scrape_configs:
                - job_name: 'node_exporter'
                  ec2_sd_configs:
                    - region: ${var.aws_region}
                      port: 9100
                  relabel_configs:
                    - source_labels: [__meta_ec2_tag_Name]
                      action: keep
                      regex: (App-Backend-Tier|App-Frontend-Tier|App-Caddy-NAT|App-Monitoring)
                    - source_labels: [__meta_ec2_private_ip]
                      target_label: instance
              PROMETHEUS

              cat << 'DOCKERCOMPOSE' > docker-compose.yml
              version: "3.8"

              services:
                prometheus:
                  image: prom/prometheus:latest
                  container_name: prometheus
                  restart: unless-stopped
                  ports:
                    - "9090:9090"
                  volumes:
                    - ./prometheus.yml:/etc/prometheus/prometheus.yml
                    - prometheus_data:/prometheus
                  command:
                    - "--config.file=/etc/prometheus/prometheus.yml"
                    - "--storage.tsdb.path=/prometheus"
                    - "--web.console.libraries=/etc/prometheus/console_libraries"
                    - "--web.console.templates=/etc/prometheus/consoles"
                    - "--web.enable-lifecycle"

                grafana:
                  image: grafana/grafana:latest
                  container_name: grafana
                  restart: unless-stopped
                  ports:
                    - "3000:3000"
                  volumes:
                    - grafana_data:/var/lib/grafana
                  environment:
                    - GF_SECURITY_ADMIN_USER=admin
                    - GF_SECURITY_ADMIN_PASSWORD=admin
                  depends_on:
                    - prometheus

              volumes:
                prometheus_data:
                grafana_data:
              DOCKERCOMPOSE

              docker-compose up -d

              docker run -d --restart always \
                --name node-exporter \
                --net="host" \
                --pid="host" \
                -v "/:/host:ro,rslave" \
                quay.io/prometheus/node-exporter:latest \
                --path.rootfs=/host
              EOF

  tags = { Name = "App-Monitoring" }
}

# --- Database: PostgreSQL RDS ---
resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "app-db-subnet-group"
  subnet_ids = [aws_subnet.private_app.id, aws_subnet.private_data.id]
}

resource "aws_db_instance" "postgres" {
  identifier             = "app-db"
  db_name                = "neighbourhelp_postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp2"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = true
  multi_az               = false
}

# --- S3 Bucket for User Uploads ---
resource "aws_s3_bucket" "user_uploads" {
  bucket_prefix = "neighbourhelp-uploads-"
}

# Block public access
resource "aws_s3_bucket_public_access_block" "uploads_block" {
  bucket                  = aws_s3_bucket.user_uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allow CORS so my frontend can upload directly to S3
resource "aws_s3_bucket_cors_configuration" "uploads_cors" {
  bucket = aws_s3_bucket.user_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["https://neighbourhelp.me"] # Replace with local/dev URLs as needed
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Pass the bucket name to the backend via SSM
resource "aws_ssm_parameter" "s3_bucket_name" {
  name  = "/app/backend/s3_uploads_bucket"
  type  = "String"
  value = aws_s3_bucket.user_uploads.bucket
}

# --- Secrets & Configuration Store ---
resource "aws_ssm_parameter" "db_connection_string" {
  name = "/app/ConnectionStrings/DefaultConnection"
  type = "String"
  value = format("Host=%s;Port=5432;Database=neighbourhelp_postgres;Username=%s;Password=%s;",
  aws_db_instance.postgres.address, var.db_username, var.db_password)
}

resource "aws_ssm_parameter" "db_host" {
  name  = "/app/db/host"
  type  = "String"
  value = aws_db_instance.postgres.address
}

resource "aws_ssm_parameter" "db_username" {
  name  = "/app/db/username"
  type  = "String"
  value = var.db_username
}

resource "aws_ssm_parameter" "db_password" {
  name        = "/app/db/password"
  description = "Database admin password"
  type        = "SecureString"
  value       = var.db_password
}
