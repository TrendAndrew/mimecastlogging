variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }

resource "azurerm_storage_account" "main" {
  name                     = "${var.name_prefix}stor"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "state" {
  name                  = "poller-state"
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "private"
}

output "account_name" { value = azurerm_storage_account.main.name }
output "primary_key" { value = azurerm_storage_account.main.primary_access_key }
