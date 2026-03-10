output "function_app_url" {
  value = module.function_app.url
}

output "keyvault_name" {
  value = module.keyvault.name
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}
