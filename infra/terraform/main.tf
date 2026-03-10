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
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "main" {
  name     = "rg-mcvone-${var.environment}"
  location = var.location
}

module "storage" {
  source              = "./modules/storage"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  name_prefix         = "mcvone${var.environment}"
}

module "keyvault" {
  source                  = "./modules/keyvault"
  resource_group_name     = azurerm_resource_group.main.name
  location                = azurerm_resource_group.main.location
  name_prefix             = "mcvone-${var.environment}"
  tenant_id               = data.azurerm_client_config.current.tenant_id
  mimecast_client_id      = var.mimecast_client_id
  mimecast_client_secret  = var.mimecast_client_secret
  visionone_ingest_token  = var.visionone_ingest_token
}

module "function_app" {
  source                 = "./modules/function-app"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  name_prefix            = "mcvone-${var.environment}"
  storage_account_name   = module.storage.account_name
  storage_account_key    = module.storage.primary_key
  keyvault_uri           = module.keyvault.vault_uri
  mimecast_base_url      = var.mimecast_base_url
  visionone_base_url     = var.visionone_base_url
  poll_interval_ms       = var.poll_interval_ms
}

module "monitoring" {
  source              = "./modules/monitoring"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  name_prefix         = "mcvone-${var.environment}"
  function_app_id     = module.function_app.id
}
