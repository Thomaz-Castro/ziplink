output "public_ip" {
  description = "Public IP (Elastic IP) of the ZipLink server"
  value       = aws_eip.app.public_ip
}

output "public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.app.public_dns
}

output "app_url" {
  description = "Application URL"
  value       = "http://${aws_eip.app.public_ip}"
}

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app.id
}
