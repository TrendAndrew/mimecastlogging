variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "storage_account_name" { type = string }
variable "storage_account_key" { type = string; sensitive = true }
variable "keyvault_uri" { type = string }
variable "mimecast_base_url" { type = string }
variable "visionone_base_url" { type = string }
variable "poll_interval_ms" { type = string }

resource "azurerm_service_plan" "main" {
  name                = "${var.name_prefix}-plan"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "main" {
  name                       = "${var.name_prefix}-func"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  service_plan_id            = azurerm_service_plan.main.id
  storage_account_name       = var.storage_account_name
  storage_account_access_key = var.storage_account_key

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "20"
    }
  }

  app_settings = {
    FUNCTIONS_EXTENSION_VERSION = "~4"
    FUNCTIONS_WORKER_RUNTIME    = "node"
    MIMECAST_BASE_URL           = var.mimecast_base_url
    MIMECAST_CLIENT_ID          = "@Microsoft.KeyVault(VaultName=${var.keyvault_uri};SecretName=MimecastClientId)"
    MIMECAST_CLIENT_SECRET      = "@Microsoft.KeyVault(VaultName=${var.keyvault_uri};SecretName=MimecastClientSecret)"
    VISIONONE_BASE_URL          = var.visionone_base_url
    VISIONONE_INGEST_TOKEN      = "@Microsoft.KeyVault(VaultName=${var.keyvault_uri};SecretName=VisionOneIngestToken)"
    VISIONONE_VENDOR            = "Mimecast"
    VISIONONE_PRODUCT           = "Email Security"
    POLL_INTERVAL_MS            = var.poll_interval_ms
    LOG_LEVEL                   = "info"
  }
}

output "id" { value = azurerm_linux_function_app.main.id }
output "url" { value = "https://${azurerm_linux_function_app.main.default_hostname}" }
output "principal_id" { value = azurerm_linux_function_app.main.identity[0].principal_id }
