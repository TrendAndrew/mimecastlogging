variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "function_app_id" { type = string }

resource "azurerm_application_insights" "main" {
  name                = "${var.name_prefix}-insights"
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = "web"
  retention_in_days   = 30
}

resource "azurerm_monitor_metric_alert" "errors" {
  name                = "${var.name_prefix}-errors"
  resource_group_name = var.resource_group_name
  scopes              = [var.function_app_id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 5
  }
}

output "instrumentation_key" { value = azurerm_application_insights.main.instrumentation_key }
output "connection_string" { value = azurerm_application_insights.main.connection_string }
