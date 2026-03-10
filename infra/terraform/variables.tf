variable "environment" {
  type    = string
  default = "dev"
}

variable "location" {
  type    = string
  default = "australiaeast"
}

variable "mimecast_client_id" {
  type      = string
  sensitive = true
}

variable "mimecast_client_secret" {
  type      = string
  sensitive = true
}

variable "visionone_ingest_token" {
  type      = string
  sensitive = true
}

variable "mimecast_base_url" {
  type    = string
  default = "https://api.services.mimecast.com"
}

variable "visionone_base_url" {
  type    = string
  default = "https://api.xdr.trendmicro.com"
}

variable "poll_interval_ms" {
  type    = string
  default = "300000"
}
