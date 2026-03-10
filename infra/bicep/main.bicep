targetScope = 'resourceGroup'

@description('Environment name')
param environment string = 'dev'

@description('Azure region')
param location string = resourceGroup().location

@description('Mimecast Client ID')
@secure()
param mimecastClientId string

@description('Mimecast Client Secret')
@secure()
param mimecastClientSecret string

@description('Vision One Ingest Token')
@secure()
param visionOneIngestToken string

@description('Mimecast Base URL')
param mimecastBaseUrl string = 'https://api.services.mimecast.com'

@description('Vision One Base URL')
param visionOneBaseUrl string = 'https://api.xdr.trendmicro.com'

@description('Poll interval in milliseconds')
param pollIntervalMs string = '300000'

var baseName = 'mcvone${environment}'

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: '${baseName}stor'
    location: location
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: '${baseName}-kv'
    location: location
    mimecastClientId: mimecastClientId
    mimecastClientSecret: mimecastClientSecret
    visionOneIngestToken: visionOneIngestToken
  }
}

module functionApp 'modules/function-app.bicep' = {
  name: 'functionApp'
  params: {
    name: '${baseName}-func'
    location: location
    storageAccountName: storage.outputs.name
    storageAccountKey: storage.outputs.key
    keyVaultUri: keyvault.outputs.uri
    mimecastBaseUrl: mimecastBaseUrl
    visionOneBaseUrl: visionOneBaseUrl
    pollIntervalMs: pollIntervalMs
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    name: '${baseName}-insights'
    location: location
    functionAppName: functionApp.outputs.name
  }
}

output functionAppUrl string = functionApp.outputs.url
output keyVaultName string = keyvault.outputs.name
