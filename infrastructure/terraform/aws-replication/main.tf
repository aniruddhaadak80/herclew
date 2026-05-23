resource "aws_instance" "herclew_clone" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.large"
}
