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

variable "grafana_password" {
  description = "Password for the Grafana admin account"
  type        = string
  sensitive   = true
}

variable "caddy_elastic_ip" {
  description = "The existing Elastic IP address allocated for the Caddy instance"
  type        = string
  sensitive   = true
}

variable "github_pat" {
  description = "GitHub Personal Access Token for pulling GHCR images"
  type        = string
  sensitive   = true
}

variable "github_username" {
  description = "GitHub Username or Organization for GHCR"
  type        = string
}

provider "aws" {
  region = var.aws_region
}

resource "aws_ssm_parameter" "github_pat" {
  name  = "/app/github_pat"
  type  = "SecureString"
  value = var.github_pat
}

resource "aws_ssm_parameter" "github_username" {
  name  = "/app/github_username"
  type  = "String"
  value = var.github_username
}

# --- Dynamic Data Sources ---
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu_2404" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

data "aws_ami" "ubuntu_2404_arm64" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
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
  tags                    = { Name = "App-Public-DMZ-1" }
}

resource "aws_subnet" "public_dmz_2" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.4.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true
  tags                    = { Name = "App-Public-DMZ-2" }
}

resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.app_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "App-Private-Tier-1" }
}

resource "aws_subnet" "private_app_2" {
  vpc_id            = aws_vpc.app_vpc.id
  cidr_block        = "10.0.5.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags              = { Name = "App-Private-Tier-2" }
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

resource "aws_route_table_association" "public_assoc_2" {
  subnet_id      = aws_subnet.public_dmz_2.id
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

resource "aws_route_table_association" "private_app_assoc_2" {
  subnet_id      = aws_subnet.private_app_2.id
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
    description = "Allow HTTP 3000 from Internal ALB"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    self        = true # The ALB will use the same SG or we can allow self
  }

  ingress {
    description = "Allow HTTP 5073 from Internal ALB"
    from_port   = 5073
    to_port     = 5073
    protocol    = "tcp"
    self        = true
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

  ingress {
    description = "Redis"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
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
  name        = "db_sg"
  description = "Security group for PostgreSQL RDS"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    description     = "PostgreSQL from App Subnet"
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
      },
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetHealth"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach a policy for CloudWatch read-only access for Grafana to monitor RDS, S3 and SES
resource "aws_iam_role_policy" "cloudwatch_read_policy" {
  name = "cloudwatch-read-policy"
  role = aws_iam_role.ec2_ssm_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarmsForMetric",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetInsightRuleReport"
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

# Find the existing Elastic IP for Caddy using tags
data "aws_eip" "caddy_existing_eip" {
  public_ip = var.caddy_elastic_ip
}

# Attach it to the Caddy instance
resource "aws_eip_association" "caddy_eip_assoc" {
  instance_id   = aws_instance.caddy_nat_instance.id
  allocation_id = data.aws_eip.caddy_existing_eip.id
}

# --- Compute: Combined Proxy + NAT Instance (Public DMZ) ---
resource "aws_instance" "caddy_nat_instance" {
  ami                  = data.aws_ami.ubuntu_2404.id
  instance_type        = "t3.micro"
  subnet_id            = aws_subnet.public_dmz_2.id  # Move to 5b to avoid capacity issues in 5a
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.id
  key_name             = var.key_name

  vpc_security_group_ids = [aws_security_group.public_sg.id]
  source_dest_check      = false
  user_data = templatefile("${path.module}/scripts/caddy_nat_instance.sh", {
    docker_compose_content     = file("${path.module}/compose/caddy_nat_instance.yml")
    aws_vpc_app_vpc_cidr_block = aws_vpc.app_vpc.cidr_block
    aws_region                 = var.aws_region
  })

  tags = { Name = "App-Caddy-NAT" }
}

# --- ALB & Auto Scaling Groups ---
resource "aws_lb" "app_alb" {
  name               = "app-internal-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.app_sg.id]
  subnets            = [aws_subnet.private_app.id, aws_subnet.private_app_2.id]

  tags = { Name = "App-Internal-ALB" }
}

# Frontend Target Group and Listener
resource "aws_lb_target_group" "frontend_tg" {
  name     = "frontend-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.app_vpc.id

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200-399"
  }
}

resource "aws_lb_listener" "frontend_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = "3000"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend_tg.arn
  }
}

# Backend Target Group and Listener
resource "aws_lb_target_group" "backend_tg" {
  name     = "backend-tg"
  port     = 5073
  protocol = "HTTP"
  vpc_id   = aws_vpc.app_vpc.id

  health_check {
    path                = "/api/health" # Or another valid health check endpoint if this fails
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200-499" # Give some leniency in case of 401s on root API
  }
}

resource "aws_lb_listener" "backend_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = "5073"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_tg.arn
  }
}

