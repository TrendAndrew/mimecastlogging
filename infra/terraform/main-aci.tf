terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
  }

  backend "azurerm" {}
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "rg-mcvone-${var.environment}"
  location = var.location
}

resource "azurerm_container_group" "forwarder" {
  name                = "mcvone-${var.environment}-aci"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  restart_policy      = "Always"

  container {
    name   = "mimecast-forwarder"
    image  = var.container_image
    cpu    = var.cpu_cores
    memory = var.memory_gb

    environment_variables = {
      MIMECAST_BASE_URL    = var.mimecast_base_url
      MIMECAST_EVENT_TYPES = var.mimecast_event_types
      VISIONONE_INGEST_URL = var.visionone_ingest_url
      POLL_INTERVAL_MS     = var.poll_interval_ms
      LOG_LEVEL            = var.log_level
      NODE_ENV             = "production"
    }

    secure_environment_variables = {
      MIMECAST_CLIENT_ID     = var.mimecast_client_id
      MIMECAST_CLIENT_SECRET = var.mimecast_client_secret
      VISIONONE_INGEST_TOKEN = var.visionone_ingest_token
    }

    volume {
      name       = "state"
      mount_path = "/app/state"
      empty_dir  = true
    }
  }
}

# Variables
variable "environment" {
  type    = string
  default = "dev"
}

variable "location" {
  type    = string
  default = "australiaeast"
}

variable "container_image" {
  type        = string
  description = "Docker image (e.g. ghcr.io/YOUR_ORG/mimecastlogging:latest)"
}

variable "mimecast_base_url" {
  type    = string
  default = "https://api.services.mimecast.com"
}

variable "mimecast_client_id" {
  type      = string
  sensitive = true
}

variable "mimecast_client_secret" {
  type      = string
  sensitive = true
}

variable "mimecast_event_types" {
  type    = string
  default = "receipt,ttp-url,ttp-attachment,ttp-impersonation"
}

variable "visionone_ingest_url" {
  type        = string
  description = "Full Vision One ingest endpoint URL"
}

variable "visionone_ingest_token" {
  type      = string
  sensitive = true
}

variable "poll_interval_ms" {
  type    = string
  default = "300000"
}

variable "log_level" {
  type    = string
  default = "info"
}

variable "cpu_cores" {
  type    = number
  default = 0.5
}

variable "memory_gb" {
  type    = number
  default = 0.5
}

# Outputs
output "container_group_id" {
  value = azurerm_container_group.forwarder.id
}
