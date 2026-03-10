variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "tenant_id" { type = string }
variable "mimecast_client_id" { type = string; sensitive = true }
variable "mimecast_client_secret" { type = string; sensitive = true }
variable "visionone_ingest_token" { type = string; sensitive = true }

resource "azurerm_key_vault" "main" {
  name                       = "${var.name_prefix}-kv"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
}

resource "azurerm_key_vault_secret" "mimecast_client_id" {
  name         = "MimecastClientId"
  value        = var.mimecast_client_id
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "mimecast_client_secret" {
  name         = "MimecastClientSecret"
  value        = var.mimecast_client_secret
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "visionone_token" {
  name         = "VisionOneIngestToken"
  value        = var.visionone_ingest_token
  key_vault_id = azurerm_key_vault.main.id
}

output "vault_uri" { value = azurerm_key_vault.main.vault_uri }
output "name" { value = azurerm_key_vault.main.name }