# Frontend Launch Template & ASG
resource "aws_launch_template" "frontend_lt" {
  name_prefix   = "frontend-lt"
  image_id      = data.aws_ami.ubuntu_2404.id
  instance_type = "t3.micro"
  key_name      = var.key_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_ssm_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app_sg.id]

  user_data = base64encode(templatefile("${path.module}/scripts/frontend_instance.sh", {
    docker_compose_content = file("${path.module}/compose/frontend_instance.yml")
    var_instance_password  = var.instance_password
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "App-Frontend-Tier" }
  }
}

resource "aws_autoscaling_group" "frontend_asg" {
  name                      = "frontend-asg"
  max_size                  = 3
  min_size                  = 1
  desired_capacity          = 1
  vpc_zone_identifier       = [aws_subnet.private_app_2.id]  # Only use 5b for now due to capacity issues in 5a
  target_group_arns         = [aws_lb_target_group.frontend_tg.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.frontend_lt.id
    version = "$Latest"
  }
}

resource "aws_autoscaling_policy" "frontend_scaling" {
  name                   = "frontend-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.frontend_asg.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}

# Backend Launch Template & ASG
resource "aws_launch_template" "backend_lt" {
  name_prefix   = "backend-lt"
  image_id      = data.aws_ami.ubuntu_2404.id
  instance_type = "t3.medium"
  key_name      = var.key_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_ssm_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app_sg.id]

  user_data = base64encode(templatefile("${path.module}/scripts/app_instance.sh", {
    docker_compose_content = file("${path.module}/compose/app_instance.yml")
    var_instance_password  = var.instance_password
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "App-Backend-Tier" }
  }
}

resource "aws_autoscaling_group" "backend_asg" {
  name                      = "backend-asg"
  max_size                  = 3
  min_size                  = 1
  desired_capacity          = 1
  vpc_zone_identifier       = [aws_subnet.private_app_2.id]  # Only use 5b for now due to capacity issues in 5a
  target_group_arns         = [aws_lb_target_group.backend_tg.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.backend_lt.id
    version = "$Latest"
  }
}

resource "aws_autoscaling_policy" "backend_scaling" {
  name                   = "backend-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.backend_asg.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
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
  user_data = templatefile("${path.module}/scripts/monitoring_instance.sh", {
    docker_compose_content = templatefile("${path.module}/compose/monitoring_instance.yml", {
      var_grafana_password = var.grafana_password
    })
    var_instance_password = var.instance_password
    var_aws_region        = var.aws_region
  })

  tags = { Name = "App-Monitoring" }
}

# --- Database: PostgreSQL RDS ---
resource "aws_instance" "redis_instance" {
  ami                    = data.aws_ami.ubuntu_2404_arm64.id
  instance_type          = "r7g.medium"
  subnet_id              = aws_subnet.private_app.id
  iam_instance_profile   = aws_iam_instance_profile.ec2_ssm_profile.name
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]

  user_data_replace_on_change = true
  user_data                   = templatefile("${path.module}/scripts/redis_instance.sh", {})

  tags = {
    Name = "redis-instance"
  }
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "app-db-subnet-group"
  subnet_ids = [aws_subnet.private_app.id, aws_subnet.private_app_2.id, aws_subnet.private_data.id]
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
resource "aws_ssm_parameter" "api_url" {
  name      = "/app/backend/api_url"
  type      = "String"
  value     = "http://${aws_lb.app_alb.dns_name}:5073"
  overwrite = true
}
resource "aws_ssm_parameter" "db_connection_string" {
  name  = "/app/ConnectionStrings/DefaultConnection"
  type  = "String"
  value = format("Host=%s;Port=5432;Database=neighbourhelp_postgres;Username=%s;Password=%s;", aws_db_instance.postgres.address, var.db_username, var.db_password)
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
  name        = "/app/db_password"
  description = "Database password"
  type        = "SecureString"
  value       = var.db_password
}

resource "aws_ssm_parameter" "redis_host" {
  name  = "/app/redis_host"
  type  = "String"
  value = aws_instance.redis_instance.private_ip
}
