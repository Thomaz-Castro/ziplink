variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "ziplink"
}

variable "key_pair_name" {
  description = "EC2 Key Pair name for SSH access (leave empty to use SSM only)"
  type        = string
  default     = ""
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH into the instance"
  type        = string
  default     = "0.0.0.0/0"
}

variable "jwt_secret" {
  description = "JWT signing secret (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = "change_me_in_prod"
}

variable "domain_name" {
  description = "Domain name for the application (e.g. example.com). Leave empty to use Elastic IP."
  type        = string
  default     = ""
}
