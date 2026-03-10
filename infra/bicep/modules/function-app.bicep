param name string
param location string
param storageAccountName string
@secure()
param storageAccountKey string
param keyVaultUri string
param mimecastBaseUrl string
param visionOneBaseUrl string
param pollIntervalMs string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${name}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
}

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: name
  location: location
  kind: 'functionapp'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~20'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'MIMECAST_BASE_URL', value: mimecastBaseUrl }
        { name: 'MIMECAST_CLIENT_ID', value: '@Microsoft.KeyVault(VaultName=${keyVaultUri};SecretName=MimecastClientId)' }
        { name: 'MIMECAST_CLIENT_SECRET', value: '@Microsoft.KeyVault(VaultName=${keyVaultUri};SecretName=MimecastClientSecret)' }
        { name: 'VISIONONE_BASE_URL', value: visionOneBaseUrl }
        { name: 'VISIONONE_INGEST_TOKEN', value: '@Microsoft.KeyVault(VaultName=${keyVaultUri};SecretName=VisionOneIngestToken)' }
        { name: 'VISIONONE_VENDOR', value: 'Mimecast' }
        { name: 'VISIONONE_PRODUCT', value: 'Email Security' }
        { name: 'POLL_INTERVAL_MS', value: pollIntervalMs }
        { name: 'LOG_LEVEL', value: 'info' }
      ]
    }
  }
}

output name string = functionApp.name
output url string = 'https://${functionApp.properties.defaultHostName}'
output principalId string = functionApp.identity.principalId
