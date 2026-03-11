terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1" # Learner Lab constraint
}

# --- Network Topology ---
resource "aws_vpc" "neighborhelp_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "NeighborHelp-VPC" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.neighborhelp_vpc.id
  tags = { Name = "NeighborHelp-IGW" }
}

resource "aws_subnet" "public_dmz" {
  vpc_id                  = aws_vpc.neighborhelp_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "NeighborHelp-Public-DMZ" }
}

resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.neighborhelp_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "NeighborHelp-Private-App" }
}

resource "aws_subnet" "private_data" {
  vpc_id            = aws_vpc.neighborhelp_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-east-1b" # Spread across AZs for RDS Subnet Group
  tags = { Name = "NeighborHelp-Private-Data" }
}

# --- Routing ---
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.neighborhelp_vpc.id
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
  vpc_id = aws_vpc.neighborhelp_vpc.id
  route {
    cidr_block           = "0.0.0.0/0"
    # Route outbound internet traffic through the NAT EC2 instance
    network_interface_id = aws_instance.caddy_nat_instance.primary_network_interface_id
  }
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
  vpc_id      = aws_vpc.neighborhelp_vpc.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow all inbound from Private Subnets for NAT routing"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_subnet.private_app.cidr_block, aws_subnet.private_data.cidr_block]
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
  description = "Allow traffic from Caddy proxy"
  vpc_id      = aws_vpc.neighborhelp_vpc.id

  ingress {
    description     = "Allow traffic from Public SG"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.public_sg.id]
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
  vpc_id      = aws_vpc.neighborhelp_vpc.id

  ingress {
    description     = "PostgreSQL from App Tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }
}

# --- Compute: AMIs ---
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# --- Compute: Combined Caddy + NAT Instance (Public DMZ) ---
resource "aws_instance" "caddy_nat_instance" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = "t3.micro"
  subnet_id            = aws_subnet.public_dmz.id
  iam_instance_profile = "LabInstanceProfile" # Learner Lab constraint
  
  vpc_security_group_ids = [aws_security_group.public_sg.id]

  # CRITICAL: Must be false to allow NAT routing of packets not destined for this instance
  source_dest_check = false 

  user_data = <<-EOF
              #!/bin/bash
              # 1. Enable IP Forwarding
              sysctl -w net.ipv4.ip_forward=1
              echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/custom-ip-forwarding.conf
              
              # 2. Dynamically find primary network interface (e.g., ens5 or eth0)
              PRIMARY_IF=$(ip route show default | awk '/default/ {print $5}')
              
              # 3. Configure iptables for IP Masquerading
              iptables -t nat -A POSTROUTING -o $PRIMARY_IF -s ${aws_vpc.neighborhelp_vpc.cidr_block} -j MASQUERADE
              
              # 4. Save iptables rules to persist across reboots
              dnf install -y iptables-services
              systemctl enable iptables
              iptables-save > /etc/sysconfig/iptables
              EOF

  tags = { Name = "NeighborHelp-Caddy-NAT" }
}

# --- Compute: App Tier (Private Subnet) ---
resource "aws_instance" "app_instance" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = "t3.large" # Scaled up to handle Next.js, .NET Core, and Grafana density
  subnet_id            = aws_subnet.private_app.id
  iam_instance_profile = "LabInstanceProfile"
  
  vpc_security_group_ids = [aws_security_group.app_sg.id]

  # GHCR Docker Pulls & SSM Session Manager will succeed because of the NAT instance above
  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y docker
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ssm-user # Allow SSM user to execute docker commands directly
              EOF

  tags = { Name = "NeighborHelp-App-Tier" }
}

# --- Database: PostgreSQL RDS ---
resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "neighborhelp-db-subnet-group"
  subnet_ids = [aws_subnet.private_app.id, aws_subnet.private_data.id] # RDS requires at least 2 AZs
}

resource "aws_db_instance" "postgres" {
  identifier             = "neighborhelp-db"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp2"
  username               = "dbadmin"
  password               = "SuperSecretPassword123!" # In production, pull from AWS Secrets Manager
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = true # Required to cleanly destroy via Terraform without hanging
  multi_az               = false # Disabled per lab constraints
}
